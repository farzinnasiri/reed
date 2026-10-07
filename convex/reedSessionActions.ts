import { ConvexError, v } from 'convex/values';
import { z } from 'zod';
import {
  query,
  mutation,
  internalQuery,
  env,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { requireViewerProfile } from './profiles';
import {
  activeSession,
  supportedPlanningExercise,
  groundedTargets,
  validatePlannedExercises,
} from './plannedSessions';
import { swapSafetyReason, applyUnloggedSwap } from './workout/swap';
import { actionStatusValidator, sessionActionFields } from './reedSessionActionValues';

export const SESSION_ACTION_CONTRACT = 'reed-session-swap-v1';
export function actorEnabled(profileId: Id<'profiles'>) {
  // Closed by default; no client argument, chat reply or widget grants Actor permission.
  return (env.REED_SESSION_ACTOR_PROFILE_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .includes(profileId);
}
const modelSwap = z.object({
  operation: z.literal('swap'),
  sessionId: z.string(),
  sessionExerciseId: z.string(),
  replacementCatalogId: z.string(),
  expectedRevision: z.number().int().min(0),
  setCount: z.number().int().min(1).max(8),
  restSeconds: z.number().int().min(0).max(240),
  rationale: z.string().trim().min(1).max(500),
});

export async function prepareSessionAction(
  ctx: MutationCtx,
  profileId: Id<'profiles'>,
  raw: unknown,
  user: Doc<'reedMessages'>,
  assistant: Doc<'reedMessages'>,
) {
  const parsed = modelSwap.safeParse(raw);
  if (
    !parsed.success ||
    !actorEnabled(profileId) ||
    user.role !== 'user' ||
    user.profileId !== profileId ||
    user.threadId !== assistant.threadId ||
    assistant.source === 'background_coach' ||
    !/\b(swap|replace|switch|change)\b/i.test(user.content)
  )
    return null;
  const input = parsed.data;
  const session = await activeSession(ctx, profileId);
  const exerciseId = ctx.db.normalizeId('liveSessionExercises', input.sessionExerciseId);
  const replacementId = ctx.db.normalizeId('exerciseCatalog', input.replacementCatalogId);
  const exercise = exerciseId ? await ctx.db.get(exerciseId) : null;
  if (
    !session ||
    session._id !== input.sessionId ||
    (session.structureRevision ?? 0) !== input.expectedRevision ||
    !exercise ||
    exercise.profileId !== profileId ||
    exercise.sessionId !== session._id ||
    !replacementId ||
    replacementId === exercise.exerciseCatalogId ||
    (await swapSafetyReason(ctx, session, exercise))
  )
    return null;
  try {
    const targets = await groundedTargets(
      ctx,
      profileId,
      replacementId,
      input.setCount,
      input.restSeconds,
    );
    await validatePlannedExercises(ctx, profileId, [{ exerciseCatalogId: replacementId, targets }]);
    return { session, exercise, replacementId, targets, rationale: input.rationale };
  } catch {
    return null;
  }
}
export async function saveSessionAction(
  ctx: MutationCtx,
  profileId: Id<'profiles'>,
  sourceMessageId: Id<'reedMessages'>,
  prepared: NonNullable<Awaited<ReturnType<typeof prepareSessionAction>>>,
) {
  const existing = await ctx.db
    .query('reedSessionActions')
    .withIndex('by_source_message', (q) => q.eq('sourceMessageId', sourceMessageId))
    .unique();
  if (existing) return existing._id;
  const now = Date.now();
  return ctx.db.insert('reedSessionActions', {
    profileId,
    sessionId: prepared.session._id,
    sourceMessageId,
    operation: 'swap',
    sessionExerciseId: prepared.exercise._id,
    previousCatalogId: prepared.exercise.exerciseCatalogId,
    replacementCatalogId: prepared.replacementId,
    expectedRevision: prepared.session.structureRevision ?? 0,
    targets: prepared.targets,
    rationale: prepared.rationale,
    modelContractVersion: SESSION_ACTION_CONTRACT,
    status: 'pending',
    createdAt: now,
    expiresAt: now + 5 * 60_000,
  });
}
async function invalidReason(ctx: QueryCtx | MutationCtx, action: Doc<'reedSessionActions'>) {
  if (Date.now() >= action.expiresAt) return 'expired';
  if (!actorEnabled(action.profileId)) return 'actor_disabled';
  const session = await activeSession(ctx, action.profileId);
  if (!session || session._id !== action.sessionId) return 'session_ended_or_replaced';
  if ((session.structureRevision ?? 0) !== action.expectedRevision) return 'session_changed';
  const exercise = await ctx.db.get(action.sessionExerciseId);
  if (!exercise || exercise.exerciseCatalogId !== action.previousCatalogId)
    return 'exercise_changed';
  const unsafe = await swapSafetyReason(ctx, session, exercise);
  if (unsafe) return unsafe;
  try {
    await validatePlannedExercises(ctx, action.profileId, [
      { exerciseCatalogId: action.replacementCatalogId, targets: action.targets },
    ]);
  } catch {
    return 'replacement_unavailable';
  }
  return null;
}
const resultValidator = v.object({
  status: actionStatusValidator,
  sessionId: v.id('liveSessions'),
  sessionExerciseId: v.id('liveSessionExercises'),
  reason: v.union(v.string(), v.null()),
});
function result(
  action: Doc<'reedSessionActions'>,
  status = action.status,
  reason: string | null = action.invalidReason ?? null,
) {
  return {
    status,
    sessionId: action.sessionId,
    sessionExerciseId: action.sessionExerciseId,
    reason,
  };
}
export const confirmSessionAction = mutation({
  args: { actionId: v.id('reedSessionActions') },
  returns: resultValidator,
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const action = await ctx.db.get(args.actionId);
    if (!action || action.profileId !== profile._id) throw new ConvexError('Action not found.');
    if (!actorEnabled(profile._id)) throw new ConvexError('Reed session actions are not enabled.');
    if (action.status !== 'pending') return result(action);
    const reason = await invalidReason(ctx, action);
    if (reason) {
      const status = reason === 'expired' ? ('expired' as const) : ('rejected' as const);
      await ctx.db.patch(action._id, { status, invalidReason: reason, resolvedAt: Date.now() });
      return result(action, status, reason);
    }
    const session = await ctx.db.get(action.sessionId);
    const exercise = await ctx.db.get(action.sessionExerciseId);
    if (!session || !exercise) throw new ConvexError('Session changed.');
    const replacement = await supportedPlanningExercise(
      ctx,
      profile._id,
      action.replacementCatalogId,
    );
    const revision = session.structureRevision ?? 0;
    const snapshots = await applyUnloggedSwap(ctx, session, exercise, replacement, action.targets);
    const now = Date.now();
    await ctx.db.patch(action._id, {
      status: 'applied',
      resolvedAt: now,
      audit: {
        confirmedAt: now,
        applyingProfileId: profile._id,
        actualRevision: revision,
        resultingRevision: revision + 1,
        ...snapshots,
      },
    });
    return result(action, 'applied');
  },
});
export const rejectSessionAction = mutation({
  args: { actionId: v.id('reedSessionActions') },
  returns: resultValidator,
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const action = await ctx.db.get(args.actionId);
    if (!action || action.profileId !== profile._id) throw new ConvexError('Action not found.');
    if (action.status !== 'pending') return result(action);
    const expired = Date.now() >= action.expiresAt;
    const status = expired ? ('expired' as const) : ('rejected' as const);
    const reason = expired ? 'expired' : 'user_rejected';
    await ctx.db.patch(action._id, { status, invalidReason: reason, resolvedAt: Date.now() });
    return result(action, status, reason);
  },
});
export const getSessionAction = query({
  args: { actionId: v.id('reedSessionActions') },
  returns: v.union(
    v.null(),
    v.object({
      ...sessionActionFields,
      _id: v.id('reedSessionActions'),
      _creationTime: v.number(),
      previousExerciseName: v.string(),
      replacementExerciseName: v.string(),
      canConfirm: v.boolean(),
      unavailableReason: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const action = await ctx.db.get(args.actionId);
    if (!action || action.profileId !== profile._id) return null;
    const previous = await ctx.db.get(action.previousCatalogId);
    const replacement = await ctx.db.get(action.replacementCatalogId);
    const reason =
      action.status === 'pending'
        ? await invalidReason(ctx, action)
        : (action.invalidReason ?? null);
    return {
      ...action,
      status:
        reason === 'expired' && action.status === 'pending' ? ('expired' as const) : action.status,
      previousExerciseName:
        action.audit?.before.exerciseName ?? previous?.name ?? 'Unavailable exercise',
      replacementExerciseName:
        action.audit?.after.exerciseName ?? replacement?.name ?? 'Unavailable exercise',
      canConfirm: action.status === 'pending' && !reason,
      unavailableReason: reason,
    };
  },
});
export const loadSessionActionContext = internalQuery({
  args: { profileId: v.id('profiles') },
  returns: v.union(
    v.null(),
    v.object({
      sessionId: v.id('liveSessions'),
      expectedRevision: v.number(),
      choices: v.array(
        v.object({
          sessionExerciseId: v.id('liveSessionExercises'),
          exerciseName: v.string(),
          exerciseCatalogId: v.id('exerciseCatalog'),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    if (!actorEnabled(args.profileId)) return null;
    const session = await activeSession(ctx, args.profileId);
    if (!session) return null;
    const exercises = await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_session_id_and_position', (q) => q.eq('sessionId', session._id))
      .take(100);
    const choices = [];
    for (const exercise of exercises) {
      if (!(await swapSafetyReason(ctx, session, exercise)))
        choices.push({
          sessionExerciseId: exercise._id,
          exerciseName: exercise.exerciseName,
          exerciseCatalogId: exercise.exerciseCatalogId,
        });
    }
    return { sessionId: session._id, expectedRevision: session.structureRevision ?? 0, choices };
  },
});

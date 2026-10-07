import { closeChapterForSession } from './reedChapters';
import { ConvexError, v } from 'convex/values';
import { z } from 'zod';
import {
  query,
  mutation,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
} from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { loadProfileTimeZone } from './profileTimeZone';
import { requireViewerProfile } from './profiles';
import {
  getRecipeInitialMetrics,
  getRecipeFieldDefinitions,
  resolveCatalogRecipeKey,
  validateRecipeMetrics,
} from '../domains/workout/recipes';
import { plannedExerciseValidator, plannedStatusValidator } from './plannedSessionValues';

const modelPlan = z.object({
  title: z.string().trim().min(1).max(120),
  scheduledForAt: z.number().finite().min(0).max(8.64e15).nullable().optional(),
  plannedSessionId: z.string().optional(),
  expectedRevision: z.number().int().positive().optional(),
  exercises: z
    .array(
      z.object({
        exerciseCatalogId: z.string(),
        setCount: z.number().int().min(1).max(8),
        restSeconds: z.number().int().min(0).max(240),
        targetMetrics: z.array(z.record(z.string(), z.number().finite())).min(1).max(8).optional(),
      }),
    )
    .min(1)
    .max(12),
});
const requestPattern =
  /\b(?:plan\s+(?:me|my|a|an)|(?:create|make|build|give|prepare|design|want|need|write|suggest|recommend)\b[\s\S]{0,100}\b(?:plan|workout|session)|(?:make|change|revise|swap|replace|shorten|lengthen)\b)/i;
async function requestedPlan(ctx: MutationCtx, user: Doc<'reedMessages'>) {
  if (requestPattern.test(user.content)) return true;
  if (!/^(?:yes|sure|okay|ok|please do|go ahead)[.! ]*$/i.test(user.content.trim())) return false;
  const prior = await ctx.db
    .query('reedMessages')
    .withIndex('by_thread_id_and_created_at', (q) =>
      q.eq('threadId', user.threadId).lt('createdAt', user.createdAt),
    )
    .order('desc')
    .take(4);
  const last = prior.find((row) => row.role === 'assistant' && row.status === 'sent');
  return (
    !!last &&
    /\b(?:create|make|build|prepare|plan)\b[\s\S]{0,100}\b(?:workout|session|plan)\b/i.test(
      last.content,
    ) &&
    /[?？]/u.test(last.content)
  );
}

export async function activeSession(ctx: QueryCtx | MutationCtx, profileId: Id<'profiles'>) {
  return ctx.db
    .query('liveSessions')
    .withIndex('by_profile_id_and_status', (q) =>
      q.eq('profileId', profileId).eq('status', 'active'),
    )
    .unique();
}

// Conservative catalog rules, not a medical interpretation of free-form notes.
export async function supportedPlanningExercise(
  ctx: QueryCtx | MutationCtx,
  profileId: Id<'profiles'>,
  id: Id<'exerciseCatalog'>,
) {
  const exercise = await ctx.db.get(id);
  const recipeKey = exercise?.isSupportedInLiveSession ? resolveCatalogRecipeKey(exercise) : null;
  if (!exercise || !recipeKey)
    throw new ConvexError('An exercise is unavailable. Ask Reed to repair the plan.');
  const training = await ctx.db
    .query('trainingProfiles')
    .withIndex('by_profile_id', (q) => q.eq('profileId', profileId))
    .unique();
  if (!training) throw new ConvexError('Complete your training profile first.');
  const portable = new Set(['bodyweight', 'none', 'no equipment', 'mat']);
  if (
    exercise.equipment.some((value) => !portable.has(value.toLowerCase()))
  ) {
    throw new ConvexError(
      'Equipment availability must be clarified before planning this exercise.',
    );
  }
  const areas: Record<string, string[]> = {
    lower_back: ['spine', 'back', 'lumbar'],
    neck: ['neck', 'cervical'],
    shoulder: ['shoulder'],
    knee: ['knee'],
    hip: ['hip'],
    abdomen: ['abdom', 'core'], chest: ['chest', 'pectoral'], upper_back: ['back', 'trap', 'rhomboid'],
    biceps: ['bicep', 'elbow'], triceps: ['tricep', 'elbow'], forearm: ['forearm', 'grip'],
    wrist: ['wrist'], hand: ['hand', 'grip'], front_thigh: ['quad', 'knee'], back_thigh: ['hamstring', 'hip'],
    shin: ['tibialis', 'ankle'], calf: ['calf', 'calves', 'gastrocnemius', 'soleus', 'ankle'],
    ankle: ['ankle'], foot: ['foot', 'feet'], glute: ['glute', 'hip'], groin: ['adductor', 'hip'],
    wrist_elbow: ['wrist', 'elbow'], back_knee: ['knee'], elbow: ['elbow'],
    heel: ['ankle', 'foot', 'feet'], inner_thigh: ['adductor', 'hip'],
  };
  const tags = [
    ...exercise.jointsEmphasized,
    ...exercise.mainMuscleGroups,
    ...exercise.movementPatterns,
  ]
    .join(' ')
    .toLowerCase();
  if (
    (training.onboarding?.discomfort.map(p => p.regionId.replace(/^(left|right)_/, '')) ?? []).some(
      (area) =>
        ['heart', 'lungs', 'other'].includes(area) ||
        (areas[area] ?? []).some((tag) => tags.includes(tag)),
    )
  ) {
    throw new ConvexError(
      'This exercise conflicts with a recorded constraint. Ask Reed for a different option.',
    );
  }
  return { exercise, recipeKey };
}

export async function validatePlannedExercises(
  ctx: QueryCtx | MutationCtx,
  profileId: Id<'profiles'>,
  exercises: Doc<'plannedSessions'>['exercises'],
) {
  if (!exercises.length || exercises.length > 12)
    throw new ConvexError('Plans require 1–12 exercises.');
  const resolved = [];
  for (const entry of exercises) {
    const catalog = await supportedPlanningExercise(ctx, profileId, entry.exerciseCatalogId);
    if (!entry.targets.length || entry.targets.length > 8)
      throw new ConvexError('Exercises require 1–8 target sets.');
    for (const target of entry.targets) {
      validateRecipeMetrics(catalog.recipeKey, target.metrics);
      if (
        !Number.isInteger(target.restSeconds) ||
        target.restSeconds < 0 ||
        target.restSeconds > 240
      )
        throw new ConvexError('Invalid rest guidance.');
    }
    resolved.push(catalog);
  }
  return resolved;
}

export async function groundedTargets(
  ctx: QueryCtx | MutationCtx,
  profileId: Id<'profiles'>,
  exerciseCatalogId: Id<'exerciseCatalog'>,
  count: number,
  restSeconds: number,
) {
  const { recipeKey } = await supportedPlanningExercise(ctx, profileId, exerciseCatalogId);
  const recent = await ctx.db
    .query('activityLogs')
    .withIndex('by_profile_id_and_exercise_catalog_id_and_logged_at', (q) =>
      q.eq('profileId', profileId).eq('exerciseCatalogId', exerciseCatalogId),
    )
    .order('desc')
    .take(8);
  const previous = recent.find((row) => row.recipeKey === recipeKey && !row.warmup);
  // Same performance, never automatic load progression. No history uses visible recipe defaults.
  const metrics = validateRecipeMetrics(
    recipeKey,
    getRecipeInitialMetrics(recipeKey, previous?.metrics),
  );
  return Array.from({ length: count }, () => ({ metrics, restSeconds }));
}

export async function prepareChatPlan(
  ctx: MutationCtx,
  profileId: Id<'profiles'>,
  raw: unknown,
  user: Doc<'reedMessages'>,
  assistant: Doc<'reedMessages'>,
) {
  const parsed = modelPlan.safeParse(raw);
  if (
    !parsed.success ||
    user.role !== 'user' ||
    user.profileId !== profileId ||
    user.threadId !== assistant.threadId ||
    assistant.source === 'background_coach' ||
    !(await requestedPlan(ctx, user))
  )
    return null;
  const input = parsed.data;
  let existing: Doc<'plannedSessions'> | null = null;
  if (input.plannedSessionId) {
    const id = ctx.db.normalizeId('plannedSessions', input.plannedSessionId);
    existing = id ? await ctx.db.get(id) : null;
    if (
      !existing ||
      existing.profileId !== profileId ||
      existing.status !== 'ready' ||
      input.expectedRevision !== existing.revision
    )
      return null;
  } else {
    if (input.expectedRevision !== undefined) return null;
    // A request to edit an existing suggestion must never fork a fresh plan.
    if (/\b(shorter|longer|swap|replace|change|revise|shorten|lengthen)\b/i.test(user.content)) {
      const ready = await ctx.db
        .query('plannedSessions')
        .withIndex('by_profile_status_time', (q) =>
          q.eq('profileId', profileId).eq('status', 'ready'),
        )
        .first();
      if (ready) return null;
    }
  }
  const exercises: Doc<'plannedSessions'>['exercises'] = [];
  try {
    for (const entry of input.exercises) {
      const id = ctx.db.normalizeId('exerciseCatalog', entry.exerciseCatalogId);
      if (!id) return null;
      const targets = await groundedTargets(ctx, profileId, id, entry.setCount, entry.restSeconds);
      if (entry.targetMetrics) {
        if (
          entry.targetMetrics.length !== entry.setCount ||
          !/\b(lighter|easier|load|weight|reps|hold|duration|distance|intensity|seconds|minutes|longer|shorter)\b/i.test(
            user.content,
          )
        )
          return null;
        const { recipeKey } = await supportedPlanningExercise(ctx, profileId, id);
        for (const [index, metrics] of entry.targetMetrics.entries()) {
          const normalized = validateRecipeMetrics(recipeKey, metrics);
          // Requested target changes still cannot introduce automatic load progression.
          for (const key of Object.keys(normalized).filter((key) => /load/i.test(key))) {
            const baseline = targets[index].metrics[key];
            if (key === 'assistLoad' ? normalized[key] < baseline : normalized[key] > baseline)
              return null;
          }
          targets[index].metrics = normalized;
        }
      }
      exercises.push({ exerciseCatalogId: id, targets });
    }
    await validatePlannedExercises(ctx, profileId, exercises);
  } catch {
    return null;
  }
  return {
    existing,
    title: input.title,
    scheduledForAt:
      input.scheduledForAt === null
        ? undefined
        : (input.scheduledForAt ?? existing?.scheduledForAt),
    exercises,
  };
}

export async function saveChatPlan(
  ctx: MutationCtx,
  profileId: Id<'profiles'>,
  sourceMessageId: Id<'reedMessages'>,
  prepared: NonNullable<Awaited<ReturnType<typeof prepareChatPlan>>>,
) {
  const { existing, ...values } = prepared;
  const fields = {
    ...values,
    revision: (existing?.revision ?? 0) + 1,
    updatedAt: Date.now(),
    sourceMessageId,
  };
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return existing._id;
  }
  return ctx.db.insert('plannedSessions', {
    ...fields,
    profileId,
    status: 'ready',
    creator: 'reed',
    createdAt: Date.now(),
  });
}

const cardValidator = v.object({
  plannedSessionId: v.id('plannedSessions'),
  title: v.string(),
  scheduledForAt: v.union(v.number(), v.null()),
  revision: v.number(),
  status: plannedStatusValidator,
  liveSessionId: v.union(v.id('liveSessions'), v.null()),
  timeZone: v.string(),
  continueSessionId: v.union(v.id('liveSessions'), v.null()),
  estimatedDurationMinutes: v.number(),
  availability: v.union(v.literal('available'), v.literal('repair_required')),
  exercises: v.array(
    v.object({
      ...plannedExerciseValidator.fields,
      exerciseName: v.string(),
      available: v.boolean(),
    }),
  ),
});
async function card(ctx: QueryCtx, plan: Doc<'plannedSessions'>) {
  let available = true;
  try {
    await validatePlannedExercises(ctx, plan.profileId, plan.exercises);
  } catch {
    available = false;
  }
  const exercises = await Promise.all(
    plan.exercises.map(async (entry) => {
      const catalog = await ctx.db.get(entry.exerciseCatalogId);
      return {
        ...entry,
        exerciseName: catalog?.name ?? 'Unavailable exercise',
        available: !!catalog?.isSupportedInLiveSession && !!resolveCatalogRecipeKey(catalog),
      };
    }),
  );
  const seconds = plan.exercises.reduce(
    (sum, entry) =>
      sum +
      entry.targets.reduce(
        (n, target, index) =>
          n +
          (target.metrics.duration ?? (target.metrics.reps ?? target.metrics.leftReps ?? 8) * 4) +
          (index < entry.targets.length - 1 ? target.restSeconds : 0),
        0,
      ),
    0,
  );
  return {
    timeZone: await loadProfileTimeZone(ctx, plan.profileId),
    plannedSessionId: plan._id,
    title: plan.title,
    scheduledForAt: plan.scheduledForAt ?? null,
    revision: plan.revision,
    status: plan.status,
    liveSessionId: plan.liveSessionId ?? null,
    continueSessionId: (await activeSession(ctx, plan.profileId))?._id ?? null,
    estimatedDurationMinutes: Math.ceil(seconds / 60),
    availability: available ? ('available' as const) : ('repair_required' as const),
    exercises,
  };
}
export const getPlannedSession = query({
  args: { plannedSessionId: v.id('plannedSessions') },
  returns: v.union(v.null(), cardValidator),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const plan = await ctx.db.get(args.plannedSessionId);
    return plan?.profileId === profile._id && plan.status !== 'dismissed' ? card(ctx, plan) : null;
  },
});
export const listPlannedSessions = query({
  args: {},
  returns: v.array(cardValidator),
  handler: async (ctx) => {
    const profile = await requireViewerProfile(ctx);
    const plans = await ctx.db
      .query('plannedSessions')
      .withIndex('by_profile_status_time', (q) =>
        q.eq('profileId', profile._id).eq('status', 'ready'),
      )
      .order('desc')
      .take(20);
    return Promise.all(plans.map((plan) => card(ctx, plan)));
  },
});
export const dismissPlannedSession = mutation({
  args: { plannedSessionId: v.id('plannedSessions') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const plan = await ctx.db.get(args.plannedSessionId);
    if (!plan || plan.profileId !== profile._id) throw new ConvexError('Plan not found.');
    if (plan.status === 'ready')
      await ctx.db.patch(plan._id, { status: 'dismissed', updatedAt: Date.now() });
    return null;
  },
});
export const startPlannedSession = mutation({
  args: { plannedSessionId: v.id('plannedSessions'), expectedRevision: v.number() },
  returns: v.object({
    state: v.union(v.literal('started'), v.literal('continue_current')),
    sessionId: v.id('liveSessions'),
  }),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const plan = await ctx.db.get(args.plannedSessionId);
    if (!plan || plan.profileId !== profile._id || plan.status === 'dismissed')
      throw new ConvexError('Plan not found.');
    if (plan.status === 'started' && plan.liveSessionId)
      return { state: 'started' as const, sessionId: plan.liveSessionId };
    if (!Number.isInteger(args.expectedRevision) || args.expectedRevision !== plan.revision)
      throw new ConvexError('Plan changed. Review the latest revision before starting.');
    const current = await activeSession(ctx, profile._id);
    if (current) return { state: 'continue_current' as const, sessionId: current._id };
    const resolved = await validatePlannedExercises(ctx, profile._id, plan.exercises);
    const now = Date.now();
    const sessionId = await ctx.db.insert('liveSessions', {
      profileId: profile._id,
      status: 'active',
      activeProcess: null,
      startedAt: now,
      sourcePlannedSessionId: plan._id,
      sourcePlannedSessionRevision: plan.revision,
    });
    await closeChapterForSession(ctx, profile._id, sessionId, now, 'session_started');
    let first: Id<'liveSessionExercises'> | undefined;
    for (const [position, entry] of plan.exercises.entries()) {
      const { exercise, recipeKey } = resolved[position];
      const id = await ctx.db.insert('liveSessionExercises', {
        sessionId,
        profileId: profile._id,
        addedAt: now,
        position,
        exerciseCatalogId: exercise._id,
        exerciseName: exercise.name,
        exerciseClass: exercise.exerciseClass,
        recipeKey,
        modifierCapabilities: exercise.modifierCapabilities,
        defaultSummaryFormat: exercise.defaultSummaryFormat,
        targetDefaults: entry.targets,
      });
      first ??= id;
    }
    await ctx.db.patch(sessionId, { activeSessionExerciseId: first });
    await ctx.db.patch(plan._id, { status: 'started', liveSessionId: sessionId, updatedAt: now });
    return { state: 'started' as const, sessionId };
  },
});

export const loadPlanningContext = internalQuery({
  args: { profileId: v.id('profiles') },
  returns: v.object({
    choices: v.array(
      v.object({
        exerciseCatalogId: v.id('exerciseCatalog'),
        name: v.string(),
        recipeKey: v.string(),
        fields: v.array(v.string()),
      }),
    ),
    plans: v.array(
      v.object({
        plannedSessionId: v.id('plannedSessions'),
        title: v.string(),
        revision: v.number(),
        exercises: v.array(plannedExerciseValidator),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const catalog = await ctx.db
      .query('exerciseCatalog')
      .withIndex('by_supported_in_live_session', (q) => q.eq('isSupportedInLiveSession', true))
      .take(120);
    const choices = [];
    for (const exercise of catalog) {
      try {
        const { recipeKey } = await supportedPlanningExercise(ctx, args.profileId, exercise._id);
        choices.push({
          exerciseCatalogId: exercise._id,
          name: exercise.name,
          recipeKey,
          fields: getRecipeFieldDefinitions(recipeKey).map((field) => field.key),
        });
      } catch {
        /* unavailable under the viewer's current constraints */
      }
    }
    const plans = await ctx.db
      .query('plannedSessions')
      .withIndex('by_profile_status_time', (q) =>
        q.eq('profileId', args.profileId).eq('status', 'ready'),
      )
      .order('desc')
      .take(5);
    return {
      choices,
      plans: plans.map((plan) => ({
        plannedSessionId: plan._id,
        title: plan.title,
        revision: plan.revision,
        exercises: plan.exercises,
      })),
    };
  },
});

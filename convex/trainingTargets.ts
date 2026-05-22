import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { requireViewerProfile } from './profiles';
import { targetRuleValidator } from './targetValidators';
import { emptyTargetProgress, evaluateTargetProgress, isEligibleTargetEvidence } from '../domains/goals/target-evaluation';

type TargetDoc = Doc<'trainingTargets'>;
type ActivityLog = Doc<'activityLogs'>;

export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const targets = args.includeArchived
      ? await ctx.db.query('trainingTargets').withIndex('by_profile_id_and_ends_at', q => q.eq('profileId', profile._id)).collect()
      : await collectVisibleTargets(ctx, profile._id);
    return targets.sort((a, b) => statusRank(a.status) - statusRank(b.status) || b.updatedAt - a.updatedAt);
  },
});

export const create = mutation({
  args: {
    endsAt: v.number(),
    notes: v.optional(v.string()),
    previewText: v.string(),
    rule: targetRuleValidator,
    startsAt: v.optional(v.number()),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const now = Date.now();
    const startsAt = args.startsAt ?? now;
    validateTargetInput({ ...args, startsAt });
    const initialProgress = emptyTargetProgress(args.rule);
    const targetId = await ctx.db.insert('trainingTargets', {
      createdAt: now,
      endsAt: args.endsAt,
      ...(args.notes?.trim() ? { notes: args.notes.trim() } : {}),
      previewText: args.previewText.trim(),
      profileId: profile._id,
      progressSummary: initialProgress,
      rule: args.rule,
      startsAt,
      status: 'active',
      title: args.title.trim(),
      updatedAt: now,
    });
    await evaluateTargetById(ctx, targetId, now);
    return await ctx.db.get(targetId);
  },
});

export const completeManually = mutation({
  args: { completionNote: v.optional(v.string()), targetId: v.id('trainingTargets') },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const target = await getOwnedTarget(ctx, args.targetId, profile._id);
    const now = Date.now();
    await ctx.db.patch(target._id, {
      completedAt: now,
      completionNote: args.completionNote?.trim() || undefined,
      completionSource: 'manual',
      status: 'completed',
      updatedAt: now,
    });
    return await ctx.db.get(target._id);
  },
});

export const archive = mutation({
  args: { targetId: v.id('trainingTargets') },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const target = await getOwnedTarget(ctx, args.targetId, profile._id);
    const now = Date.now();
    await ctx.db.patch(target._id, { archivedAt: now, status: 'archived', updatedAt: now });
    return { archived: true };
  },
});

export const recompute = mutation({
  args: { targetId: v.id('trainingTargets') },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const target = await getOwnedTarget(ctx, args.targetId, profile._id);
    return await evaluateTargetById(ctx, target._id, Date.now());
  },
});

export async function evaluateActiveTargetsForProfile(ctx: MutationCtx, profileId: Id<'profiles'>, now = Date.now()) {
  const targets = await ctx.db
    .query('trainingTargets')
    .withIndex('by_profile_id_and_status', q => q.eq('profileId', profileId).eq('status', 'active'))
    .collect();

  for (const target of targets) {
    await evaluateTarget(ctx, target, now);
  }
}

async function collectVisibleTargets(ctx: QueryCtx, profileId: Id<'profiles'>) {
  const statuses: TargetDoc['status'][] = ['active', 'completed', 'missed'];
  const groups = await Promise.all(
    statuses.map(status => ctx.db.query('trainingTargets').withIndex('by_profile_id_and_status', q => q.eq('profileId', profileId).eq('status', status)).collect()),
  );
  return groups.flat();
}

async function getOwnedTarget(ctx: QueryCtx | MutationCtx, targetId: Id<'trainingTargets'>, profileId: Id<'profiles'>) {
  const target = await ctx.db.get(targetId);
  if (!target || target.profileId !== profileId) throw new ConvexError('Goal not found.');
  return target;
}

async function evaluateTargetById(ctx: MutationCtx, targetId: Id<'trainingTargets'>, now: number) {
  const target = await ctx.db.get(targetId);
  if (!target) throw new ConvexError('Goal not found.');
  return await evaluateTarget(ctx, target, now);
}

async function evaluateTarget(ctx: MutationCtx, target: TargetDoc, now: number) {
  if (target.status !== 'active') return target;
  const logs = await queryEvidenceLogs(ctx, target);
  const result = evaluateTargetProgress(target, logs, now);
  const patch: Partial<TargetDoc> = { lastEvaluatedAt: now, progressSummary: result.progressSummary, updatedAt: now };
  if (result.completed) {
    patch.completedAt = now;
    patch.completionSource = 'verified';
    patch.status = 'completed';
    patch.verifiedSnapshot = result.verifiedSnapshot
      ? {
          ...result.verifiedSnapshot,
          evidenceActivityLogIds: result.verifiedSnapshot.evidenceActivityLogIds as Id<'activityLogs'>[],
        }
      : undefined;
  } else if (now > target.endsAt) {
    patch.missedAt = now; patch.status = 'missed';
  }
  await ctx.db.patch(target._id, patch);
  return await ctx.db.get(target._id);
}

async function queryEvidenceLogs(ctx: MutationCtx, target: TargetDoc) {
  const base = target.rule.exerciseCatalogId
    ? await ctx.db.query('activityLogs').withIndex('by_profile_id_and_exercise_catalog_id_and_logged_at', q =>
        q.eq('profileId', target.profileId).eq('exerciseCatalogId', target.rule.exerciseCatalogId as Id<'exerciseCatalog'>).gte('loggedAt', target.startsAt).lte('loggedAt', target.endsAt),
      ).collect()
    : await ctx.db.query('activityLogs').withIndex('by_profile_id_and_logged_at', q =>
        q.eq('profileId', target.profileId).gte('loggedAt', target.startsAt).lte('loggedAt', target.endsAt),
      ).collect();
  return base.filter(isEligibleTargetEvidence);
}

function statusRank(status: TargetDoc['status']) { return status === 'active' ? 0 : status === 'completed' ? 1 : status === 'missed' ? 2 : 3; }

function validateTargetInput(args: { endsAt: number; notes?: string; previewText: string; rule: TargetDoc['rule']; startsAt: number; title: string }) {
  if (!args.title.trim() || args.title.length > 80) throw new ConvexError('Goal title must be 1-80 characters.');
  if (!args.previewText.trim() || args.previewText.length > 180) throw new ConvexError('Goal preview must be 1-180 characters.');
  if (args.notes && args.notes.length > 500) throw new ConvexError('Goal notes must be 500 characters or fewer.');
  if (!Number.isFinite(args.startsAt) || !Number.isFinite(args.endsAt) || args.endsAt <= args.startsAt) throw new ConvexError('Goal needs a valid time boundary.');
  if (!Number.isFinite(args.rule.threshold) || args.rule.threshold <= 0) throw new ConvexError('Goal threshold must be positive.');
  if ((args.rule.metricKind !== 'sessionCount') !== Boolean(args.rule.exerciseCatalogId)) throw new ConvexError('Exercise goals need an exercise; session goals cannot have one.');
}

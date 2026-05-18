import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, query, mutation } from './_generated/server';
import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';

const MODEL_NAME = process.env.REED_PROFILE_INSIGHT_MODEL ?? 'gemini-2.5-flash-lite';
const DAY_MS = 24 * 60 * 60 * 1000;

type InsightReason = 'daily_refresh' | 'session_ended' | 'profile_updated' | 'body_updated';

export const getCurrent = query({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    return await ctx.db
      .query('profileInsights')
      .withIndex('by_profile_id', q => q.eq('profileId', profile._id))
      .first();
  },
});

export const ensureFresh = mutation({
  args: { clientNow: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const insight = await getInsight(ctx, profile._id);
    const stale = !insight || insight.status !== 'active' || !isSameUtcDay(insight.generatedAt, args.clientNow);
    if (stale) {
      await markStaleForProfile(ctx, profile._id, 'daily_refresh', args.clientNow);
      await ctx.scheduler.runAfter(0, internal.profileInsightAgent.generate, { profileId: profile._id, reason: 'daily_refresh' });
    }
    return null;
  },
});

export const markStale = internalMutation({
  args: {
    profileId: v.id('profiles'),
    reason: v.union(v.literal('daily_refresh'), v.literal('session_ended'), v.literal('profile_updated'), v.literal('body_updated')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await markStaleForProfile(ctx, args.profileId, args.reason, Date.now());
    await ctx.scheduler.runAfter(0, internal.profileInsightAgent.generate, args);
    return null;
  },
});

export const saveGenerated = internalMutation({
  args: {
    profileId: v.id('profiles'),
    content: v.string(),
    modelName: v.string(),
    sourceChangedAt: v.number(),
    sourceFingerprint: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await getInsight(ctx, args.profileId);
    const patch = {
      content: args.content,
      status: 'active' as const,
      sourceFingerprint: args.sourceFingerprint,
      sourceChangedAt: args.sourceChangedAt,
      generatedAt: now,
      modelName: args.modelName,
      error: undefined,
      staleReason: undefined,
    };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert('profileInsights', { profileId: args.profileId, ...patch });
    return null;
  },
});

export const saveFailed = internalMutation({
  args: { profileId: v.id('profiles'), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await getInsight(ctx, args.profileId);
    if (existing) await ctx.db.patch(existing._id, { status: 'failed', error: args.error, generatedAt: Date.now() });
    return null;
  },
});

async function markStaleForProfile(ctx: MutationCtx, profileId: Id<'profiles'>, reason: InsightReason, changedAt: number) {
  const existing = await getInsight(ctx, profileId);
  if (!existing) {
    await ctx.db.insert('profileInsights', {
      profileId,
      content: '',
      status: 'stale',
      staleReason: reason,
      sourceFingerprint: '',
      sourceChangedAt: changedAt,
      generatedAt: 0,
      modelName: MODEL_NAME,
    });
    return;
  }
  await ctx.db.patch(existing._id, { status: 'stale', staleReason: reason, sourceChangedAt: changedAt });
}

async function getInsight(ctx: MutationCtx | QueryCtx, profileId: Id<'profiles'>) {
  return await ctx.db.query('profileInsights').withIndex('by_profile_id', q => q.eq('profileId', profileId)).first();
}

function isSameUtcDay(left: number, right: number) {
  return Math.floor(left / DAY_MS) === Math.floor(right / DAY_MS);
}

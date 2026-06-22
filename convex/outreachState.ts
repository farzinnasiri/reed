import { v } from 'convex/values';
import { internalMutation } from './_generated/server';

const DEFAULT_FIRST_REVIEW_DELAY_MS = 3 * 60 * 60 * 1000;
const DEFAULT_NEXT_REVIEW_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLAIM_BATCH = 10;

export const ensureScheduled = internalMutation({
  args: {
    now: v.optional(v.number()),
    profileId: v.id('profiles'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const existing = await ctx.db
      .query('outreachStates')
      .withIndex('by_profile_id', q => q.eq('profileId', args.profileId))
      .first();

    if (existing) {
      if (existing.status === 'paused') return null;
      await ctx.db.patch(existing._id, { status: 'active', updatedAt: now });
      return null;
    }

    await ctx.db.insert('outreachStates', {
      nextReviewAt: now + DEFAULT_FIRST_REVIEW_DELAY_MS,
      profileId: args.profileId,
      status: 'active',
      updatedAt: now,
    });
    return null;
  },
});

export const claimDue = internalMutation({
  args: { now: v.number() },
  returns: v.array(v.object({
    profileId: v.id('profiles'),
    stateId: v.id('outreachStates'),
  })),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('outreachStates')
      .withIndex('by_next_review_at', q => q.eq('status', 'active').lte('nextReviewAt', args.now))
      .take(MAX_CLAIM_BATCH);

    for (const row of rows) {
      await ctx.db.patch(row._id, {
        claimedAt: args.now,
        lastReviewedAt: args.now,
        nextReviewAt: args.now + DEFAULT_NEXT_REVIEW_DELAY_MS,
        status: 'processing',
        updatedAt: args.now,
      });
    }

    return rows.map(row => ({ profileId: row.profileId, stateId: row._id }));
  },
});

export const markCompleted = internalMutation({
  args: {
    lastOutreachAt: v.optional(v.number()),
    now: v.number(),
    stateId: v.id('outreachStates'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch = {
      claimedAt: undefined,
      error: undefined,
      status: 'active',
      updatedAt: args.now,
      ...(args.lastOutreachAt === undefined ? {} : { lastOutreachAt: args.lastOutreachAt }),
    } as const;
    await ctx.db.patch(args.stateId, patch);
    return null;
  },
});

export const markFailed = internalMutation({
  args: {
    error: v.string(),
    now: v.number(),
    stateId: v.id('outreachStates'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.stateId, {
      claimedAt: undefined,
      error: args.error.slice(0, 500),
      status: 'active',
      updatedAt: args.now,
    });
    return null;
  },
});

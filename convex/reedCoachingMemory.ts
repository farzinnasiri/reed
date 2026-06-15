import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';

const DEFAULT_RECONCILIATION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export const collectRecentlyChangedProfiles = internalQuery({
  args: {
    limit: v.number(),
    windowStartAt: v.number(),
  },
  handler: async (ctx, args): Promise<Array<Id<'profiles'>>> => {
    const profileIds = new Set<Id<'profiles'>>();

    const messages = await ctx.db
      .query('reedMessages')
      .withIndex('by_created_at', q => q.gte('createdAt', args.windowStartAt))
      .order('desc')
      .take(args.limit);
    for (const message of messages) profileIds.add(message.profileId);

    const sessions = await ctx.db
      .query('liveSessions')
      .withIndex('by_status_and_started_at', q => q.eq('status', 'ended').gte('startedAt', args.windowStartAt))
      .order('desc')
      .take(args.limit);
    for (const session of sessions) profileIds.add(session.profileId);

    return [...profileIds].slice(0, args.limit);
  },
});

export const loadReconciliationContext = internalQuery({
  args: {
    profileId: v.id('profiles'),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) return null;

    const state = await ctx.db
      .query('reedCoachingMemoryStates')
      .withIndex('by_profile_id', q => q.eq('profileId', args.profileId))
      .unique();
    const sourceFromAt = state?.lastSourceThroughAt ?? Math.max(profile._creationTime, args.now - DEFAULT_RECONCILIATION_WINDOW_MS);

    const [mentalModel, journeys, messages, summaries, coachStates, deterministicJourney, sessions] = await Promise.all([
      ctx.db
        .query('reedCoachMentalModels')
        .withIndex('by_profile_id_and_updated_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .first(),
      ctx.db
        .query('reedCoachingJourneys')
        .withIndex('by_profile_id_and_updated_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .take(20),
      ctx.db
        .query('reedMessages')
        .withIndex('by_profile_id_and_created_at', q => q.eq('profileId', args.profileId).gte('createdAt', sourceFromAt))
        .order('asc')
        .take(80),
      ctx.db
        .query('reedMemorySummaries')
        .withIndex('by_profile_id_and_created_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .take(3),
      ctx.db
        .query('reedCoachStates')
        .withIndex('by_profile_id_and_updated_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .take(3),
      ctx.db
        .query('reedJourneySnapshots')
        .withIndex('by_profile_id_and_created_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .first(),
      ctx.db
        .query('liveSessions')
        .withIndex('by_profile_id_and_status_and_started_at', q => q.eq('profileId', args.profileId).eq('status', 'ended').gte('startedAt', sourceFromAt))
        .order('desc')
        .take(12),
    ]);

    const sourceThroughAt = Math.max(
      sourceFromAt,
      ...messages.map(message => message.createdAt),
      ...sessions.map(session => session.endedAt ?? session.startedAt),
    );

    return {
      coachStates: coachStates.map(formatCoachState),
      deterministicJourney: deterministicJourney ? {
        currentState: deterministicJourney.currentState,
        renderedContext: deterministicJourney.renderedContext,
        trajectory: deterministicJourney.trajectory,
        watchouts: deterministicJourney.watchouts,
      } : null,
      journeys: journeys.map(formatJourney),
      mentalModel: mentalModel?.content ?? null,
      messages: messages.map(formatMessage),
      profile: {
        displayName: profile.displayName ?? null,
        email: profile.email,
        id: profile._id,
      },
      sessions: sessions.map(session => ({
        durationMin: session.endedAt ? Math.round((session.endedAt - session.startedAt) / 60000) : null,
        endedAt: session.endedAt ?? null,
        id: session._id,
        startedAt: session.startedAt,
        userNotes: session.userNotes?.trim() || null,
      })),
      sourceFromAt,
      sourceThroughAt,
      latestSourceFingerprint: state?.lastSourceFingerprint ?? null,
      summaries: summaries.map(summary => ({
        content: summary.content,
        createdAt: summary.createdAt,
      })),
    };
  },
});

export const saveReconciliationResult = internalMutation({
  args: {
    completedAt: v.number(),
    journeys: v.array(v.object({
      confidence: v.number(),
      slug: v.string(),
      status: v.union(v.literal('active'), v.literal('background'), v.literal('dormant'), v.literal('archived')),
      strength: v.number(),
      summary: v.string(),
      title: v.string(),
    })),
    mentalModel: v.string(),
    modelName: v.string(),
    modelProvider: v.string(),
    profileId: v.id('profiles'),
    promptHash: v.string(),
    sourceFingerprint: v.string(),
    sourceThroughAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = args.completedAt;
    await ctx.db.insert('reedCoachMentalModels', {
      content: args.mentalModel,
      createdAt: now,
      modelName: args.modelName,
      modelProvider: args.modelProvider,
      profileId: args.profileId,
      promptHash: args.promptHash,
      sourceFingerprint: args.sourceFingerprint,
      updatedAt: now,
    });

    for (const journey of args.journeys) {
      const existing = await ctx.db
        .query('reedCoachingJourneys')
        .withIndex('by_profile_id_and_slug', q => q.eq('profileId', args.profileId).eq('slug', journey.slug))
        .unique();
      const patch = {
        confidence: clampScore(journey.confidence),
        lastEvidenceAt: args.sourceThroughAt,
        status: journey.status,
        strength: clampScore(journey.strength),
        summary: journey.summary.slice(0, 1200),
        title: journey.title.slice(0, 80),
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert('reedCoachingJourneys', {
          ...patch,
          createdAt: now,
          profileId: args.profileId,
          slug: journey.slug,
        });
      }
    }

    await upsertReconciliationState(ctx, {
      error: undefined,
      lastReconciledAt: now,
      lastSourceFingerprint: args.sourceFingerprint,
      lastSourceThroughAt: args.sourceThroughAt,
      lastStatus: 'completed',
      profileId: args.profileId,
    });
  },
});

export const saveReconciliationFailure = internalMutation({
  args: {
    error: v.string(),
    failedAt: v.number(),
    profileId: v.id('profiles'),
    sourceFingerprint: v.string(),
    sourceThroughAt: v.number(),
  },
  handler: async (ctx, args) => {
    await upsertReconciliationState(ctx, {
      error: args.error,
      lastReconciledAt: args.failedAt,
      lastSourceFingerprint: args.sourceFingerprint,
      lastSourceThroughAt: args.sourceThroughAt,
      lastStatus: 'failed',
      profileId: args.profileId,
    });
  },
});

export const loadPromptMemory = internalQuery({
  args: {
    profileId: v.id('profiles'),
  },
  handler: async (ctx, args) => {
    const mentalModel = await ctx.db
      .query('reedCoachMentalModels')
      .withIndex('by_profile_id_and_updated_at', q => q.eq('profileId', args.profileId))
      .order('desc')
      .first();
    const journeys = await ctx.db
      .query('reedCoachingJourneys')
      .withIndex('by_profile_id_and_updated_at', q => q.eq('profileId', args.profileId))
      .order('desc')
      .take(12);
    return {
      journeys: journeys.map(formatJourney),
      mentalModel: mentalModel?.content ?? null,
    };
  },
});

function formatMessage(message: Doc<'reedMessages'>) {
  return {
    content: message.content,
    createdAt: message.createdAt,
    role: message.role,
    source: message.source,
  };
}

function formatCoachState(state: Doc<'reedCoachStates'>) {
  return {
    content: state.content,
    updatedAt: state.updatedAt,
  };
}

function formatJourney(journey: Doc<'reedCoachingJourneys'>) {
  return {
    confidence: journey.confidence,
    slug: journey.slug,
    status: journey.status,
    strength: journey.strength,
    summary: journey.summary,
    title: journey.title,
    updatedAt: journey.updatedAt,
  };
}

async function upsertReconciliationState(
  ctx: MutationCtx,
  args: {
    error?: string;
    lastReconciledAt: number;
    lastSourceFingerprint: string;
    lastSourceThroughAt: number;
    lastStatus: 'completed' | 'failed';
    profileId: Id<'profiles'>;
  },
) {
  const existing = await ctx.db
    .query('reedCoachingMemoryStates')
    .withIndex('by_profile_id', q => q.eq('profileId', args.profileId))
    .unique();
  const patch = {
    error: args.error,
    lastReconciledAt: args.lastReconciledAt,
    lastSourceFingerprint: args.lastSourceFingerprint,
    lastSourceThroughAt: args.lastSourceThroughAt,
    lastStatus: args.lastStatus,
  };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert('reedCoachingMemoryStates', {
      ...patch,
      profileId: args.profileId,
    });
  }
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

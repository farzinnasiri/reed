import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';

const DEFAULT_PROMPT_KEY = 'reed_chat_system';
const KNOWN_PROMPT_KEYS = [
  DEFAULT_PROMPT_KEY,
  'reed_memory_summary_system',
  'reed_coach_state_system',
  'reed_coaching_memory_system',
  'reed_context_agent_system',
];
const MAX_PROMPT_VERSIONS = 50;

const promptVersionValidator = v.object({
  _id: v.id('reedPromptVersions'),
  _creationTime: v.number(),
  content: v.string(),
  contentHash: v.string(),
  createdAt: v.number(),
  key: v.string(),
  status: v.union(v.literal('active'), v.literal('archived')),
  updatedAt: v.number(),
  version: v.number(),
});

function assertAdmin(adminSecret: string) {
  const expectedSecret = process.env.REED_CONTROL_PANEL_SECRET;
  if (!expectedSecret || adminSecret !== expectedSecret) {
    throw new ConvexError('Prompt admin access is not enabled for this deployment.');
  }
}

function normalizePromptKey(key: string | undefined) {
  const normalized = (key ?? DEFAULT_PROMPT_KEY).trim();
  if (!/^[a-z][a-z0-9_:-]{2,80}$/.test(normalized)) {
    throw new ConvexError('Prompt key must be a lowercase identifier.');
  }
  return normalized;
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return `h${(hash >>> 0).toString(16)}`;
}

async function upsertPromptVersion(ctx: MutationCtx, args: { key: string; content: string }) {
  const now = Date.now();
  const current = await ctx.db
    .query('reedPromptVersions')
    .withIndex('by_key_and_status', q => q.eq('key', args.key).eq('status', 'active'))
    .order('desc')
    .first();
  if (current?.content === args.content) return current._id;
  if (current) await ctx.db.patch(current._id, { status: 'archived', updatedAt: now });

  return await ctx.db.insert('reedPromptVersions', {
    key: args.key,
    content: args.content,
    status: 'active',
    version: (current?.version ?? 0) + 1,
    contentHash: simpleHash(args.content),
    createdAt: now,
    updatedAt: now,
  });
}

export const listPromptKeys = query({
  args: { adminSecret: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const rows = await ctx.db.query('reedPromptVersions').take(200);
    const keys = new Set(rows.map(row => row.key));
    for (const key of KNOWN_PROMPT_KEYS) keys.add(key);
    return [...keys].sort();
  },
});

export const listReedProfiles = query({
  args: { adminSecret: v.string() },
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const profiles = await ctx.db.query('profiles').take(200);
    return profiles
      .map(profile => ({
        _id: profile._id,
        displayName: profile.displayName ?? null,
        email: profile.email,
        updatedAt: profile.updatedAt,
      }))
      .sort((left, right) => left.email.localeCompare(right.email));
  },
});

export const getReedDebugContext = query({
  args: { adminSecret: v.string(), profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new ConvexError('Profile not found.');

    const thread = await ctx.db
      .query('reedThreads')
      .withIndex('by_profile_id_and_status', q => q.eq('profileId', args.profileId).eq('status', 'active'))
      .unique();
    const [coachState, mentalModel, journeys, summaries, journeySnapshot, recentMessages] = await Promise.all([
      ctx.db
        .query('reedCoachStates')
        .withIndex('by_profile_id_and_updated_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .first(),
      ctx.db
        .query('reedCoachMentalModels')
        .withIndex('by_profile_id_and_updated_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .first(),
      ctx.db
        .query('reedCoachingJourneys')
        .withIndex('by_profile_id_and_updated_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .take(12),
      ctx.db
        .query('reedMemorySummaries')
        .withIndex('by_profile_id_and_created_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .take(5),
      ctx.db
        .query('reedJourneySnapshots')
        .withIndex('by_profile_id_and_created_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .first(),
      ctx.db
        .query('reedMessages')
        .withIndex('by_profile_id_and_created_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .take(20),
    ]);

    return {
      loadedAt: Date.now(),
      profile: {
        _id: profile._id,
        displayName: profile.displayName ?? null,
        email: profile.email,
        updatedAt: profile.updatedAt,
      },
      activeThread: thread ? {
        _id: thread._id,
        agendaItems: thread.agendaItems ?? [],
        compactedThroughMessageId: thread.compactedThroughMessageId ?? null,
        lastMessageAt: thread.lastMessageAt ?? null,
        updatedAt: thread.updatedAt,
      } : null,
      coachState: coachState ? {
        _id: coachState._id,
        content: coachState.content,
        modelName: coachState.modelName,
        promptHash: coachState.promptHash,
        updatedAt: coachState.updatedAt,
        updatedThroughMessageId: coachState.updatedThroughMessageId,
      } : null,
      mentalModel: mentalModel ? {
        _id: mentalModel._id,
        content: mentalModel.content,
        modelName: mentalModel.modelName,
        promptHash: mentalModel.promptHash,
        sourceFingerprint: mentalModel.sourceFingerprint,
        updatedAt: mentalModel.updatedAt,
      } : null,
      journeys: journeys.map(journey => ({
        _id: journey._id,
        confidence: journey.confidence,
        lastEvidenceAt: journey.lastEvidenceAt,
        slug: journey.slug,
        status: journey.status,
        strength: journey.strength,
        summary: journey.summary,
        title: journey.title,
        updatedAt: journey.updatedAt,
      })),
      summaries: summaries.map(summary => ({
        _id: summary._id,
        content: summary.content,
        createdAt: summary.createdAt,
        modelName: summary.modelName,
        promptHash: summary.promptHash ?? null,
        sourceFromMessageId: summary.sourceFromMessageId ?? null,
        sourceThroughMessageId: summary.sourceThroughMessageId,
      })),
      journeySnapshot: journeySnapshot ? {
        _id: journeySnapshot._id,
        createdAt: journeySnapshot.createdAt,
        currentState: journeySnapshot.currentState,
        renderedContext: journeySnapshot.renderedContext,
        trajectory: journeySnapshot.trajectory,
        trigger: journeySnapshot.trigger,
        watchouts: journeySnapshot.watchouts,
      } : null,
      recentMessages: recentMessages
        .slice()
        .reverse()
        .map(message => ({
          _id: message._id,
          completedAt: message.completedAt ?? null,
          content: message.content,
          createdAt: message.createdAt,
          role: message.role,
          source: message.source,
          status: message.status,
        })),
    };
  },
});

export const getActivePrompt = query({
  args: { adminSecret: v.string(), key: v.optional(v.string()) },
  returns: v.union(promptVersionValidator, v.null()),
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const key = normalizePromptKey(args.key);
    return await ctx.db
      .query('reedPromptVersions')
      .withIndex('by_key_and_status', q => q.eq('key', key).eq('status', 'active'))
      .order('desc')
      .first();
  },
});

export const listPromptVersions = query({
  args: { adminSecret: v.string(), key: v.optional(v.string()) },
  returns: v.array(promptVersionValidator),
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const key = normalizePromptKey(args.key);
    return await ctx.db
      .query('reedPromptVersions')
      .withIndex('by_key_and_version', q => q.eq('key', key))
      .order('desc')
      .take(MAX_PROMPT_VERSIONS);
  },
});

export const saveActivePrompt = mutation({
  args: { adminSecret: v.string(), content: v.string(), key: v.optional(v.string()) },
  returns: v.id('reedPromptVersions'),
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const key = normalizePromptKey(args.key);
    const content = args.content.trim();
    if (content.length < 100) throw new ConvexError('Prompt content is too short.');
    return await upsertPromptVersion(ctx, { key, content });
  },
});

export const rollbackPrompt = mutation({
  args: { adminSecret: v.string(), key: v.optional(v.string()), version: v.number() },
  returns: v.id('reedPromptVersions'),
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const key = normalizePromptKey(args.key);
    const target = await ctx.db
      .query('reedPromptVersions')
      .withIndex('by_key_and_version', q => q.eq('key', key).eq('version', args.version))
      .unique();
    if (!target) throw new ConvexError('Prompt version was not found.');
    return await upsertPromptVersion(ctx, { key, content: target.content });
  },
});

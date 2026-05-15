import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';

const DEFAULT_REED_SYSTEM_PROMPT = `You are Reed, a precise training coach inside a fitness app.
You are warm, direct, and concise. You help the user understand training, momentum, recovery, and next focus.
V1 is read-only: you cannot change workouts, profile, goals, plans, or app data.
If data is missing or context is weak, say so plainly and ask one narrow follow-up.
Use the profile and memory context when present. Do not pretend to know facts not in context.`;

const HOT_AFTER_MS = 5 * 60 * 1000;
const WARM_AFTER_MS = 60 * 60 * 1000;
const HOT_RECENT_MESSAGE_COUNT = 8;
const WARM_RECENT_MESSAGE_COUNT = 4;
const COLD_RECENT_MESSAGE_COUNT = 0;
const COMPACT_AFTER_MESSAGE_COUNT = 8;
const DEFAULT_PROMPT_KEY = 'reed_chat_system';
const DEFAULT_SUMMARY_PROMPT_KEY = 'reed_memory_summary_system';
const DEFAULT_REED_SUMMARY_PROMPT = `Update the durable Reed memory summary for one ongoing user chat.
Preserve: user goals and constraints, coaching decisions, open questions, cautions, preferences, and what Reed should remember next time.
Discard: greetings, filler, exact phrasing, transient small talk, and implementation details.
Do not invent facts. If information is uncertain, mark it as uncertain.
Keep the summary compact and useful for future coaching continuity. Maximum 220 words.`;

const composerSourceValidator = v.union(v.literal('quick-action'), v.literal('typed'), v.literal('voice'));
const routeValidator = v.union(v.literal('coach_direct'), v.literal('training_tools'), v.literal('refuse_readonly'));
const reentryStateValidator = v.union(v.literal('hot'), v.literal('warm'), v.literal('cold'));
type ReedRoute = 'coach_direct' | 'training_tools' | 'refuse_readonly';

export const getOrCreateThread = mutation({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    return await getOrCreateActiveThread(ctx, profile._id, Date.now());
  },
});

export const listMessages = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const thread = await getActiveThread(ctx, profile._id);
    if (!thread) return { hasMore: false, messages: [] };

    const limit = Math.min(Math.max(args.limit ?? 40, 1), 200);
    const rows = await ctx.db
      .query('reedMessages')
      .withIndex('by_thread_id_and_created_at', q => q.eq('threadId', thread._id))
      .order('desc')
      .take(limit + 1);

    return {
      hasMore: rows.length > limit,
      messages: rows.slice(0, limit).reverse(),
    };
  },
});

export const getPresence = query({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const thread = await getActiveThread(ctx, profile._id);
    const now = Date.now();
    const lastMessageAt = thread?.lastMessageAt ?? null;
    const reentryState = classifyReentry(lastMessageAt, now).state;
    return { lastMessageAt, reentryState };
  },
});

export const upsertActivePrompt = mutation({
  args: { adminSecret: v.string(), content: v.string(), key: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.REED_PROMPT_ADMIN_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new ConvexError('Prompt editing is not enabled for this deployment.');
    }
    const key = args.key ?? DEFAULT_PROMPT_KEY;
    const content = args.content.trim();
    if (content.length < 100) throw new ConvexError('Prompt content is too short.');

    const now = Date.now();
    const current = await ctx.db
      .query('reedPromptVersions')
      .withIndex('by_key_and_status', q => q.eq('key', key).eq('status', 'active'))
      .order('desc')
      .first();
    if (current?.content === content) return current._id;
    if (current) await ctx.db.patch(current._id, { status: 'archived', updatedAt: now });

    return await ctx.db.insert('reedPromptVersions', {
      key,
      content,
      status: 'active',
      version: (current?.version ?? 0) + 1,
      contentHash: simpleHash(content),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const sendMessage = mutation({
  args: {
    clientNonce: v.optional(v.string()),
    clientNow: v.optional(v.number()),
    clientTimeZone: v.optional(v.string()),
    content: v.string(),
    source: composerSourceValidator,
  },
  handler: async (ctx, args) => {
    const content = args.content.trim();
    if (!content) throw new ConvexError('Message cannot be empty.');
    if (content.length > 8000) throw new ConvexError('Message is too long.');

    const profile = await requireViewerProfile(ctx);
    const now = Date.now();

    if (args.clientNonce) {
      const existing = await ctx.db
        .query('reedMessages')
        .withIndex('by_profile_id_and_client_nonce', q => q.eq('profileId', profile._id).eq('clientNonce', args.clientNonce))
        .unique();
      if (existing) return { threadId: existing.threadId, userMessageId: existing._id, assistantMessageId: null };
    }

    const thread = await getOrCreateActiveThread(ctx, profile._id, now);
    const priorLastMessageAt = thread.lastMessageAt ?? null;
    const { state, recentTurnCount } = classifyReentry(priorLastMessageAt, now);
    const route = routeForMessage(content);

    const userMessageId = await ctx.db.insert('reedMessages', {
      threadId: thread._id,
      profileId: profile._id,
      role: 'user',
      content,
      source: args.source,
      status: 'sent',
      createdAt: now,
      completedAt: now,
      clientNonce: args.clientNonce,
    });
    const assistantMessageId = await ctx.db.insert('reedMessages', {
      threadId: thread._id,
      profileId: profile._id,
      role: 'assistant',
      content: '',
      source: 'system',
      status: 'pending',
      createdAt: now + 1,
    });
    await ctx.db.patch(thread._id, { updatedAt: now, lastMessageAt: now });

    await ctx.scheduler.runAfter(0, internal.reedAgent.runAssistant, {
      assistantMessageId,
      clientNow: args.clientNow ?? now,
      clientTimeZone: args.clientTimeZone,
      priorLastMessageAt,
      recentTurnCount,
      reentryState: state,
      route,
      threadId: thread._id,
      userMessageId,
    });

    return { threadId: thread._id, userMessageId, assistantMessageId };
  },
});

export const loadAssistantContext = internalQuery({
  args: {
    assistantMessageId: v.id('reedMessages'),
    clientNow: v.number(),
    clientTimeZone: v.optional(v.string()),
    priorLastMessageAt: v.union(v.number(), v.null()),
    recentTurnCount: v.number(),
    reentryState: reentryStateValidator,
    route: routeValidator,
    threadId: v.id('reedThreads'),
    userMessageId: v.id('reedMessages'),
  },
  handler: async (ctx, args): Promise<{
    clientNow: number;
    clientTimeZone?: string;
    priorLastMessageAt: number | null;
    route: ReedRoute;
    reentryState: 'hot' | 'warm' | 'cold';
    thread: Doc<'reedThreads'>;
    profile: Doc<'profiles'>;
    userMessage: Doc<'reedMessages'>;
    assistantMessage: Doc<'reedMessages'>;
    prompt: { _id: Id<'reedPromptVersions'> | null; key: string; content: string; contentHash: string; version: number };
    journeySummary: string | null;
    memorySummary: string | null;
    recentMessages: Doc<'reedMessages'>[];
  }> => {
    const thread = await ctx.db.get(args.threadId);
    const userMessage = await ctx.db.get(args.userMessageId);
    const assistantMessage = await ctx.db.get(args.assistantMessageId);
    if (!thread || !userMessage || !assistantMessage) throw new ConvexError('Reed assistant context is incomplete.');

    const profile = await ctx.db.get(thread.profileId);
    if (!profile) throw new ConvexError('Reed profile is missing.');

    const journey: Doc<'reedJourneySnapshots'> | null = await ctx.runQuery(internal.reedJourney.latestForProfile, { profileId: thread.profileId });
    const promptVersion = await ctx.db
      .query('reedPromptVersions')
      .withIndex('by_key_and_status', q => q.eq('key', DEFAULT_PROMPT_KEY).eq('status', 'active'))
      .order('desc')
      .first();
    const summary = thread.activeSummaryId ? await ctx.db.get(thread.activeSummaryId) : null;
    const recentMessages = await loadRecentMessages(ctx, thread._id, args.recentTurnCount, userMessage._id);

    return {
      clientNow: args.clientNow,
      clientTimeZone: args.clientTimeZone,
      priorLastMessageAt: args.priorLastMessageAt,
      route: args.route,
      reentryState: args.reentryState,
      thread,
      profile,
      userMessage,
      assistantMessage,
      prompt: promptVersion ?? {
        _id: null,
        key: DEFAULT_PROMPT_KEY,
        content: DEFAULT_REED_SYSTEM_PROMPT,
        contentHash: simpleHash(DEFAULT_REED_SYSTEM_PROMPT),
        version: 0,
      },
      journeySummary: journey?.renderedContext ?? null,
      memorySummary: summary?.content ?? null,
      recentMessages,
    };
  },
});

export const completeAssistantMessage = internalMutation({
  args: {
    assistantMessageId: v.id('reedMessages'),
    content: v.string(),
    completedAt: v.number(),
    threadId: v.id('reedThreads'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assistantMessageId, {
      content: args.content,
      status: 'sent',
      completedAt: args.completedAt,
    });
    await ctx.db.patch(args.threadId, { updatedAt: args.completedAt, lastMessageAt: args.completedAt });

    const unsummarized = await loadUnsummarizedMessages(ctx, args.threadId, COMPACT_AFTER_MESSAGE_COUNT + 1);
    if (unsummarized.length >= COMPACT_AFTER_MESSAGE_COUNT) {
      await ctx.scheduler.runAfter(0, internal.reedAgent.compactThread, { threadId: args.threadId });
    }
  },
});

export const failAssistantMessage = internalMutation({
  args: {
    assistantMessageId: v.id('reedMessages'),
    error: v.string(),
    failedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assistantMessageId, {
      content: 'I hit a system issue while thinking. Try again in a moment.',
      status: 'failed',
      completedAt: args.failedAt,
      error: args.error,
    });
  },
});

export const loadCompactionContext = internalQuery({
  args: { beforeMessageId: v.optional(v.id('reedMessages')), threadId: v.id('reedThreads') },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError('Thread not found.');
    const profile = await ctx.db.get(thread.profileId);
    if (!profile) throw new ConvexError('Profile not found.');
    const activeSummary = thread.activeSummaryId ? await ctx.db.get(thread.activeSummaryId) : null;
    const beforeMessage = args.beforeMessageId ? await ctx.db.get(args.beforeMessageId) : null;
    const messages = await loadUnsummarizedMessages(ctx, thread._id, 40, beforeMessage?.createdAt);
    const promptVersion = await ctx.db
      .query('reedPromptVersions')
      .withIndex('by_key_and_status', q => q.eq('key', DEFAULT_SUMMARY_PROMPT_KEY).eq('status', 'active'))
      .order('desc')
      .first();
    return {
      thread,
      profile,
      activeSummary,
      messages,
      prompt: promptVersion ?? {
        _id: null,
        key: DEFAULT_SUMMARY_PROMPT_KEY,
        content: DEFAULT_REED_SUMMARY_PROMPT,
        contentHash: simpleHash(DEFAULT_REED_SUMMARY_PROMPT),
        version: 0,
      },
    };
  },
});

export const saveMemorySummary = internalMutation({
  args: {
    content: v.string(),
    modelName: v.string(),
    modelProvider: v.string(),
    promptHash: v.optional(v.string()),
    sourceFromMessageId: v.optional(v.id('reedMessages')),
    sourceThroughMessageId: v.id('reedMessages'),
    threadId: v.id('reedThreads'),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError('Thread not found.');
    const now = Date.now();
    const summaryId = await ctx.db.insert('reedMemorySummaries', {
      threadId: args.threadId,
      profileId: thread.profileId,
      content: args.content,
      sourceFromMessageId: args.sourceFromMessageId,
      sourceThroughMessageId: args.sourceThroughMessageId,
      modelProvider: args.modelProvider,
      modelName: args.modelName,
      promptHash: args.promptHash,
      createdAt: now,
    });
    await ctx.db.patch(args.threadId, {
      activeSummaryId: summaryId,
      compactedThroughMessageId: args.sourceThroughMessageId,
      updatedAt: now,
    });
    return summaryId;
  },
});

async function getActiveThread(ctx: QueryCtx | MutationCtx, profileId: Id<'profiles'>) {
  return await ctx.db
    .query('reedThreads')
    .withIndex('by_profile_id_and_status', q => q.eq('profileId', profileId).eq('status', 'active'))
    .unique();
}

async function getOrCreateActiveThread(ctx: MutationCtx, profileId: Id<'profiles'>, now: number) {
  const existing = await getActiveThread(ctx, profileId);
  if (existing) return existing;
  const threadId = await ctx.db.insert('reedThreads', { profileId, status: 'active', createdAt: now, updatedAt: now });
  const created = await ctx.db.get(threadId);
  if (!created) throw new ConvexError('Could not create Reed thread.');
  return created;
}

async function loadRecentMessages(
  ctx: QueryCtx,
  threadId: Id<'reedThreads'>,
  limit: number,
  currentUserMessageId: Id<'reedMessages'>,
) {
  if (limit <= 0) return [];
  const current = await ctx.db.get(currentUserMessageId);
  if (!current) return [];
  const rows = await ctx.db
    .query('reedMessages')
    .withIndex('by_thread_id_and_created_at', q => q.eq('threadId', threadId).lt('createdAt', current.createdAt))
    .order('desc')
    .take(limit);
  return rows.reverse().filter(message => message.status === 'sent');
}

async function loadUnsummarizedMessages(ctx: QueryCtx | MutationCtx, threadId: Id<'reedThreads'>, limit: number, beforeCreatedAt?: number) {
  const thread = await ctx.db.get(threadId);
  if (!thread) return [];
  const compacted = thread.compactedThroughMessageId ? await ctx.db.get(thread.compactedThroughMessageId) : null;
  const query = ctx.db.query('reedMessages').withIndex('by_thread_id_and_created_at', q => {
    const scoped = q.eq('threadId', threadId);
    if (compacted && beforeCreatedAt !== undefined) return scoped.gt('createdAt', compacted.createdAt).lt('createdAt', beforeCreatedAt);
    if (compacted) return scoped.gt('createdAt', compacted.createdAt);
    if (beforeCreatedAt !== undefined) return scoped.lt('createdAt', beforeCreatedAt);
    return scoped;
  });
  return (await query.order('asc').take(limit)).filter(message => message.status === 'sent');
}

function classifyReentry(lastMessageAt: number | null, now: number) {
  if (!lastMessageAt) return { state: 'cold' as const, recentTurnCount: COLD_RECENT_MESSAGE_COUNT };
  const age = now - lastMessageAt;
  if (age <= HOT_AFTER_MS) return { state: 'hot' as const, recentTurnCount: HOT_RECENT_MESSAGE_COUNT };
  if (age <= WARM_AFTER_MS) return { state: 'warm' as const, recentTurnCount: WARM_RECENT_MESSAGE_COUNT };
  return { state: 'cold' as const, recentTurnCount: COLD_RECENT_MESSAGE_COUNT };
}

function routeForMessage(content: string): ReedRoute {
  const lower = content.toLowerCase();
  if (/\b(update|change|edit|delete|create|log|save)\b/.test(lower) && /\b(workout|profile|goal|plan|session|set)\b/.test(lower)) {
    return 'refuse_readonly';
  }
  if (/\b(progress|performance|exercise|workout|training|bodyweight|recovery|pr\b|personal record)\b/.test(lower)) {
    return 'training_tools';
  }
  return 'coach_direct';
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return `h${(hash >>> 0).toString(16)}`;
}

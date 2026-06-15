import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';

const DEFAULT_REED_SYSTEM_PROMPT = `You are Reed, a precise training coach inside a fitness app.
You are warm, direct, and concise. You help the user understand training, momentum, recovery, and next focus.
If the user asks you to create, edit, delete, log, save, or update app data, politely say you cannot do that from chat yet because you do not have those tools, then give the safest manual next step.
If data is missing or context is weak, say so plainly and ask one narrow follow-up.
Use the profile and memory context when present. Do not pretend to know facts not in context.`;

const HOT_AFTER_MS = 5 * 60 * 1000;
const WARM_AFTER_MS = 60 * 60 * 1000;
const HOT_RECENT_MESSAGE_COUNT = 24;
const WARM_RECENT_MESSAGE_COUNT = 4;
const COLD_RECENT_MESSAGE_COUNT = 0;
const COMPACT_AFTER_MESSAGE_COUNT = 24;
const COACH_STATE_REFRESH_AFTER_USER_MESSAGES = 4;
const MAX_REED_IMAGE_ATTACHMENTS = 5;
const MAX_REED_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_PROMPT_KEY = 'reed_chat_system';
const DEFAULT_SUMMARY_PROMPT_KEY = 'reed_memory_summary_system';
const DEFAULT_COACH_STATE_PROMPT_KEY = 'reed_coach_state_system';
const COACHING_MEMORY_PROMPT_KEY = 'reed_coaching_memory_system';
const CHECKED_IN_COACH_STATE_PROMPT_HASH = 'h7a119f49';
const CHECKED_IN_COACHING_MEMORY_PROMPT_HASH = 'hda6c67d4';
const DEFAULT_REED_SUMMARY_PROMPT = `You update Reed's compact memory of an ongoing coaching conversation.

This memory is objective continuity for a coach. It is not a transcript, not a psychological profile, not a private coaching strategy, and not an analysis of the user's personality.

<previous_summary>
{{previous_summary}}
</previous_summary>

<recent_history>
{{recent_messages}}
</recent_history>

Preserve signal: user goals, constraints, preferences, training context, real agreements, proposed plans not yet accepted, corrections, pushback, doubts, changes of direction, training-relevant life context, recovery or pain signals, recent outcomes, and open questions.

Forget noise: greetings, filler, repeated acknowledgements, small talk, exact wording unless it matters, internal tool messages, model behavior, routing, image-analysis mechanics, prompt details, and generic advice that did not change the user's plan or understanding.

Be careful with certainty. Do not turn a suggestion into an agreement. Do not turn a vague concern into a diagnosis. Do not turn old app data into the user's current preference. If something is unclear, say it is unclear. If the user pushed back, preserve the pushback.

Write compact objective history, mostly short narrative or light bullets. No therapy language. No hidden speculation about the user's personality. No private coaching posture. Maximum 220 words unless the conversation contains multiple important unresolved threads.

Write only the updated memory.`;
const DEFAULT_COACH_STATE_PROMPT = `You are Reed's private coaching observer.

Update Reed's private coaching dialogue from the previous dialogue and new evidence.

Focus on coaching posture: pressure, warmth/trust, depth, agency, certainty, what changed relationally, what to avoid, and when to reconsider. Do not try to carry the whole durable memory system; coach mental model and private coaching journeys handle broad user memory, and the chat agenda handles turn-to-turn coaching actions.

<previous_dialogue>
{{previous_coach_state}}
</previous_dialogue>

<rolling_summary>
{{rolling_summary}}
</rolling_summary>

<journey_context>
{{journey_context}}
</journey_context>

<recent_history>
{{recent_messages}}
</recent_history>

Write only Reed's updated private inner dialogue as compact first-person prose. No markdown, headings, bullets, JSON, numeric scores, persona labels, or user-facing reply. Naturally encode pressure, warmth/trust, depth, agency, certainty, what changed, the next coaching approach, what to avoid, and when to reconsider.`;
const composerSourceValidator = v.union(v.literal('quick-action'), v.literal('typed'), v.literal('voice'));
const reentryStateValidator = v.union(v.literal('hot'), v.literal('warm'), v.literal('cold'));

type StorageMetadata = {
  _id: Id<'_storage'>;
  contentType?: string;
  size: number;
};

type ReedAppTimelineEvent = {
  at: number;
  summary: string;
};

const quickActionValidator = v.object({
  id: v.string(),
  label: v.string(),
  prompt: v.string(),
  sortOrder: v.number(),
});

const DEFAULT_QUICK_ACTIONS = [
  {
    id: 'week-review',
    label: 'How did this week go?',
    prompt: 'How did this week go?',
    sortOrder: 10,
  },
  {
    id: 'next-focus',
    label: 'Next focus',
    prompt: 'What should I focus on next?',
    sortOrder: 20,
  },
  {
    id: 'check-progress',
    label: 'Check my progress',
    prompt: 'Am I improving on my recent training?',
    sortOrder: 30,
  },
] as const;

const reedImageAttachmentInputValidator = v.object({
  storageId: v.id('_storage'),
});

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

    const visibleRows = rows.filter(message => !isInternalArtifactMessage(message));
    const messages = await attachMessageImages(ctx, visibleRows.slice(0, limit).reverse());

    return {
      hasMore: rows.length > limit,
      messages,
    };
  },
});


export const listMessagesPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const thread = await getActiveThread(ctx, profile._id);
    if (!thread) {
      return {
        continueCursor: '',
        isDone: true,
        page: [],
      };
    }

    const result = await ctx.db
      .query('reedMessages')
      .withIndex('by_thread_id_and_created_at', q => q.eq('threadId', thread._id))
      .order('desc')
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await attachMessageImages(ctx, result.page.filter(message => !isInternalArtifactMessage(message))),
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

export const listQuickActions = query({
  args: {},
  returns: v.array(quickActionValidator),
  handler: async () => [...DEFAULT_QUICK_ACTIONS].sort((left, right) => left.sortOrder - right.sortOrder),
});

export const upsertActivePrompt = mutation({
  args: { adminSecret: v.string(), content: v.string(), key: v.optional(v.string()) },
  handler: async (ctx, args) => {
    assertPromptAdmin(args.adminSecret);
    const key = args.key ?? DEFAULT_PROMPT_KEY;
    const content = args.content.trim();
    if (content.length < 100) throw new ConvexError('Prompt content is too short.');

    return await upsertPromptVersion(ctx, { key, content });
  },
});

export const seedCoachStatePrompt = mutation({
  args: { content: v.string() },
  handler: async (ctx, args) => {
    const content = args.content.trim();
    if (simpleHash(content) !== CHECKED_IN_COACH_STATE_PROMPT_HASH) {
      throw new ConvexError('Coach state prompt content does not match the checked-in prompt.');
    }

    return await upsertPromptVersion(ctx, {
      key: DEFAULT_COACH_STATE_PROMPT_KEY,
      content,
    });
  },
});

export const seedCheckedInPrompt = mutation({
  args: { content: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const content = args.content.trim();
    const expectedHash = checkedInPromptHash(args.key);
    if (!expectedHash) throw new ConvexError('Prompt key is not a checked-in prompt.');
    if (simpleHash(content) !== expectedHash) {
      throw new ConvexError('Prompt content does not match the checked-in prompt.');
    }

    return await upsertPromptVersion(ctx, {
      key: args.key,
      content,
    });
  },
});

export const generateImageUploadUrl = mutation({
  args: {},
  handler: async ctx => {
    await requireViewerProfile(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendMessage = mutation({
  args: {
    attachments: v.optional(v.array(reedImageAttachmentInputValidator)),
    clientNonce: v.optional(v.string()),
    clientNow: v.optional(v.number()),
    clientTimeZone: v.optional(v.string()),
    content: v.string(),
    source: composerSourceValidator,
  },
  handler: async (ctx, args) => {
    const content = args.content.trim();
    const attachments = args.attachments ?? [];
    if (!content && attachments.length === 0) throw new ConvexError('Message cannot be empty.');
    if (content.length > 8000) throw new ConvexError('Message is too long.');
    if (attachments.length > MAX_REED_IMAGE_ATTACHMENTS) {
      throw new ConvexError(`Reed can read up to ${MAX_REED_IMAGE_ATTACHMENTS} images per message.`);
    }

    const profile = await requireViewerProfile(ctx);
    const now = Date.now();
    const attachmentMetadata = await validateImageAttachments(ctx, attachments);

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
    const userMessageContent = content || `Attached ${attachments.length} image${attachments.length === 1 ? '' : 's'}`;

    const userMessageId = await ctx.db.insert('reedMessages', {
      threadId: thread._id,
      profileId: profile._id,
      role: 'user',
      content: userMessageContent,
      source: args.source,
      status: 'sent',
      createdAt: now,
      completedAt: now,
      clientNonce: args.clientNonce,
    });
    for (let index = 0; index < attachments.length; index += 1) {
      await ctx.db.insert('reedMessageAttachments', {
        messageId: userMessageId,
        threadId: thread._id,
        profileId: profile._id,
        storageId: attachments[index].storageId,
        mediaType: 'image/jpeg',
        kind: 'image',
        status: 'pending',
        sortOrder: index,
        size: attachmentMetadata[index]?.size,
        createdAt: now,
        updatedAt: now,
      });
    }

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
      threadId: thread._id,
      userMessageId,
    });

    return { threadId: thread._id, userMessageId, assistantMessageId };
  },
});

export const retryAssistantMessage = mutation({
  args: {
    assistantMessageId: v.id('reedMessages'),
    clientNow: v.optional(v.number()),
    clientTimeZone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const assistantMessage = await ctx.db.get(args.assistantMessageId);
    if (!assistantMessage || assistantMessage.profileId !== profile._id || assistantMessage.role !== 'assistant') {
      throw new ConvexError('Reed response not found.');
    }
    if (assistantMessage.status === 'pending') {
      return { assistantMessageId: assistantMessage._id, status: 'pending' as const };
    }
    if (assistantMessage.status !== 'failed') {
      throw new ConvexError('Only failed Reed responses can be retried.');
    }

    const previousMessages = (await ctx.db
      .query('reedMessages')
      .withIndex('by_thread_id_and_created_at', q =>
        q.eq('threadId', assistantMessage.threadId).lt('createdAt', assistantMessage.createdAt),
      )
      .order('desc')
      .take(20)).filter(message => !isInternalArtifactMessage(message));
    const userMessage = previousMessages.find(message => message.role === 'user');
    if (!userMessage) throw new ConvexError('Original user message is missing.');
    const priorMessage = previousMessages.find(message => message._id !== userMessage._id && message.status === 'sent');
    const attachmentCount = await countMessageAttachments(ctx, userMessage._id);
    const now = Date.now();
    const priorLastMessageAt = priorMessage?.completedAt ?? priorMessage?.createdAt ?? null;
    const { state, recentTurnCount } = classifyReentry(priorLastMessageAt, now);

    await ctx.db.patch(assistantMessage._id, {
      content: '',
      status: 'pending',
      completedAt: undefined,
      error: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.reedAgent.runAssistant, {
      assistantMessageId: assistantMessage._id,
      clientNow: args.clientNow ?? now,
      clientTimeZone: args.clientTimeZone,
      priorLastMessageAt,
      recentTurnCount,
      reentryState: state,
      threadId: assistantMessage.threadId,
      userMessageId: userMessage._id,
    });

    return { assistantMessageId: assistantMessage._id, status: 'pending' as const };
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
    threadId: v.id('reedThreads'),
    userMessageId: v.id('reedMessages'),
  },
  handler: async (ctx, args): Promise<{
    clientNow: number;
    clientTimeZone?: string;
    priorLastMessageAt: number | null;
    reentryState: 'hot' | 'warm' | 'cold';
    thread: Doc<'reedThreads'>;
    profile: Doc<'profiles'>;
    userMessage: Doc<'reedMessages'>;
    assistantMessage: Doc<'reedMessages'>;
    prompt: { _id: Id<'reedPromptVersions'> | null; key: string; content: string; contentHash: string; version: number };
    coachState: Doc<'reedCoachStates'> | null;
    imageObservations: Array<{ attachmentId: Id<'reedMessageAttachments'>; narrative: string; sortOrder: number; status: 'analyzed' | 'failed' }>;
    appTimeline: ReedAppTimelineEvent[];
    currentAppState: string;
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
    const coachState = await getCoachStateForThread(ctx, thread._id);
    const imageObservations = await loadImageObservations(ctx, userMessage._id);
    const appTimeline = await loadRecentAppTimeline(ctx, thread.profileId, args.clientNow);

    return {
      clientNow: args.clientNow,
      clientTimeZone: args.clientTimeZone,
      priorLastMessageAt: args.priorLastMessageAt,
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
      coachState,
      imageObservations,
      appTimeline: appTimeline.events,
      currentAppState: appTimeline.currentState,
      journeySummary: journey?.renderedContext ?? null,
      memorySummary: summary?.content ?? null,
      recentMessages,
    };
  },
});

export const completeAssistantMessage = internalMutation({
  args: {
    agendaItems: v.array(v.string()),
    assistantMessageId: v.id('reedMessages'),
    content: v.string(),
    completedAt: v.number(),
    reentryState: reentryStateValidator,
    threadId: v.id('reedThreads'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assistantMessageId, {
      content: args.content,
      status: 'sent',
      completedAt: args.completedAt,
    });
    await ctx.db.patch(args.threadId, {
      agendaItems: args.agendaItems.map(item => item.trim()).filter(Boolean).map(item => item.slice(0, 160)).slice(0, 4),
      updatedAt: args.completedAt,
      lastMessageAt: args.completedAt,
    });

    const unsummarized = await loadUnsummarizedMessages(ctx, args.threadId, COMPACT_AFTER_MESSAGE_COUNT + 1);
    if (unsummarized.length >= COMPACT_AFTER_MESSAGE_COUNT) {
      await ctx.scheduler.runAfter(0, internal.reedAgent.compactThread, { threadId: args.threadId });
    }

    if (await shouldRefreshCoachState(ctx, {
      completedAssistantMessageId: args.assistantMessageId,
      reentryState: args.reentryState,
      threadId: args.threadId,
    })) {
      await ctx.scheduler.runAfter(0, internal.reedAgent.refreshCoachState, {
        sourceThroughMessageId: args.assistantMessageId,
        threadId: args.threadId,
      });
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

export const loadPendingImageAttachments = internalQuery({
  args: { messageId: v.id('reedMessages') },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new ConvexError('Message not found.');
    const attachments = await ctx.db
      .query('reedMessageAttachments')
      .withIndex('by_message_id_and_sort_order', q => q.eq('messageId', args.messageId))
      .order('asc')
      .collect();

    const pending = [];
    for (const attachment of attachments) {
      const existing = await ctx.db
        .query('reedImageAnalyses')
        .withIndex('by_attachment_id', q => q.eq('attachmentId', attachment._id))
        .unique();
      if (!existing && attachment.status === 'pending') {
        pending.push(attachment);
      }
    }

    return pending;
  },
});

export const saveImageAnalysis = internalMutation({
  args: {
    attachmentId: v.id('reedMessageAttachments'),
    error: v.optional(v.string()),
    modelName: v.string(),
    modelProvider: v.string(),
    narrative: v.string(),
    status: v.union(v.literal('analyzed'), v.literal('failed')),
  },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) throw new ConvexError('Attachment not found.');

    const now = Date.now();
    const existing = await ctx.db
      .query('reedImageAnalyses')
      .withIndex('by_attachment_id', q => q.eq('attachmentId', attachment._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        narrative: args.narrative,
        modelProvider: args.modelProvider,
        modelName: args.modelName,
        error: args.error,
        updatedAt: now,
      });
      await ctx.db.patch(attachment._id, { status: args.status, updatedAt: now });
      return existing._id;
    }

    const analysisId = await ctx.db.insert('reedImageAnalyses', {
      attachmentId: attachment._id,
      messageId: attachment.messageId,
      profileId: attachment.profileId,
      status: args.status,
      narrative: args.narrative,
      modelProvider: args.modelProvider,
      modelName: args.modelName,
      error: args.error,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(attachment._id, { status: args.status, updatedAt: now });
    return analysisId;
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

export const loadCoachStateRefreshContext = internalQuery({
  args: {
    sourceThroughMessageId: v.id('reedMessages'),
    threadId: v.id('reedThreads'),
  },
  handler: async (ctx, args): Promise<null | {
    thread: Doc<'reedThreads'>;
    profile: Doc<'profiles'>;
    previousState: Doc<'reedCoachStates'> | null;
    activeSummary: Doc<'reedMemorySummaries'> | null;
    prompt: { _id: Id<'reedPromptVersions'> | null; key: string; content: string; contentHash: string; version: number };
    journeySummary: string | null;
    recentMessages: Doc<'reedMessages'>[];
    sourceFromMessage: Doc<'reedMessages'>;
    sourceThroughMessage: Doc<'reedMessages'>;
  }> => {
    const thread = await ctx.db.get(args.threadId);
    const sourceThroughMessage = await ctx.db.get(args.sourceThroughMessageId);
    if (!thread || !sourceThroughMessage) throw new ConvexError('Coach state refresh context is incomplete.');
    if (sourceThroughMessage.threadId !== thread._id) throw new ConvexError('Coach state message does not belong to thread.');

    const profile = await ctx.db.get(thread.profileId);
    if (!profile) throw new ConvexError('Profile not found.');

    const previousState = await getCoachStateForThread(ctx, thread._id);
    if (previousState?.updatedThroughMessageId === args.sourceThroughMessageId) {
      return null;
    }
    if (previousState) {
      const previousThroughMessage = await ctx.db.get(previousState.updatedThroughMessageId);
      if (previousThroughMessage && previousThroughMessage.createdAt >= sourceThroughMessage.createdAt) {
        return null;
      }
    }

    const activeSummary = thread.activeSummaryId ? await ctx.db.get(thread.activeSummaryId) : null;
    const promptVersion = await ctx.db
      .query('reedPromptVersions')
      .withIndex('by_key_and_status', q => q.eq('key', DEFAULT_COACH_STATE_PROMPT_KEY).eq('status', 'active'))
      .order('desc')
      .first();
    const journey: Doc<'reedJourneySnapshots'> | null = await ctx.runQuery(internal.reedJourney.latestForProfile, { profileId: thread.profileId });
    const recentMessages = [
      ...await loadRecentMessages(ctx, thread._id, 23, args.sourceThroughMessageId),
      sourceThroughMessage,
    ].filter(message => message.status === 'sent');
    const sourceFromMessage = recentMessages[0] ?? sourceThroughMessage;

    return {
      thread,
      profile,
      previousState,
      activeSummary,
      prompt: promptVersion ?? {
        _id: null,
        key: DEFAULT_COACH_STATE_PROMPT_KEY,
        content: DEFAULT_COACH_STATE_PROMPT,
        contentHash: simpleHash(DEFAULT_COACH_STATE_PROMPT),
        version: 0,
      },
      journeySummary: journey?.renderedContext ?? null,
      recentMessages,
      sourceFromMessage,
      sourceThroughMessage,
    };
  },
});

export const loadPromptByKey = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args): Promise<{ _id: Id<'reedPromptVersions'>; key: string; content: string; contentHash: string; version: number } | null> => {
    return await ctx.db
      .query('reedPromptVersions')
      .withIndex('by_key_and_status', q => q.eq('key', args.key).eq('status', 'active'))
      .order('desc')
      .first();
  },
});

export const saveCoachState = internalMutation({
  args: {
    content: v.string(),
    modelName: v.string(),
    modelProvider: v.string(),
    promptHash: v.string(),
    sourceFromMessageId: v.optional(v.id('reedMessages')),
    updatedThroughMessageId: v.id('reedMessages'),
    threadId: v.id('reedThreads'),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError('Thread not found.');

    const now = Date.now();
    const latest = await getCoachStateForThread(ctx, args.threadId);
    if (latest) {
      const latestThroughMessage = await ctx.db.get(latest.updatedThroughMessageId);
      const nextThroughMessage = await ctx.db.get(args.updatedThroughMessageId);
      if (!nextThroughMessage) throw new ConvexError('Coach state source message not found.');
      if (latestThroughMessage && latestThroughMessage.createdAt >= nextThroughMessage.createdAt) {
        return latest._id;
      }
    }

    return await ctx.db.insert('reedCoachStates', {
      threadId: args.threadId,
      profileId: thread.profileId,
      content: args.content,
      sourceFromMessageId: args.sourceFromMessageId,
      updatedThroughMessageId: args.updatedThroughMessageId,
      modelProvider: args.modelProvider,
      modelName: args.modelName,
      promptHash: args.promptHash,
      createdAt: now,
      updatedAt: now,
    });
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

function assertPromptAdmin(adminSecret: string) {
  const expectedSecret = process.env.REED_CONTROL_PANEL_SECRET;
  if (!expectedSecret || adminSecret !== expectedSecret) {
    throw new ConvexError('Prompt editing is not enabled for this deployment.');
  }
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

function checkedInPromptHash(key: string) {
  if (key === DEFAULT_COACH_STATE_PROMPT_KEY) return CHECKED_IN_COACH_STATE_PROMPT_HASH;
  if (key === COACHING_MEMORY_PROMPT_KEY) return CHECKED_IN_COACHING_MEMORY_PROMPT_HASH;
  return null;
}

async function getOrCreateActiveThread(ctx: MutationCtx, profileId: Id<'profiles'>, now: number) {
  const existing = await getActiveThread(ctx, profileId);
  if (existing) return existing;
  const threadId = await ctx.db.insert('reedThreads', { profileId, status: 'active', createdAt: now, updatedAt: now });
  const created = await ctx.db.get(threadId);
  if (!created) throw new ConvexError('Could not create Reed thread.');
  return created;
}

async function getCoachStateForThread(ctx: QueryCtx | MutationCtx, threadId: Id<'reedThreads'>) {
  return await ctx.db
    .query('reedCoachStates')
    .withIndex('by_thread_id_and_created_at', q => q.eq('threadId', threadId))
    .order('desc')
    .first();
}

async function shouldRefreshCoachState(
  ctx: MutationCtx,
  input: {
    completedAssistantMessageId: Id<'reedMessages'>;
    reentryState: 'hot' | 'warm' | 'cold';
    threadId: Id<'reedThreads'>;
  },
) {
  const latest = await getCoachStateForThread(ctx, input.threadId);
  if (!latest) return true;
  if (input.reentryState !== 'hot') return true;

  const latestThroughMessage = await ctx.db.get(latest.updatedThroughMessageId);
  const completedAssistantMessage = await ctx.db.get(input.completedAssistantMessageId);
  if (!completedAssistantMessage) throw new ConvexError('Assistant message not found.');
  if (!latestThroughMessage) return true;
  if (latestThroughMessage.createdAt >= completedAssistantMessage.createdAt) return false;

  const messagesSinceState = await ctx.db
    .query('reedMessages')
    .withIndex('by_thread_id_and_created_at', q =>
      q
        .eq('threadId', input.threadId)
        .gt('createdAt', latestThroughMessage.createdAt)
        .lte('createdAt', completedAssistantMessage.createdAt),
    )
    .order('asc')
    .take(24);
  const sentMessagesSinceState = messagesSinceState.filter(message => message.status === 'sent');
  const userMessagesSinceState = sentMessagesSinceState.filter(message => message.role === 'user');
  if (userMessagesSinceState.length >= COACH_STATE_REFRESH_AFTER_USER_MESSAGES) return true;

  return hasCoachStateTrigger(sentMessagesSinceState.map(message => message.content).join('\n'));
}

function hasCoachStateTrigger(text: string) {
  return /\b(avoid|avoiding|skipped|skip|quit|quitting|lazy|laziness|stuck|plateau|not progressing|no progress|no results|unmotivated|motivation|depressed|depression|burned out|burnt out|overwhelmed|tired|exhausted|injury|injured|pain|hurts|hurt|sore|rejected|crush|failed|failure|you'?re not helping|not helping|doesn'?t work|didn'?t work|angry|frustrated|frustration|hate this|can'?t be arsed)\b/i.test(text);
}

async function countMessageAttachments(ctx: QueryCtx | MutationCtx, messageId: Id<'reedMessages'>) {
  return (await ctx.db
    .query('reedMessageAttachments')
    .withIndex('by_message_id_and_sort_order', q => q.eq('messageId', messageId))
    .collect()).length;
}

async function attachMessageImages(ctx: QueryCtx, messages: Doc<'reedMessages'>[]) {
  const withAttachments = [];
  for (const message of messages) {
    const attachments = await ctx.db
      .query('reedMessageAttachments')
      .withIndex('by_message_id_and_sort_order', q => q.eq('messageId', message._id))
      .order('asc')
      .collect();

    if (attachments.length === 0) {
      withAttachments.push({ ...message, attachments: [] });
      continue;
    }

    const images = [];
    for (const attachment of attachments) {
      const url = await ctx.storage.getUrl(attachment.storageId);
      if (!url) continue;
      images.push({
        _id: attachment._id,
        height: null,
        mediaType: attachment.mediaType,
        sortOrder: attachment.sortOrder,
        status: attachment.status,
        url,
        width: null,
      });
    }

    withAttachments.push({ ...message, attachments: images });
  }

  return withAttachments;
}

async function validateImageAttachments(ctx: MutationCtx, attachments: Array<{ storageId: Id<'_storage'> }>) {
  const seenStorageIds = new Set<string>();
  const metadataRows: StorageMetadata[] = [];

  for (const attachment of attachments) {
    if (seenStorageIds.has(attachment.storageId)) {
      throw new ConvexError('Duplicate image attachment.');
    }
    seenStorageIds.add(attachment.storageId);

    const metadata = await ctx.db.system.get(attachment.storageId) as StorageMetadata | null;
    if (!metadata) throw new ConvexError('Image upload was not found.');
    if (metadata.contentType !== 'image/jpeg') {
      throw new ConvexError('Reed image uploads must be JPEG files.');
    }
    if (metadata.size > MAX_REED_IMAGE_BYTES) {
      throw new ConvexError('Reed image uploads must be 8 MB or smaller after compression.');
    }

    metadataRows.push(metadata);
  }

  return metadataRows;
}

async function loadImageObservations(ctx: QueryCtx, messageId: Id<'reedMessages'>) {
  const attachments = await ctx.db
    .query('reedMessageAttachments')
    .withIndex('by_message_id_and_sort_order', q => q.eq('messageId', messageId))
    .order('asc')
    .collect();

  const observations = [];
  for (const attachment of attachments) {
    const analysis = await ctx.db
      .query('reedImageAnalyses')
      .withIndex('by_attachment_id', q => q.eq('attachmentId', attachment._id))
      .unique();
    if (!analysis) continue;
    observations.push({
      attachmentId: attachment._id,
      narrative: analysis.narrative,
      sortOrder: attachment.sortOrder,
      status: analysis.status,
    });
  }

  return observations;
}

async function loadRecentAppTimeline(ctx: QueryCtx, profileId: Id<'profiles'>, now: number): Promise<{
  currentState: string;
  events: ReedAppTimelineEvent[];
}> {
  const events: ReedAppTimelineEvent[] = [];
  const activeSession = await ctx.db
    .query('liveSessions')
    .withIndex('by_profile_id_and_status', q => q.eq('profileId', profileId).eq('status', 'active'))
    .unique();
  const endedSessions = await ctx.db
    .query('liveSessions')
    .withIndex('by_profile_id_and_status_and_started_at', q => q.eq('profileId', profileId).eq('status', 'ended'))
    .order('desc')
    .take(3);

  if (activeSession) {
    const activeSummary = await summarizeSessionForTimeline(ctx, activeSession);
    events.push({
      at: activeSession.startedAt,
      summary: `Active workout started. ${activeSummary}`,
    });
  }

  for (const session of endedSessions) {
    const summary = await summarizeSessionForTimeline(ctx, session);
    events.push({
      at: session.startedAt,
      summary: `Workout started. ${summary}`,
    });
    events.push({
      at: session.endedAt ?? session.startedAt,
      summary: `Workout ended. ${summary}`,
    });
  }

  const latestEnded = endedSessions[0] ?? null;
  const currentState = activeSession
    ? `There is an active workout that started ${formatRelativeAge(now - activeSession.startedAt)} ago.`
    : latestEnded
      ? `No active workout. The latest logged workout ended ${formatRelativeAge(now - (latestEnded.endedAt ?? latestEnded.startedAt))} ago.`
      : 'No active workout and no ended workouts are recorded yet.';

  return {
    currentState,
    events: events.sort((left, right) => left.at - right.at),
  };
}

async function summarizeSessionForTimeline(ctx: QueryCtx, session: Doc<'liveSessions'>) {
  const exercises = await ctx.db
    .query('liveSessionExercises')
    .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
    .order('asc')
    .take(30);
  const logs = await ctx.db
    .query('activityLogs')
    .withIndex('by_session_id_and_set_number', q => q.eq('sessionId', session._id))
    .take(120);
  const duration = session.endedAt
    ? `Duration ${Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000))} min.`
    : 'Still in progress.';
  const exerciseNames = exercises.slice(0, 8).map(exercise => exercise.exerciseName);
  const exerciseSummary = exerciseNames.length > 0
    ? `Exercises: ${exerciseNames.join(', ')}${exercises.length > exerciseNames.length ? ', ...' : ''}.`
    : 'No exercises recorded.';
  return `${duration} ${logs.length} logged set${logs.length === 1 ? '' : 's'}. ${exerciseSummary}`;
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
  return rows.reverse().filter(message => message.status === 'sent' && !isInternalArtifactMessage(message));
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
  return (await query.order('asc').take(limit)).filter(message => message.status === 'sent' && !isInternalArtifactMessage(message));
}

function classifyReentry(lastMessageAt: number | null, now: number) {
  if (!lastMessageAt) return { state: 'cold' as const, recentTurnCount: COLD_RECENT_MESSAGE_COUNT };
  const age = now - lastMessageAt;
  if (age <= HOT_AFTER_MS) return { state: 'hot' as const, recentTurnCount: HOT_RECENT_MESSAGE_COUNT };
  if (age <= WARM_AFTER_MS) return { state: 'warm' as const, recentTurnCount: WARM_RECENT_MESSAGE_COUNT };
  return { state: 'cold' as const, recentTurnCount: COLD_RECENT_MESSAGE_COUNT };
}

function formatRelativeAge(ageMs: number) {
  const minutes = Math.max(0, Math.round(ageMs / 60_000));
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

function isInternalArtifactMessage(message: Pick<Doc<'reedMessages'>, 'clientNonce' | 'content' | 'role' | 'source'>) {
  if (message.role !== 'assistant' || message.source !== 'system') return false;
  if (message.clientNonce?.endsWith(':context-primer')) return true;
  if (message.clientNonce?.endsWith(':image-observation')) return true;
  return message.content === 'Reed could not read this attached image clearly enough to use it as coaching context.';
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return `h${(hash >>> 0).toString(16)}`;
}

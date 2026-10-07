import { sessionDurationSeconds } from '../domains/workout/session-duration';
import { canReedReact } from '../domains/reed/reactions';
import { messageReactionValidator } from './reedReactionValues';
import { reedMessageContextValidator, validateReedMessageContext, reedMessageContextLine } from './reedSessionContext';
export { getSessionWhisper } from './reedSessionWhispers';
import { prepareSessionAction, saveSessionAction } from './reedSessionActions';
import { prepareChatPlan, saveChatPlan } from './plannedSessions';
import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';
import { loadProfileTimeZone } from './profileTimeZone';
import { contextAgentGateDecision, pickAgentThinkingMessage } from './reedContextGate';
import { sanitizeReedPresentation } from './reedWidgets';
import schema from './schema';
import { assignMessageChapter, chapterGapMinutes, chapterMetadata, startsNewChapter } from './reedChapters';

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
const MAX_MESSAGE_PAGE_SIZE = 50;
const MAX_REED_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_PROMPT_KEY = 'reed_chat_system';
const DEFAULT_SUMMARY_PROMPT_KEY = 'reed_memory_summary_system';
const DEFAULT_COACH_STATE_PROMPT_KEY = 'reed_coach_state_system';
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

Focus on coaching posture: pressure, warmth/trust, depth, agency, certainty, what changed relationally, what to avoid, and when to reconsider. Do not try to carry the whole durable memory system; coach mental model and private coaching journeys handle broad user memory.

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

const messageFields = {
  ...schema.tables.reedMessages.validator.fields,
  _id: v.id('reedMessages'), _creationTime: v.number(),
  attachments: v.array(v.object({
    _id: v.id('reedMessageAttachments'), height: v.null(), width: v.null(),
    mediaType: schema.tables.reedMessageAttachments.validator.fields.mediaType,
    status: schema.tables.reedMessageAttachments.validator.fields.status,
    sortOrder: v.number(), url: v.string(),
  })),
};
const messageValidator = v.object(messageFields);
const relatedMessageValidator = v.object({ ...messageFields, relatedSession: v.union(v.null(), v.object({
  endedAt: v.number(), exerciseCount: v.number(), sessionId: v.id('liveSessions'), startedAt: v.number(),
  manualDurationSeconds: v.optional(v.number()),
})) });

export const getOrCreateThread = mutation({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    return await getOrCreateActiveThread(ctx, profile._id, Date.now());
  },
});

export const listMessages = query({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ hasMore: v.boolean(), messages: v.array(messageValidator) }),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const thread = await getActiveThread(ctx, profile._id);
    if (!thread) return { hasMore: false, messages: [] };

    const limit = Number.isFinite(args.limit ?? 40) ? Math.min(Math.max(Math.floor(args.limit ?? 40), 1), 200) : 40;
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
  returns: v.object({
    page: v.array(relatedMessageValidator), isDone: v.boolean(), continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(v.union(v.literal('SplitRecommended'), v.literal('SplitRequired'), v.null())),
  }),
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
      .paginate({ ...args.paginationOpts, numItems: Number.isFinite(args.paginationOpts.numItems)
        ? Math.min(MAX_MESSAGE_PAGE_SIZE, Math.max(1, Math.floor(args.paginationOpts.numItems))) : MAX_MESSAGE_PAGE_SIZE });

    const page = await attachMessageImages(ctx, result.page.filter(message => !isInternalArtifactMessage(message)));
    return {
      ...result,
      page: await attachRelatedSessions(ctx, profile._id, page),
    };
  },
});

export const getPresence = query({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const thread = await getActiveThread(ctx, profile._id);
    const now = args.now ?? thread?.lastMessageAt ?? 0;
    const lastMessageAt = thread?.lastMessageAt ?? null;
    const reentryState = classifyReentry(lastMessageAt, now).state;
    const chapter = thread?.currentChapterId ? await ctx.db.get(thread.currentChapterId) : null;
    return { lastMessageAt, reentryState, currentChapterId: chapter?._id ?? null,
      wouldStartNewChapter: startsNewChapter(chapter ? Math.max(lastMessageAt ?? 0, chapter.startedAt) : lastMessageAt, now, chapterGapMinutes(), chapter?.closedAt),
      chapterGapMinutes: chapterGapMinutes(),
      chapterClosedAt: chapter?.closedAt ?? null,
      timeZone: await loadProfileTimeZone(ctx, profile._id),
      chapter: chapter ? await chapterMetadata(ctx, chapter) : null,
      previousChapter: chapter?.previousChapterId ? await ctx.db.get(chapter.previousChapterId).then(row => row ? chapterMetadata(ctx, row) : null) : null,
    };
  },
});

export const getChapterHeader = query({
  args: { chapterId: v.id('reedChapters') },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const chapter = await ctx.db.get(args.chapterId);
    if (!chapter || chapter.profileId !== profile._id) throw new ConvexError('Chapter not found.');
    return await chapterMetadata(ctx, chapter);
  },
});

export const listChapterMessages = query({
  args: { chapterId: v.id('reedChapters'), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(relatedMessageValidator), isDone: v.boolean(), continueCursor: v.string(), splitCursor: v.optional(v.union(v.string(), v.null())), pageStatus: v.optional(v.union(v.literal('SplitRecommended'), v.literal('SplitRequired'), v.null())) }),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const chapter = await ctx.db.get(args.chapterId);
    if (!chapter || chapter.profileId !== profile._id) throw new ConvexError('Chapter not found.');
    const result = await ctx.db.query('reedMessages').withIndex('by_chapter_id_and_created_at', q => q.eq('chapterId', chapter._id)).order('desc').paginate({ ...args.paginationOpts, numItems: Number.isFinite(args.paginationOpts.numItems) ? Math.min(MAX_MESSAGE_PAGE_SIZE, Math.max(1, Math.floor(args.paginationOpts.numItems))) : 30 });
    const page = await attachMessageImages(ctx, result.page.filter(message => !isInternalArtifactMessage(message)));
    return { ...result, page: await attachRelatedSessions(ctx, profile._id, page) };
  },
});

export const setMessageReaction = mutation({
  args: { messageId: v.id('reedMessages'), reaction: v.union(messageReactionValidator, v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message || message.profileId !== profile._id || message.role !== 'assistant' || message.status !== 'sent' || isInternalArtifactMessage(message)) {
      throw new ConvexError('That response is not available for reactions.');
    }
    if (message.reaction === (args.reaction ?? undefined)) return null;
    await ctx.db.patch(message._id, { reaction: args.reaction ?? undefined, reactionUpdatedAt: Date.now() });
    return null;
  },
});

export const listQuickActions = query({
  args: {},
  returns: v.array(quickActionValidator),
  handler: async ctx => {
    await requireViewerProfile(ctx);
    return [...DEFAULT_QUICK_ACTIONS].sort((left, right) => left.sortOrder - right.sortOrder);
  },
});

// Initial fallback for the two suggestions beside the chat mascot. Keep this separate from
// Today/composer starters so it can later become contextual without changing their contract.
export const listNextSuggestions = query({
  args: {},
  returns: v.array(quickActionValidator),
  handler: async ctx => {
    await requireViewerProfile(ctx);
    return DEFAULT_QUICK_ACTIONS.filter(action => action.id === 'next-focus' || action.id === 'check-progress');
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
    context: v.optional(reedMessageContextValidator),
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

    await validateReedMessageContext(ctx, profile._id, args.context);
    const thread = await getOrCreateActiveThread(ctx, profile._id, now);
    const priorLastMessageAt = thread.lastMessageAt ?? null;
    const chapterId = await assignMessageChapter(ctx, thread, now);
    const { state, recentTurnCount } = classifyReentry(priorLastMessageAt, now);
    const userMessageContent = content || `Attached ${attachments.length} image${attachments.length === 1 ? '' : 's'}`;

    const userMessageId = await ctx.db.insert('reedMessages', {
      chapterId,
      ...(args.context ? { context: args.context } : {}),
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

    const shouldShowAgentThinkingMessage = contextAgentGateDecision(userMessageContent).run;
    if (shouldShowAgentThinkingMessage) {
      await ctx.db.insert('reedMessages', {
        chapterId,
        threadId: thread._id,
        profileId: profile._id,
        role: 'assistant',
        content: pickAgentThinkingMessage(`${args.clientNonce ?? ''}:${userMessageContent}:${now}`),
        source: 'system',
        status: 'sent',
        createdAt: now + 1,
        completedAt: now + 1,
      });
    }

    const assistantMessageId = await ctx.db.insert('reedMessages', {
      chapterId,
      threadId: thread._id,
      profileId: profile._id,
      role: 'assistant',
      content: '',
      source: 'system',
      status: 'pending',
      createdAt: shouldShowAgentThinkingMessage ? now + 2 : now + 1,
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
      replyRecovery: undefined,
      error: undefined,
      widget: undefined,
      replies: undefined,
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
    messageContext: string | null;
    journeySummary: string | null;
    memorySummary: string | null;
    recentMessages: Doc<'reedMessages'>[];
    recentReactionSignals: Doc<'reedMessages'>[];
    reactionAllowed: boolean;
    widgetChoices: { sessions: Array<{ sessionId: Id<'liveSessions'>; endedAt: number }>; presets: Array<{ key: string; label: string }> };
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
    const recentUserTurns = (await ctx.db.query('reedMessages')
      .withIndex('by_thread_id_and_created_at', q => q.eq('threadId', thread._id).lt('createdAt', userMessage.createdAt))
      .order('desc').take(12)).filter(row => row.role === 'user').reverse();
    // Include fresh feedback on older, compacted messages in the next turn too.
    const previousUserAt = recentUserTurns.at(-1)?.createdAt ?? 0;
    const recentReactionSignals = (await ctx.db.query('reedMessages')
      .withIndex('by_thread_id_and_reaction_updated_at', q => q.eq('threadId', thread._id).gt('reactionUpdatedAt', previousUserAt))
      .order('desc').take(10)).filter(row => row.role === 'assistant' && row.reaction && !recentMessages.some(recent => recent._id === row._id));
    const reactionAllowed = canReedReact(recentUserTurns);
    const coachState = await getCoachStateForThread(ctx, thread._id);
    const imageObservations = await loadImageObservations(ctx, userMessage._id);
    const appTimeline = await loadRecentAppTimeline(ctx, thread.profileId, args.clientNow);
    const presets = await ctx.db.query('quickLogPresets')
      .withIndex('by_enabled_and_sort_order', q => q.eq('isEnabled', true)).take(30);

    return {
      clientNow: args.clientNow,
      clientTimeZone: await loadProfileTimeZone(ctx, profile._id),
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
      messageContext: await reedMessageContextLine(ctx, profile._id, userMessage.context),
      journeySummary: journey?.renderedContext ?? null,
      memorySummary: summary?.content ?? null,
      recentMessages,
      recentReactionSignals,
      reactionAllowed,
      widgetChoices: { sessions: appTimeline.widgetSessions, presets: presets.map(preset => ({ key: preset.key, label: preset.label })) },
    };
  },
});

export const completeAssistantMessage = internalMutation({
  args: {
    assistantMessageId: v.id('reedMessages'),
    content: v.string(),
    reaction: v.optional(messageReactionValidator),
    completedAt: v.number(),
    reentryState: reentryStateValidator,
    threadId: v.id('reedThreads'),
    userMessageId: v.optional(v.id('reedMessages')),
    plan: v.optional(v.any()),
    sessionAction: v.optional(v.any()),
    // Model fields are untrusted; sanitize them transactionally before persistence.
    widget: v.optional(v.any()),
    replies: v.optional(v.any()),
  },
  returns: v.object({ widgetKind: v.union(v.string(), v.null()), replyCount: v.number(), planDecision: v.string(), actionDecision: v.string() }),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.assistantMessageId);
    const thread = await ctx.db.get(args.threadId);
    if (!message || message.role !== 'assistant' || message.threadId !== args.threadId || message.profileId !== thread?.profileId) {
      throw new ConvexError('Assistant message not found in thread.');
    }
    if (message.status === 'sent') return { widgetKind: message.widget?.kind ?? null, replyCount: message.replies?.length ?? 0, planDecision: 'already_completed', actionDecision: 'already_completed' };
    const user = args.userMessageId ? await ctx.db.get(args.userMessageId) : null;
    const prepared = args.plan !== undefined && args.sessionAction === undefined && user ? await prepareChatPlan(ctx, message.profileId, args.plan, user, message) : null;
    const preparedAction = args.sessionAction !== undefined && args.plan === undefined && user ? await prepareSessionAction(ctx, message.profileId, args.sessionAction, user, message) : null;
    const actionId = preparedAction ? await saveSessionAction(ctx, message.profileId, message._id, preparedAction) : null;
    const plannedSessionId = prepared ? await saveChatPlan(ctx, message.profileId, message._id, prepared) : null;
    const missingClaimedOperation = user?.role === 'user' && user.profileId === message.profileId
      && user.threadId === message.threadId && args.plan === undefined && args.sessionAction === undefined
      && /\b(revised|updated|shortened|saved|created|swapped|changed|replaced)\b/i.test(args.content)
      && /\b(?:make\b[\s\S]{0,100}\b(?:shorter|longer|easier|harder)|swap|replace|revise|shorten|lengthen)\b/i.test(user.content);
    const invalidOperation = (args.plan !== undefined && !prepared) || (args.sessionAction !== undefined && !preparedAction);
    const content = missingClaimedOperation
      ? 'I could not save that proposed change. Ask me to try again.'
      : invalidOperation
      ? args.sessionAction !== undefined
        ? 'I could not save that swap proposal. Your session is unchanged. Ask me for a fresh option.'
        : 'I could not save that plan. Ask me to try again with supported exercises.'
      : args.content;
    const presentation = await sanitizeMessagePresentation(ctx, message.profileId, {
      ...args, widget: actionId ? { kind: 'session_change', actionId } : plannedSessionId ? { kind: 'plan', plannedSessionId } : args.plan !== undefined || args.sessionAction !== undefined ? undefined : args.widget,
    }, content);
    await ctx.db.patch(args.assistantMessageId, {
      content,
      status: 'sent',
      completedAt: args.completedAt,
      replyRecovery: undefined,
      widget: presentation.widget,
      replies: presentation.replies,
    });
    await ctx.db.patch(args.threadId, {
      updatedAt: args.completedAt,
      lastMessageAt: args.completedAt,
    });

    if (args.reaction && user && user.role === 'user' && user.profileId === message.profileId && user.threadId === message.threadId) {
      const turns = (await ctx.db.query('reedMessages')
        .withIndex('by_thread_id_and_created_at', q => q.eq('threadId', message.threadId).lt('createdAt', user.createdAt))
        .order('desc').take(12)).filter(row => row.role === 'user').reverse();
      if (canReedReact(turns)) await ctx.db.patch(user._id, { reaction: args.reaction });
    }

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
    return { widgetKind: presentation.widget?.kind ?? null, replyCount: presentation.replies?.length ?? 0, actionDecision: missingClaimedOperation ? 'missing_operation_text_only' : preparedAction ? 'proposed' : args.sessionAction !== undefined ? 'invalid_text_only' : 'none', planDecision: missingClaimedOperation ? 'missing_operation_text_only' : prepared ? prepared.existing ? 'revised' : 'created' : args.plan !== undefined ? 'invalid_text_only' : 'none' };
  },
});

export const createBackgroundMessage = internalMutation({
  args: {
    clientNonce: v.optional(v.string()),
    content: v.string(),
    createdAt: v.number(),
    profileId: v.id('profiles'),
    // Outbound payloads carry ids as strings; unknown or foreign ids are dropped, not rejected.
    relatedSessionId: v.optional(v.string()),
    widget: v.optional(v.any()),
    replies: v.optional(v.any()),
  },
  returns: v.object({
    messageId: v.id('reedMessages'),
    threadId: v.id('reedThreads'),
  }),
  handler: async (ctx, args) => {
    const content = args.content.trim();
    if (!content) throw new ConvexError('Background Reed message cannot be empty.');
    if (content.length > 8000) throw new ConvexError('Background Reed message is too long.');

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new ConvexError('Profile not found.');

    const thread = await getOrCreateActiveThread(ctx, args.profileId, args.createdAt);
    const chapterId = await assignMessageChapter(ctx, thread, args.createdAt);
    const relatedSessionId = await resolveOwnedSessionId(ctx, args.profileId, args.relatedSessionId);
    const presentation = await sanitizeMessagePresentation(ctx, args.profileId, {
      widget: relatedSessionId ? { kind: 'session_summary', sessionId: relatedSessionId } : args.widget,
      replies: args.replies,
    }, content);
    const messageId = await ctx.db.insert('reedMessages', {
      chapterId,
      threadId: thread._id,
      profileId: args.profileId,
      role: 'assistant',
      content,
      source: 'background_coach',
      status: 'sent',
      createdAt: args.createdAt,
      completedAt: args.createdAt,
      clientNonce: args.clientNonce,
      ...(relatedSessionId ? { relatedSessionId } : {}),
      ...presentation,
    });

    await ctx.db.patch(thread._id, {
      lastMessageAt: args.createdAt,
      updatedAt: args.createdAt,
    });

    return { messageId, threadId: thread._id };
  },
});

/** Push retry state on the same pending row; never insert pretend assistant replies. */
export const markAssistantRecovery = internalMutation({
  args: {
    assistantMessageId: v.id('reedMessages'),
    threadId: v.id('reedThreads'),
    phase: v.union(v.literal('retrying'), v.literal('backup')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.assistantMessageId);
    const thread = await ctx.db.get(args.threadId);
    if (!message || message.role !== 'assistant' || message.threadId !== args.threadId || message.profileId !== thread?.profileId) {
      throw new ConvexError('Assistant message not found in thread.');
    }
    if (message.status === 'pending') await ctx.db.patch(message._id, { replyRecovery: args.phase });
    return null;
  },
});

export const failAssistantMessage = internalMutation({
  args: {
    assistantMessageId: v.id('reedMessages'),
    error: v.string(),
    failedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.assistantMessageId);
    if (!message || message.role !== 'assistant') throw new ConvexError('Assistant message not found.');
    await ctx.db.patch(args.assistantMessageId, {
      content: 'I hit a system issue while thinking. Try again in a moment.',
      status: 'failed',
      completedAt: args.failedAt,
      error: args.error,
      widget: undefined,
      replies: undefined,
      replyRecovery: undefined,
    });
    return null;
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
      .take(MAX_REED_IMAGE_ATTACHMENTS);

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
    .take(MAX_REED_IMAGE_ATTACHMENTS + 1)).length;
}

async function resolveOwnedSessionId(ctx: MutationCtx, profileId: Id<'profiles'>, rawSessionId: string | undefined) {
  if (!rawSessionId) return null;
  const sessionId = ctx.db.normalizeId('liveSessions', rawSessionId);
  if (!sessionId) return null;
  const session = await ctx.db.get(sessionId);
  return session && session.profileId === profileId ? sessionId : null;
}

async function sanitizeMessagePresentation(ctx: MutationCtx, profileId: Id<'profiles'>, value: { widget?: unknown; replies?: unknown }, content: string) {
  const widget = value.widget && typeof value.widget === 'object' ? value.widget as Record<string, unknown> : null;
  const rawId = widget?.kind === 'session_summary' && typeof widget.sessionId === 'string' ? widget.sessionId : null;
  const sessionId = rawId ? ctx.db.normalizeId('liveSessions', rawId) : null;
  const session = sessionId ? await ctx.db.get(sessionId) : null;
  const planId = widget?.kind === 'plan' && typeof widget.plannedSessionId === 'string' ? ctx.db.normalizeId('plannedSessions', widget.plannedSessionId) : null;
  const plan = planId ? await ctx.db.get(planId) : null;
  const actionId = widget?.kind === 'session_change' && typeof widget.actionId === 'string' ? ctx.db.normalizeId('reedSessionActions', widget.actionId) : null;
  const action = actionId ? await ctx.db.get(actionId) : null;
  const presets = widget?.kind === 'quick_log' ? await ctx.db.query('quickLogPresets')
    .withIndex('by_enabled_and_sort_order', q => q.eq('isEnabled', true)).take(100) : [];
  return sanitizeReedPresentation(value, { profileId, session, plan, action, enabledPresetKeys: presets.map(preset => preset.key) }, content);
}

const RELATED_SESSION_EXERCISE_SCAN_LIMIT = 100;

async function attachRelatedSessions<T extends Doc<'reedMessages'>>(ctx: QueryCtx, profileId: Id<'profiles'>, messages: T[]) {
  return await Promise.all(messages.map(async message => {
    if (!message.relatedSessionId) return { ...message, relatedSession: null };

    const session = await ctx.db.get(message.relatedSessionId);
    if (!session || session.profileId !== profileId || session.status !== 'ended') {
      return { ...message, relatedSession: null };
    }

    const exercises = await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
      .take(RELATED_SESSION_EXERCISE_SCAN_LIMIT);

    return {
      ...message,
      relatedSession: {
        endedAt: session.endedAt ?? session.startedAt,
        manualDurationSeconds: session.manualDurationSeconds,
        exerciseCount: exercises.length,
        sessionId: session._id,
        startedAt: session.startedAt,
      },
    };
  }));
}

async function attachMessageImages(ctx: QueryCtx, messages: Doc<'reedMessages'>[]) {
  return await Promise.all(messages.map(async message => {
    const attachments = await ctx.db
      .query('reedMessageAttachments')
      .withIndex('by_message_id_and_sort_order', q => q.eq('messageId', message._id))
      .order('asc')
      .take(MAX_REED_IMAGE_ATTACHMENTS);

    if (attachments.length === 0) {
      return { ...message, attachments: [] };
    }

    const images = (await Promise.all(attachments.map(async attachment => {
      const url = await ctx.storage.getUrl(attachment.storageId);
      return url ? {
        _id: attachment._id,
        height: null,
        mediaType: attachment.mediaType,
        sortOrder: attachment.sortOrder,
        status: attachment.status,
        url,
        width: null,
      } : null;
    }))).filter(image => image !== null);

    return { ...message, attachments: images };
  }));
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
    .take(MAX_REED_IMAGE_ATTACHMENTS);

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
  widgetSessions: Array<{ sessionId: Id<'liveSessions'>; endedAt: number }>;
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
    widgetSessions: endedSessions.map(session => ({ sessionId: session._id, endedAt: session.endedAt ?? session.startedAt })),
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
    ? `Duration ${Math.max(1, Math.round(sessionDurationSeconds(session, session.endedAt) / 60))} min.`
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

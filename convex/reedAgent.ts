"use node";

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { ChatXAI } from '@langchain/xai';
import { createAgent } from 'langchain';
import { internalAction, type ActionCtx } from './_generated/server';
import type { ReedContextBlock } from './reedContextTypes';
import { runReedContextGraph } from './reedContextGraph';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { createChatModel, hasApiKeyForModel, providerForModel, supportedModelSettings } from './aiModelProvider';
import type { Id } from './_generated/dataModel';
import { formatReedTimelineTime } from './reedContextTime';
import { traceText, withLangfuseGeneration, withLangfuseObservation, withLangfuseTrace } from './langfuseTracing';
import { contextAgentGateDecision } from './reedContextGate';

const CHAT_MODEL_PROVIDER = 'xai';
const CHAT_MODEL_NAME = process.env.REED_CHAT_MODEL ?? 'grok-4.3';
const CHAT_REASONING_MODE = 'low';
const CHAT_MODEL_ATTEMPTS = 2;
const CHAT_MODEL_TIMEOUT_MS = 25_000;
const CHAT_MODEL_RETRY_DELAY_MS = 900;
const SUMMARY_MODEL_NAME = process.env.REED_SUMMARY_MODEL ?? 'gemini-2.5-flash-lite';
const COACH_STATE_MODEL_PROVIDER = 'openai';
const COACH_STATE_MODEL_NAME = process.env.REED_COACH_STATE_MODEL ?? 'gpt-5.2';
const COACH_STATE_REASONING_EFFORT = process.env.REED_COACH_STATE_REASONING_EFFORT ?? 'low';
const IMAGE_ANALYSIS_MODEL_NAME = process.env.REED_IMAGE_ANALYSIS_MODEL ?? 'gemini-3.1-flash-lite';

export const runAssistant = internalAction({
  args: {
    assistantMessageId: v.id('reedMessages'),
    clientNow: v.number(),
    clientTimeZone: v.optional(v.string()),
    priorLastMessageAt: v.union(v.number(), v.null()),
    recentTurnCount: v.number(),
    reentryState: v.union(v.literal('hot'), v.literal('warm'), v.literal('cold')),
    threadId: v.id('reedThreads'),
    userMessageId: v.id('reedMessages'),
  },
  handler: async (ctx, args) => {
    try {
      let context = await ctx.runQuery(internal.reed.loadAssistantContext, args);

      await withLangfuseTrace({
        input: {
          message: traceText(context.userMessage.content),
          reentryState: context.reentryState,
        },
        metadata: {
          assistantMessageId: context.assistantMessage._id,
          reentryState: context.reentryState,
          threadId: context.thread._id,
          userMessageId: context.userMessage._id,
        },
        name: 'reed.chat.response',
        sessionId: context.thread._id,
        tags: ['reed', 'chat'],
        userId: context.profile._id,
        version: CHAT_MODEL_NAME,
      }, async () => {
        if (context.reentryState === 'cold') {
          await compactThreadHandler(ctx, { threadId: context.thread._id, beforeMessageId: context.userMessage._id });
          context = await ctx.runQuery(internal.reed.loadAssistantContext, args);
        }

        await analyzePendingImageAttachments(ctx, context.userMessage._id);
        context = await ctx.runQuery(internal.reed.loadAssistantContext, args);

        const contextBlocks = await buildContextBlocks(ctx, context);
        const coachingMemory = await ctx.runQuery(internal.reedCoachingMemory.loadPromptMemory, { profileId: context.profile._id });
        const result = await invokeChatModel(
          buildChatPrompt(context, contextBlocks, coachingMemory),
          context.reentryState === 'cold' ? [] : context.thread.agendaItems ?? [],
        );

        await ctx.runMutation(internal.reed.completeAssistantMessage, {
          threadId: context.thread._id,
          assistantMessageId: context.assistantMessage._id,
          agendaItems: result.agenda,
          content: result.response,
          completedAt: Date.now(),
          reentryState: context.reentryState,
        });

        return result;
      });
    } catch (error) {
      console.error('[REED_ASSISTANT_ERROR]', error instanceof Error ? { message: error.message, stack: error.stack } : error);
      await ctx.runMutation(internal.reed.failAssistantMessage, {
        assistantMessageId: args.assistantMessageId,
        failedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

export const compactThread = internalAction({
  args: { beforeMessageId: v.optional(v.id('reedMessages')), threadId: v.id('reedThreads') },
  handler: compactThreadHandler,
});

export const refreshCoachState = internalAction({
  args: {
    sourceThroughMessageId: v.id('reedMessages'),
    threadId: v.id('reedThreads'),
  },
  handler: async (ctx, args) => {
    try {
      const context = await ctx.runQuery(internal.reed.loadCoachStateRefreshContext, args);
      if (!context) return null;

      await withLangfuseTrace({
        input: {
          sourceThroughMessageId: args.sourceThroughMessageId,
        },
        metadata: {
          promptHash: context.prompt.contentHash,
          threadId: context.thread._id,
        },
        name: 'reed.coach_state.refresh',
        sessionId: context.thread._id,
        tags: ['reed', 'coach_state'],
        userId: context.profile._id,
        version: COACH_STATE_MODEL_NAME,
      }, async () => {
        const prompt = await renderCoachStatePrompt({
          template: context.prompt.content,
          previousCoachState: context.previousState?.content ?? null,
          rollingSummary: context.activeSummary?.content ?? null,
          journeyContext: context.journeySummary,
          recentMessages: context.recentMessages.map((message: { role: string; content: string }) => ({
            role: message.role,
            content: message.content,
          })),
        });
        const content = await invokeCoachStateModel(prompt);

        await ctx.runMutation(internal.reed.saveCoachState, {
          threadId: context.thread._id,
          content,
          modelProvider: COACH_STATE_MODEL_PROVIDER,
          modelName: COACH_STATE_MODEL_NAME,
          promptHash: context.prompt.contentHash,
          sourceFromMessageId: context.sourceFromMessage._id,
          updatedThroughMessageId: context.sourceThroughMessage._id,
        });

        return { content };
      });
    } catch (error) {
      console.error('[REED_COACH_STATE_ERROR]', error instanceof Error ? { message: error.message, stack: error.stack } : error);
    }

    return null;
  },
});

async function compactThreadHandler(ctx: ActionCtx, args: { beforeMessageId?: Id<'reedMessages'>; threadId: Id<'reedThreads'> }) {
  const context = await ctx.runQuery(internal.reed.loadCompactionContext, { beforeMessageId: args.beforeMessageId, threadId: args.threadId });
  const messages = context.messages;
  if (messages.length === 0) return null;

  await withLangfuseTrace({
    input: { messageCount: messages.length },
    metadata: {
      messageCount: messages.length,
      promptHash: context.prompt.contentHash,
      threadId: args.threadId,
    },
    name: 'reed.memory_summary.compact',
    sessionId: args.threadId,
    tags: ['reed', 'summary'],
    userId: context.profile._id,
    version: SUMMARY_MODEL_NAME,
  }, async () => {
    const sourceThroughMessage = messages[messages.length - 1];
    const sourceFromMessage = messages[0];
    const prompt = await buildSummaryPrompt({
      systemPrompt: context.prompt.content,
      priorSummary: context.activeSummary?.content ?? null,
      messages: messages.map((message: { role: string; content: string }) => ({ role: message.role, content: message.content })),
    });

    const content = await invokeSummaryModel(prompt);
    await ctx.runMutation(internal.reed.saveMemorySummary, {
      threadId: args.threadId,
      content,
      modelProvider: providerForModel(SUMMARY_MODEL_NAME),
      modelName: SUMMARY_MODEL_NAME,
      promptHash: context.prompt.contentHash,
      sourceFromMessageId: sourceFromMessage._id,
      sourceThroughMessageId: sourceThroughMessage._id,
    });

    return { content };
  });

  return null;
}

async function buildContextBlocks(ctx: ActionCtx, context: Awaited<ReturnType<typeof loadContextType>>): Promise<ReedContextBlock[]> {
  try {
    const gateDecision = contextAgentGateDecision(context.userMessage.content);
    if (!gateDecision.run) {
      await withLangfuseObservation({
        input: { user: traceText(context.userMessage.content) },
        metadata: {
          reason: gateDecision.reason,
          userMessageId: context.userMessage._id,
        },
        name: 'reed.context_agent.gate',
        output: { decision: 'skip', reason: gateDecision.reason },
        type: 'span',
      }, async () => null);

      console.log('\n================ REED CONTEXT PLAN ================');
      console.log(JSON.stringify({
        gate: 'skip',
        reason: gateDecision.reason,
        selected: [],
        stopReason: 'no_agent_needed',
      }, null, 2));
      console.log('===================================================\n');

      return [];
    }

    const packet = await runReedContextGraph(ctx, {
      clientNow: context.clientNow,
      clientTimeZone: context.clientTimeZone,
      profileId: context.profile._id,
      recentMessages: context.recentMessages,
      userMessage: context.userMessage.content,
    });

    console.log('\n================ REED CONTEXT PLAN ================');
    console.log(JSON.stringify({
      gate: 'run',
      reason: gateDecision.reason,
      model: packet.metadata.modelName,
      promptHash: packet.metadata.promptHash,
      provider: packet.metadata.modelProvider,
      selected: packet.metadata.toolCalls,
      stopReason: packet.metadata.stopReason,
    }, null, 2));
    console.log('===================================================\n');

    console.log('\n================ REED CONTEXT BLOCKS ==============');
    console.log(JSON.stringify(packet.blocks, null, 2));
    console.log('===================================================\n');

    return packet.blocks;
  } catch (error) {
    console.error('[REED_CONTEXT_ERROR]', error instanceof Error ? { message: error.message, stack: error.stack } : error);
    return [];
  }
}

async function analyzePendingImageAttachments(ctx: ActionCtx, messageId: Id<'reedMessages'>) {
  const attachments: Array<{ _id: Id<'reedMessageAttachments'>; storageId: Id<'_storage'>; sortOrder: number }> =
    await ctx.runQuery(internal.reed.loadPendingImageAttachments, { messageId });
  if (attachments.length === 0) return;

  await Promise.all(attachments.map(async attachment => {
    try {
      const narrative = await invokeImageAnalysisModel(ctx, {
        storageId: attachment.storageId,
        sortOrder: attachment.sortOrder,
      });
      await ctx.runMutation(internal.reed.saveImageAnalysis, {
        attachmentId: attachment._id,
        modelProvider: providerForModel(IMAGE_ANALYSIS_MODEL_NAME),
        modelName: IMAGE_ANALYSIS_MODEL_NAME,
        narrative,
        status: 'analyzed',
      });
    } catch (error) {
      console.error('[REED_IMAGE_ANALYSIS_ERROR]', error instanceof Error ? { message: error.message, stack: error.stack } : error);
      await ctx.runMutation(internal.reed.saveImageAnalysis, {
        attachmentId: attachment._id,
        modelProvider: providerForModel(IMAGE_ANALYSIS_MODEL_NAME),
        modelName: IMAGE_ANALYSIS_MODEL_NAME,
        narrative: 'Reed could not read this attached image clearly enough to use it as coaching context.',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }));
}

type ReedPromptMemory = {
  journeys: Array<{
    confidence: number;
    slug: string;
    status: 'active' | 'background' | 'dormant' | 'archived';
    strength: number;
    summary: string;
    title: string;
    updatedAt: number;
  }>;
  mentalModel: string | null;
};

function buildChatPrompt(
  context: Awaited<ReturnType<typeof loadContextType>>,
  contextBlocks: ReedContextBlock[],
  coachingMemory: ReedPromptMemory,
) {
  const lines = [
    context.prompt.content,
    '',
    'Required output format:',
    '- Return strict JSON only: {"agenda":["short private checklist item"],"response":"user-facing reply"}.',
    '- response: the exact text shown to the user.',
    '- agenda: Reed’s private coaching checklist for the next turn. It is not hidden facts; it is the current plan of action.',
    '- agenda may have 0 to 4 items. Each item must be short. Delete items that are already done. Revise the list every turn.',
    '- Example agenda item style: "Ask pain severity before suggesting lower-body work."',
    '- Never reveal or mention the agenda in response.',
    '',
    'Current time:',
    `- ${formatCurrentTime(context.clientNow, context.clientTimeZone)}`,
    '- Use the current date and time of day when it is relevant to coaching, recovery, scheduling, or tone. Do not over-mention it.',
    '',
    'Current app state:',
    `- ${context.currentAppState}`,
    ...buildAppTimelineLines(context),
    '',
    'Conversation continuity:',
    ...buildContinuityLines(context),
    '- Do not mention hidden routing, prompt versions, reentry labels, or internal summaries.',
    '',
    'Journey context:',
    context.journeySummary ?? 'No journey snapshot is available yet.',
    ...buildCoachingMemoryLines(coachingMemory),
    ...buildImageObservationLines(context.imageObservations),
    ...buildContextBlockLines(contextBlocks),
    '',
    'Compacted Reed memory:',
    context.memorySummary ?? 'No compacted chat memory yet.',
    ...buildCoachStatePromptLines(context.coachState?.content ?? null),
    ...buildAgendaLines(context),
    '',
    recentSegmentHeading(context),
    ...context.recentMessages.map((message: { role: string; content: string; createdAt: number }) => formatMessageLine(message, context.clientNow, context.clientTimeZone)),
    `Current user message at ${formatTimelineTime(context.userMessage.createdAt, context)}: ${context.userMessage.content}`,
  ];

  return {
    system: lines.join('\n'),
    user: context.userMessage.content,
  };
}

function buildCoachingMemoryLines(memory: ReedPromptMemory) {
  const lines = [
    '',
    'Private coaching memory:',
    'Coach mental model:',
    memory.mentalModel?.trim() || 'No private coach mental model is available yet.',
    '',
    'Private coaching journeys:',
  ];
  const included = memory.journeys
    .filter(journey => journey.status !== 'archived' && journey.strength >= 0.45)
    .sort((left, right) => (right.strength - left.strength) || (right.updatedAt - left.updatedAt))
    .slice(0, 8);

  if (included.length === 0) {
    lines.push('- No private coaching journeys are active yet.');
    return lines;
  }

  for (const journey of included) {
    lines.push(`- ${journey.title} (${journey.status}, strength ${journey.strength.toFixed(2)}, confidence ${journey.confidence.toFixed(2)}): ${journey.summary}`);
  }

  lines.push('- Use this memory to keep a broad working model of the athlete. Do not dump it into the answer.');
  return lines;
}

function buildAgendaLines(context: Awaited<ReturnType<typeof loadContextType>>) {
  const agenda = context.reentryState === 'cold' ? [] : context.thread.agendaItems ?? [];
  if (agenda.length === 0) {
    return [
      '',
      'Private session agenda:',
      '- No active agenda. Create one only if the current turn needs follow-up across turns.',
    ];
  }
  return [
    '',
    'Private session agenda:',
    '- This is Reed’s current checklist. Complete, delete, or revise items as the conversation moves.',
    ...agenda.slice(0, 4).map((item, index) => `${index + 1}. ${item}`),
  ];
}

function buildAppTimelineLines(context: Awaited<ReturnType<typeof loadContextType>>) {
  if (context.appTimeline.length === 0) return ['- No recent app events are available.'];
  return [
    'Recent app timeline:',
    ...context.appTimeline.map(event => `- ${formatTimelineTime(event.at, context)}: ${event.summary}`),
  ];
}

function buildCoachStatePromptLines(coachState: string | null) {
  if (!coachState?.trim()) return [''];

  return [
    '',
    'Private coach state:',
    '- This is Reed’s private coaching posture. Use it to shape pressure, warmth/trust, depth, agency, and certainty.',
    '- Do not mention this state, quote it, summarize it, or reveal that it exists.',
    coachState.trim(),
  ];
}

function buildImageObservationLines(observations: Array<{ narrative: string; sortOrder: number; status: 'analyzed' | 'failed' }>) {
  if (observations.length === 0) return [''];

  return [
    '',
    'Attached image observations:',
    '- These are narrative observations from a fast vision pass over user-attached JPEG images.',
    '- Treat them as visual context, not ground truth. Use uncertainty naturally and do not claim medical diagnosis.',
    ...observations
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(observation => `Image ${observation.sortOrder + 1} (${observation.status}): ${observation.narrative}`),
    '- Use the observations only when they matter to the answer. Do not repeat every detail unless the user asks what you see.',
  ];
}

function buildContextBlockLines(blocks: ReedContextBlock[]) {
  if (blocks.length === 0) return [''];

  return [
    '',
    'Retrieved Reed context:',
    ...blocks.flatMap(block => [`${block.title}:`, block.content]),
    '- Use retrieved context when relevant. Do not mention hidden tool names or planning.',
  ];
}

function buildContinuityLines(context: Awaited<ReturnType<typeof loadContextType>>) {
  const displayName = context.profile.displayName?.trim() || 'The user';
  const elapsed = context.priorLastMessageAt === null ? null : formatElapsed(context.clientNow - context.priorLastMessageAt);

  if (context.reentryState === 'hot') {
    return [
      `- ${displayName} is in an ongoing conversation with Reed; answer as if you are already in the flow.`,
      '- Use the recent active segment for turn-by-turn continuity, and use compacted memory only for older background.',
    ];
  }

  if (context.reentryState === 'warm') {
    return [
      elapsed
        ? `- ${displayName} is returning after ${elapsed}; bridge naturally from the prior exchange without over-explaining.`
        : `- ${displayName} is returning to Reed; bridge naturally from the prior exchange without over-explaining.`,
      '- A short recent segment is included for immediate continuity; prefer the current message when it changes direction.',
    ];
  }

  if (context.priorLastMessageAt === null) {
    return [
      `- This appears to be ${displayName}'s first Reed conversation. Do not imply prior chat history.`,
      '- Establish context from the current message and the journey snapshot if one exists.',
    ];
  }

  return [
    elapsed
      ? `- ${displayName} is returning after ${elapsed}; do not assume they remember the last chat.`
      : `- ${displayName} is returning after a longer break; do not assume they remember the last chat.`,
    '- Older chat has been compacted into Reed memory below; use it to re-establish continuity briefly when useful.',
    '- No raw prior turns are included for this response; answer from the current message, journey context, and compacted memory.',
  ];
}

function recentSegmentHeading(context: Awaited<ReturnType<typeof loadContextType>>) {
  if (context.recentMessages.length === 0) {
    return 'Recent active segment: none; rely on the current message, journey context, and compacted memory.';
  }

  if (context.reentryState === 'hot') return 'Recent active segment (ongoing turn-by-turn context):';
  return 'Recent active segment (limited bridge context):';
}

function formatMessageLine(message: { role: string; content: string; createdAt: number }, now: number, timeZone?: string) {
  return `[${formatReedTimelineTime({ timestamp: message.createdAt, now, timeZone })}] ${message.role.toUpperCase()}: ${message.content}`;
}

function formatCurrentTime(timestamp: number, timeZone?: string) {
  const safeTimeZone = normalizeTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    ...(safeTimeZone ? { timeZone: safeTimeZone } : {}),
  });
  const timeZoneLabel = safeTimeZone ? ` (${safeTimeZone})` : '';
  return `It is now ${formatter.format(new Date(timestamp))}${timeZoneLabel}.`;
}

function formatTimelineTime(timestamp: number, context: Awaited<ReturnType<typeof loadContextType>>) {
  return formatReedTimelineTime({
    timestamp,
    now: context.clientNow,
    timeZone: context.clientTimeZone,
  });
}

function normalizeTimeZone(timeZone?: string) {
  if (!timeZone || timeZone.length > 80) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return null;
  }
}

function formatElapsed(ageMs: number) {
  const minutes = Math.max(1, Math.round(Math.max(0, ageMs) / 60_000));
  if (minutes < 2) return 'about a minute';
  if (minutes < 60) return `about ${minutes} minutes`;

  const hours = Math.round(minutes / 60);
  if (hours < 2) return 'about an hour';
  if (hours < 48) return `about ${hours} hours`;

  const days = Math.round(hours / 24);
  if (days < 2) return 'about a day';
  if (days < 14) return `about ${days} days`;

  const weeks = Math.round(days / 7);
  if (weeks < 8) return `about ${weeks} weeks`;

  const months = Math.round(days / 30);
  return months < 2 ? 'about a month' : `about ${months} months`;
}

type ReedChatResult = {
  agenda: string[];
  response: string;
};

async function invokeChatModel(prompt: { system: string; user: string }, fallbackAgenda: string[]): Promise<ReedChatResult> {
  if (!process.env.XAI_API_KEY) {
    return { agenda: fallbackAgenda, response: fallbackAssistantReply(prompt.user) };
  }

  console.log('[REED_CHAT_MODEL_REQUEST]', {
    model: CHAT_MODEL_NAME,
    systemChars: prompt.system.length,
    userChars: prompt.user.length,
  });

  const responseText = await withLangfuseGeneration({
    input: {
      system: traceText(prompt.system),
      user: traceText(prompt.user),
    },
    model: CHAT_MODEL_NAME,
    modelParameters: {
      reasoningEffort: CHAT_REASONING_MODE,
      temperature: 0.45,
    },
    name: 'reed.chat.model',
  }, async () => retryModelCall(
    () => invokeChatModelOnce(prompt),
    {
      attempts: CHAT_MODEL_ATTEMPTS,
      label: 'REED_CHAT_MODEL',
      retryDelayMs: CHAT_MODEL_RETRY_DELAY_MS,
      timeoutMs: CHAT_MODEL_TIMEOUT_MS,
    },
  ));

  console.log('[REED_CHAT_MODEL_RESPONSE]', {
    model: CHAT_MODEL_NAME,
    responseChars: responseText.length,
  });

  return parseChatResult(responseText, fallbackAgenda);
}

async function invokeChatModelOnce(prompt: { system: string; user: string }, signal?: AbortSignal) {
  const model = new ChatXAI({
    apiKey: process.env.XAI_API_KEY,
    model: CHAT_MODEL_NAME,
    temperature: 0.45,
    maxRetries: 0,
    // xAI-specific reasoning controls differ by model/API version; keep isolated here.
    reasoningEffort: CHAT_REASONING_MODE,
  } as ConstructorParameters<typeof ChatXAI>[0] & { reasoningEffort?: string });

  const agent = createAgent({
    model,
    tools: [],
    systemPrompt: prompt.system,
  });

  const result = await agent.invoke(
    { messages: [new HumanMessage(prompt.user)] },
    { recursionLimit: 4, signal } as { recursionLimit: number; signal?: AbortSignal },
  );
  return extractLastText(result.messages) || fallbackAssistantReply(prompt.user);
}

function parseChatResult(text: string, fallbackAgenda: string[]): ReedChatResult {
  const fallback = { agenda: fallbackAgenda, response: text.trim() || fallbackAssistantReply('') };
  try {
    const value = JSON.parse(extractJsonObject(text));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
    const record = value as Record<string, unknown>;
    const response = typeof record.response === 'string' && record.response.trim()
      ? record.response.trim()
      : fallback.response;
    const agenda = Array.isArray(record.agenda)
      ? record.agenda
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => item.slice(0, 160))
        .slice(0, 4)
      : [];
    return { agenda, response };
  } catch {
    return fallback;
  }
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

async function invokeCoachStateModel(prompt: string) {
  if (!process.env.OPENAI_API_KEY) {
    return deterministicCoachState(prompt);
  }

  const model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: COACH_STATE_MODEL_NAME,
    maxRetries: 1,
    reasoning: { effort: COACH_STATE_REASONING_EFFORT },
  } as ConstructorParameters<typeof ChatOpenAI>[0] & { reasoning?: { effort: string } });
  const result = await withLangfuseGeneration({
    input: {
      prompt: traceText(prompt),
      task: 'Write only the updated private coach state.',
    },
    model: COACH_STATE_MODEL_NAME,
    modelParameters: { reasoningEffort: COACH_STATE_REASONING_EFFORT },
    name: 'reed.coach_state.model',
  }, async () => model.invoke([
    new SystemMessage(prompt),
    new HumanMessage('Write only the updated private coach state.'),
  ]));
  return (textFromContent(result.content) || deterministicCoachState(prompt)).slice(0, 2400);
}

async function invokeSummaryModel(prompt: string) {
  if (!hasApiKeyForModel(SUMMARY_MODEL_NAME)) {
    return deterministicSummary(prompt);
  }

  const modelSettings = supportedModelSettings({ modelName: SUMMARY_MODEL_NAME, temperature: 0.1 });
  const model = createChatModel({
    modelName: SUMMARY_MODEL_NAME,
    temperature: modelSettings.temperature,
    maxRetries: 1,
  });
  try {
    const result = await withLangfuseGeneration({
      input: {
        prompt: traceText(prompt),
        system: 'Summarize Reed coaching continuity. Be compact and factual.',
      },
      model: SUMMARY_MODEL_NAME,
      modelParameters: modelSettings,
      name: 'reed.summary.model',
    }, async () => model.invoke([new SystemMessage('Summarize Reed coaching continuity. Be compact and factual.'), new HumanMessage(prompt)]));
    return textFromContent(result.content) || deterministicSummary(prompt);
  } catch (error) {
    console.error('[REED_SUMMARY_ERROR]', error instanceof Error ? { message: error.message, stack: error.stack } : error);
    return deterministicSummary(prompt);
  }
}

async function invokeImageAnalysisModel(ctx: ActionCtx, input: { storageId: Id<'_storage'>; sortOrder: number }) {
  if (!hasApiKeyForModel(IMAGE_ANALYSIS_MODEL_NAME)) {
    throw new Error(`API key is not configured for Reed image analysis model ${IMAGE_ANALYSIS_MODEL_NAME}.`);
  }

  const url = await ctx.storage.getUrl(input.storageId);
  if (!url) throw new Error('Attached image file is not available in Convex storage.');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load attached image from storage: ${response.status}`);
  }

  const imageBytes = await response.arrayBuffer();
  const base64Image = Buffer.from(imageBytes).toString('base64');
  const modelSettings = supportedModelSettings({ modelName: IMAGE_ANALYSIS_MODEL_NAME, temperature: 0.2 });
  const model = createChatModel({
    modelName: IMAGE_ANALYSIS_MODEL_NAME,
    temperature: modelSettings.temperature,
    maxRetries: 1,
  });

  const result = await withLangfuseGeneration({
    input: {
      imageBytes: imageBytes.byteLength,
      sortOrder: input.sortOrder,
      storageId: input.storageId,
    },
    model: IMAGE_ANALYSIS_MODEL_NAME,
    modelParameters: modelSettings,
    name: 'reed.image_analysis.model',
  }, async () => model.invoke([
    new SystemMessage([
      'You are Reed\'s fast visual analysis pass for a fitness coaching chat.',
      'Look at the attached JPEG like an experienced coach.',
      'Write a concise narrative observation that separates useful signal from visual noise.',
      'Focus on training, exercise setup, movement clues, body positioning, equipment, recovery, or safety if visible.',
      'Mark uncertainty naturally. Do not diagnose medical conditions. Do not invent facts outside the image.',
      'The final Reed chat model will read this observation before answering the user.',
    ].join('\n')),
    new HumanMessage({
      content: [
        {
          type: 'text',
          text: `Analyze image ${input.sortOrder + 1} for Reed. Return only the narrative observation.`,
        },
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${base64Image}` },
        },
      ],
    }),
  ]));

  const narrative = textFromContent(result.content);
  if (!narrative) throw new Error('Gemini returned an empty image observation.');
  return narrative.slice(0, 1800);
}

async function buildSummaryPrompt(input: { systemPrompt: string; priorSummary: string | null; messages: Array<{ role: string; content: string }> }) {
  return renderMustachePrompt(input.systemPrompt, {
    previous_summary: input.priorSummary?.trim() || 'No previous memory summary yet.',
    recent_messages: input.messages.length > 0
      ? input.messages.map(message => `${message.role.toUpperCase()}: ${message.content}`).join('\n')
      : 'No recent messages are available.',
  });
}

async function renderCoachStatePrompt(input: {
  template: string;
  previousCoachState: string | null;
  rollingSummary: string | null;
  journeyContext: string | null;
  recentMessages: Array<{ role: string; content: string }>;
}) {
  return renderMustachePrompt(input.template, {
    previous_coach_state: input.previousCoachState?.trim() || 'No previous private coach dialogue yet.',
    rolling_summary: input.rollingSummary?.trim() || 'No compacted chat summary yet.',
    journey_context: input.journeyContext?.trim() || 'No journey snapshot is available yet.',
    recent_messages: input.recentMessages.length > 0
      ? input.recentMessages.map(message => `${message.role.toUpperCase()}: ${message.content}`).join('\n')
      : 'No recent messages are available.',
  });
}

async function renderMustachePrompt(template: string, values: Record<string, string>) {
  return await PromptTemplate.fromTemplate(template, { templateFormat: 'mustache' }).format(values);
}

function fallbackAssistantReply(userMessage: string) {
  return `I’m here. Based on what you said, the useful next move is to make this specific: ${userMessage.slice(0, 180)}\n\nWhat I see: you’re asking for coaching direction.\nWhy it matters: Reed can give better guidance when the goal and recent training context are clear.\nNext focus: tell me what you did most recently, or ask me to review a specific lift, session, or week.`;
}

function deterministicSummary(prompt: string) {
  const lines = prompt
    .split('\n')
    .filter(line => /^(USER|ASSISTANT):/.test(line))
    .slice(-10)
    .map(line => line.slice(0, 240));
  return lines.length > 0
    ? `Recent Reed continuity:\n${lines.join('\n')}`
    : 'No durable coaching memory has been established yet.';
}

function deterministicCoachState(prompt: string) {
  const lines = prompt
    .split('\n')
    .filter(line => /^(USER|ASSISTANT):/.test(line))
    .slice(-8)
    .map(line => line.slice(0, 220));
  const recent = lines.length > 0 ? ` Recent evidence: ${lines.join(' / ')}` : '';
  return `I do not have enough model-backed evidence to update this deeply yet. I should stay steady, practical, and honest: keep pressure moderate, warmth/trust stable, depth brief unless the user asks for more, and agency collaborative. I should avoid pretending certainty or switching into a persona.${recent} Reconsider after the next meaningful exchange.`;
}

async function retryModelCall<T>(
  call: (signal?: AbortSignal) => Promise<T>,
  options: { attempts: number; label: string; retryDelayMs: number; timeoutMs: number },
) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await callWithTimeout(signal => call(signal), options.timeoutMs);
    } catch (error) {
      lastError = error;
      console.error(`[${options.label}_ATTEMPT_FAILED]`, {
        attempt,
        message: error instanceof Error ? error.message : String(error),
      });
      if (attempt < options.attempts) {
        await delay(options.retryDelayMs);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function callWithTimeout<T>(call: (signal: AbortSignal) => Promise<T>, timeoutMs: number) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      call(controller.signal),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`Model call timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractLastText(messages: unknown) {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  const last = messages[messages.length - 1] as { content?: unknown };
  return textFromContent(last.content);
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text: unknown }).text);
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return `h${(hash >>> 0).toString(16)}`;
}

declare function loadContextType(): Promise<{
  clientNow: number;
  clientTimeZone?: string;
  priorLastMessageAt: number | null;
  reentryState: 'hot' | 'warm' | 'cold';
  thread: { _id: Id<'reedThreads'>; agendaItems?: string[] };
  profile: { _id: Id<'profiles'>; displayName?: string };
  assistantMessage: { _id: Id<'reedMessages'> };
  userMessage: { _id: Id<'reedMessages'>; content: string; createdAt: number };
  prompt: { _id: string | null; content: string; contentHash: string };
  coachState: { content: string } | null;
  imageObservations: Array<{ narrative: string; sortOrder: number; status: 'analyzed' | 'failed' }>;
  appTimeline: Array<{ at: number; summary: string }>;
  currentAppState: string;
  journeySummary: string | null;
  memorySummary: string | null;
  recentMessages: Array<{ _id: Id<'reedMessages'>; role: string; content: string; createdAt: number }>;
}>;

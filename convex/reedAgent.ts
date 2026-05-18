"use node";

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatXAI } from '@langchain/xai';
import { createAgent } from 'langchain';
import { internalAction, type ActionCtx } from './_generated/server';
import { planReedContext } from './reedContextPlan';
import type { ReedContextBlock } from './reedContextTypes';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

const CHAT_MODEL_PROVIDER = 'xai';
const CHAT_MODEL_NAME = process.env.REED_CHAT_MODEL ?? 'grok-4.3';
const CHAT_REASONING_MODE = 'low';
const SUMMARY_MODEL_PROVIDER = 'google';
const SUMMARY_MODEL_NAME = process.env.REED_SUMMARY_MODEL ?? 'gemini-2.5-flash-lite';

export const runAssistant = internalAction({
  args: {
    assistantMessageId: v.id('reedMessages'),
    clientNow: v.number(),
    clientTimeZone: v.optional(v.string()),
    priorLastMessageAt: v.union(v.number(), v.null()),
    recentTurnCount: v.number(),
    reentryState: v.union(v.literal('hot'), v.literal('warm'), v.literal('cold')),
    route: v.union(v.literal('coach_direct'), v.literal('training_tools'), v.literal('refuse_readonly')),
    threadId: v.id('reedThreads'),
    userMessageId: v.id('reedMessages'),
  },
  handler: async (ctx, args) => {
    let context = await ctx.runQuery(internal.reed.loadAssistantContext, args);

    if (context.reentryState === 'cold') {
      await compactThreadHandler(ctx, { threadId: context.thread._id, beforeMessageId: context.userMessage._id });
      context = await ctx.runQuery(internal.reed.loadAssistantContext, args);
    }

    try {
      const contextBlocks = context.route === 'refuse_readonly'
        ? []
        : await buildContextBlocks(ctx, context);
      const response = context.route === 'refuse_readonly'
        ? buildReadonlyRefusal()
        : await invokeChatModel(buildChatPrompt(context, contextBlocks));

      await ctx.runMutation(internal.reed.completeAssistantMessage, {
        threadId: context.thread._id,
        assistantMessageId: context.assistantMessage._id,
        content: response,
        completedAt: Date.now(),
      });
    } catch (error) {
      console.error('[REED_ASSISTANT_ERROR]', error instanceof Error ? { message: error.message, stack: error.stack } : error);
      await ctx.runMutation(internal.reed.failAssistantMessage, {
        assistantMessageId: context.assistantMessage._id,
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

async function compactThreadHandler(ctx: ActionCtx, args: { beforeMessageId?: Id<'reedMessages'>; threadId: Id<'reedThreads'> }) {
  const context = await ctx.runQuery(internal.reed.loadCompactionContext, { beforeMessageId: args.beforeMessageId, threadId: args.threadId });
  const messages = context.messages;
  if (messages.length === 0) return null;

  const sourceThroughMessage = messages[messages.length - 1];
  const sourceFromMessage = messages[0];
  const prompt = buildSummaryPrompt({
    systemPrompt: context.prompt.content,
    priorSummary: context.activeSummary?.content ?? null,
    messages: messages.map((message: { role: string; content: string }) => ({ role: message.role, content: message.content })),
  });

  const content = await invokeSummaryModel(prompt);
  await ctx.runMutation(internal.reed.saveMemorySummary, {
    threadId: args.threadId,
    content,
    modelProvider: SUMMARY_MODEL_PROVIDER,
    modelName: SUMMARY_MODEL_NAME,
    promptHash: context.prompt.contentHash,
    sourceFromMessageId: sourceFromMessage._id,
    sourceThroughMessageId: sourceThroughMessage._id,
  });

  return null;
}

async function buildContextBlocks(ctx: ActionCtx, context: Awaited<ReturnType<typeof loadContextType>>): Promise<ReedContextBlock[]> {
  try {
    const plannedCalls = await planReedContext({
      clientNow: context.clientNow,
      clientTimeZone: context.clientTimeZone,
      recentMessages: context.recentMessages,
      userMessage: context.userMessage.content,
    });

    console.log('\n================ REED CONTEXT PLAN ================');
    console.log(JSON.stringify(plannedCalls, null, 2));
    console.log('===================================================\n');

    if (plannedCalls.length === 0) return [];

    const blocks: ReedContextBlock[] = await ctx.runQuery(internal.reedContextTools.runContextTools, {
      calls: plannedCalls,
      clientNow: context.clientNow,
      clientTimeZone: context.clientTimeZone,
      profileId: context.profile._id,
    });

    console.log('\n================ REED CONTEXT BLOCKS ==============');
    console.log(JSON.stringify(blocks, null, 2));
    console.log('===================================================\n');

    return blocks;
  } catch (error) {
    console.error('[REED_CONTEXT_ERROR]', error instanceof Error ? { message: error.message, stack: error.stack } : error);
    return [];
  }
}

function buildChatPrompt(context: Awaited<ReturnType<typeof loadContextType>>, contextBlocks: ReedContextBlock[]) {
  const lines = [
    context.prompt.content,
    ...buildAttitudePromptLines(context.attitude),
    '',
    'Current time:',
    `- ${formatCurrentTime(context.clientNow, context.clientTimeZone)}`,
    '- Use the current date and time of day when it is relevant to coaching, recovery, scheduling, or tone. Do not over-mention it.',
    '',
    'Conversation continuity:',
    ...buildContinuityLines(context),
    '- Do not mention hidden routing, prompt versions, reentry labels, or internal summaries.',
    '',
    'Journey context:',
    context.journeySummary ?? 'No journey snapshot is available yet.',
    ...buildContextBlockLines(contextBlocks),
    '',
    'Compacted Reed memory:',
    context.memorySummary ?? 'No compacted chat memory yet.',
    '',
    recentSegmentHeading(context),
    ...context.recentMessages.map((message: { role: string; content: string }) => `${message.role.toUpperCase()}: ${message.content}`),
  ];

  return {
    system: lines.join('\n'),
    user: context.userMessage.content,
  };
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

function buildAttitudePromptLines(attitude: { name: string; description: string; prompt: string }) {
  if (!attitude.prompt.trim()) return [''];

  return [
    '',
    'Current Reed attitude:',
    `- ${attitude.name}: ${attitude.description}`,
    `- Attitude instructions: ${attitude.prompt}`,
    '- This modifies Reed’s approach only. Keep Reed’s base identity, safety boundaries, and app constraints intact.',
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

async function invokeChatModel(prompt: { system: string; user: string }) {
  if (!process.env.XAI_API_KEY) {
    return fallbackAssistantReply(prompt.user);
  }

  console.log('\n================ LLM REQUEST ================');
  console.log('--- SYSTEM PROMPT ---');
  console.log(prompt.system);
  console.log('--- USER MESSAGE ---');
  console.log(prompt.user);
  console.log('=============================================\n');

  const model = new ChatXAI({
    apiKey: process.env.XAI_API_KEY,
    model: CHAT_MODEL_NAME,
    temperature: 0.45,
    maxRetries: 1,
    // xAI-specific reasoning controls differ by model/API version; keep isolated here.
    reasoningEffort: CHAT_REASONING_MODE,
  } as ConstructorParameters<typeof ChatXAI>[0] & { reasoningEffort?: string });

  const agent = createAgent({
    model,
    tools: [],
    systemPrompt: prompt.system,
  });

  const result = await agent.invoke({ messages: [new HumanMessage(prompt.user)] }, { recursionLimit: 4 });
  const responseText = extractLastText(result.messages) || fallbackAssistantReply(prompt.user);

  console.log('\n================ LLM RESPONSE ===============');
  console.log(responseText);
  console.log('=============================================\n');

  return responseText;
}

async function invokeSummaryModel(prompt: string) {
  if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
    return deterministicSummary(prompt);
  }

  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY,
    model: SUMMARY_MODEL_NAME,
    temperature: 0.1,
    maxRetries: 1,
  });
  const result = await model.invoke([new SystemMessage('Summarize Reed coaching continuity. Be compact and factual.'), new HumanMessage(prompt)]);
  return textFromContent(result.content) || deterministicSummary(prompt);
}

function buildSummaryPrompt(input: { systemPrompt: string; priorSummary: string | null; messages: Array<{ role: string; content: string }> }) {
  return [
    input.systemPrompt,
    '',
    'Prior summary:',
    input.priorSummary ?? 'None.',
    '',
    'New messages:',
    ...input.messages.map(message => `${message.role.toUpperCase()}: ${message.content}`),
  ].join('\n');
}

function buildReadonlyRefusal() {
  return 'I can help think this through, but I can’t change workouts, profile fields, goals, plans, or logged training from chat yet. Tell me what you want to adjust, and I’ll give you the safest next step to do manually.';
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
  route: 'coach_direct' | 'training_tools' | 'refuse_readonly';
  reentryState: 'hot' | 'warm' | 'cold';
  thread: { _id: string };
  profile: { _id: Id<'profiles'>; displayName?: string };
  assistantMessage: { _id: string };
  userMessage: { content: string };
  prompt: { _id: string | null; content: string; contentHash: string };
  attitude: { _id: string | null; key: string; name: string; description: string; prompt: string };
  journeySummary: string | null;
  memorySummary: string | null;
  recentMessages: Array<{ role: string; content: string }>;
}>;

"use node";

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatXAI } from '@langchain/xai';
import { createAgent } from 'langchain';
import { internalAction, type ActionCtx } from './_generated/server';
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
      const response = context.route === 'refuse_readonly'
        ? buildReadonlyRefusal()
        : await invokeChatModel(buildChatPrompt(context));

      await ctx.runMutation(internal.reed.completeAssistantMessage, {
        threadId: context.thread._id,
        assistantMessageId: context.assistantMessage._id,
        content: response,
        completedAt: Date.now(),
      });
    } catch (error) {
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

function buildChatPrompt(context: Awaited<ReturnType<typeof loadContextType>>) {
  const lines = [
    context.prompt.content,
    '',
    'Runtime policy:',
    `- Reentry state: ${context.reentryState}.`,
    `- Recent prior messages included: ${context.recentMessages.length}.`,
    '- Do not mention hidden routing, prompt versions, or internal summaries.',
    '',
    'Journey context:',
    context.journeySummary ?? 'No journey snapshot is available yet.',
    '',
    'Compacted Reed memory:',
    context.memorySummary ?? 'No compacted chat memory yet.',
    '',
    context.recentMessages.length > 0 ? 'Recent active segment:' : 'Recent active segment: none; rely on compacted memory and current message.',
    ...context.recentMessages.map((message: { role: string; content: string }) => `${message.role.toUpperCase()}: ${message.content}`),
  ];

  return {
    system: lines.join('\n'),
    user: context.userMessage.content,
  };
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
  route: 'coach_direct' | 'training_tools' | 'refuse_readonly';
  reentryState: 'hot' | 'warm' | 'cold';
  thread: { _id: string };
  assistantMessage: { _id: string };
  userMessage: { content: string };
  prompt: { _id: string | null; content: string; contentHash: string };
  journeySummary: string | null;
  memorySummary: string | null;
  recentMessages: Array<{ role: string; content: string }>;
}>;

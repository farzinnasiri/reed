"use node";

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, type ActionCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { createChatModel, hasApiKeyForModel, supportedModelSettings } from './aiModelProvider';
import { SESSION_FEEDBACK_SYSTEM_PROMPT } from './coachNotificationPrompts';
import { traceText, withLangfuseGeneration, withLangfuseTrace } from './langfuseTracing';
import { captureBackendEvent } from './backendTelemetry';

const MODEL_NAME = process.env.REED_SESSION_FEEDBACK_MODEL ?? 'gpt-5.1-mini';
const REASONING_EFFORT = process.env.REED_SESSION_FEEDBACK_REASONING_EFFORT ?? 'medium';
const SEND_DELAY_MS = 2 * 60 * 1000;
const EXPIRES_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type SessionFeedbackOutput = {
  chatMessageText: string | null;
  pushBody: string | null;
  pushTitle: string | null;
  reason: string;
  shouldSend: boolean;
};

export const reviewEndedSession = internalAction({
  args: { sessionId: v.id('liveSessions') },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await withLangfuseTrace({
        input: { sessionId: args.sessionId },
        metadata: { sessionId: args.sessionId },
        name: 'reed.session_feedback.review',
        sessionId: `liveSession:${args.sessionId}`,
        tags: ['reed', 'notifications', 'session_feedback'],
        version: MODEL_NAME,
      }, async () => {
        const snapshot = await ctx.runQuery(internal.sessionFeedbackData.snapshot, { sessionId: args.sessionId });
        if (!snapshot) {
          await recordEvent('session_feedback_skipped', { reason: 'no_snapshot', sessionId: args.sessionId });
          return null;
        }

        const output = await writeFeedback(snapshot);
        const chatMessageText = output.chatMessageText?.trim();
        const pushTitle = output.pushTitle?.trim();
        const pushBody = output.pushBody?.trim();
        await recordEvent('session_feedback_decided', {
          reason: output.reason,
          sessionId: args.sessionId,
          shouldSend: output.shouldSend,
        }, snapshot.profileId);
        if (!output.shouldSend || !chatMessageText || !pushTitle || !pushBody) return null;

        await enqueueFeedback(ctx, {
          chatMessageText,
          profileId: snapshot.profileId,
          pushBody,
          pushTitle,
          sessionId: args.sessionId,
        });
        await recordEvent('session_feedback_enqueued', {
          sessionId: args.sessionId,
        }, snapshot.profileId);
        return null;
      });
    } catch (error) {
      await recordEvent('session_feedback_failed', {
        error: error instanceof Error ? error.message : 'session_feedback_failed',
        sessionId: args.sessionId,
      });
      throw error;
    }
    return null;
  },
});

async function enqueueFeedback(ctx: ActionCtx, args: {
  chatMessageText: string;
  profileId: Id<'profiles'>;
  pushBody: string;
  pushTitle: string;
  sessionId: Id<'liveSessions'>;
}) {
  const now = Date.now();
  await ctx.runMutation(internal.outboundMessages.enqueue, {
    body: args.pushBody,
    channels: { push: true, reedChat: true },
    chatMessageText: args.chatMessageText,
    data: {
      screen: 'reed',
      sessionId: args.sessionId,
    },
    dedupeKey: `session-feedback:${args.sessionId}`,
    expiresAt: now + EXPIRES_AFTER_MS,
    kind: 'post_workout_feedback',
    notificationKind: 'coach_catchup',
    priority: 'normal',
    profileId: args.profileId,
    scheduledFor: now + SEND_DELAY_MS,
    source: 'session_feedback_agent',
    title: args.pushTitle,
  });
}

async function writeFeedback(snapshot: unknown): Promise<SessionFeedbackOutput> {
  if (!hasApiKeyForModel(MODEL_NAME)) {
    return { shouldSend: false, chatMessageText: null, pushTitle: null, pushBody: null, reason: 'model_unavailable' };
  }

  const modelSettings = supportedModelSettings({
    modelName: MODEL_NAME,
    reasoningEffort: REASONING_EFFORT,
    temperature: 0.25,
  });
  const model = createChatModel({
    maxRetries: 1,
    modelName: MODEL_NAME,
    reasoningEffort: modelSettings.reasoningEffort,
    temperature: modelSettings.temperature,
  });
  const modelInput = JSON.stringify(snapshot);
  const result = await withLangfuseGeneration({
    input: {
      snapshot: traceText(modelInput, 4_000),
      system: traceText(SESSION_FEEDBACK_SYSTEM_PROMPT),
    },
    model: MODEL_NAME,
    modelParameters: modelSettings,
    name: 'reed.session_feedback.model',
  }, async () => model.invoke([
    new SystemMessage(SESSION_FEEDBACK_SYSTEM_PROMPT),
    new HumanMessage(modelInput),
  ]));
  return normalizeOutput(parseJson(textFromContent(result.content)));
}

async function recordEvent(name: string, attrs: Record<string, string | number | boolean | null>, profileId?: Id<'profiles'>) {
  await captureBackendEvent(name, attrs, profileId);
}

function normalizeOutput(value: unknown): SessionFeedbackOutput {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return {
    chatMessageText: typeof record.chatMessageText === 'string' ? record.chatMessageText.slice(0, 700) : null,
    pushBody: typeof record.pushBody === 'string' ? record.pushBody.slice(0, 180) : null,
    pushTitle: typeof record.pushTitle === 'string' ? record.pushTitle.slice(0, 80) : null,
    reason: record.shouldSend === true ? 'send' : 'model_no_send',
    shouldSend: record.shouldSend === true,
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = /\{[\s\S]*\}/.exec(text);
    return match ? JSON.parse(match[0]) : {};
  }
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map(part => typeof part === 'object' && part && 'text' in part ? String((part as { text: unknown }).text) : '').join('').trim();
  }
  return '';
}

"use node";

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, type ActionCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { createChatModel, hasApiKeyForModel, supportedModelSettings } from './aiModelProvider';
import type { NotificationKind } from './notificationTypes';
import { COACH_OUTREACH_SYSTEM_PROMPT } from './coachNotificationPrompts';
import { traceText, withLangfuseGeneration, withLangfuseTrace } from './langfuseTracing';
import { captureBackendEvent } from './backendTelemetry';

const MODEL_NAME = process.env.REED_COACH_OUTREACH_MODEL ?? 'gpt-5.1-mini';
const REASONING_EFFORT = process.env.REED_COACH_OUTREACH_REASONING_EFFORT ?? 'medium';
const EXPIRES_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type OutreachDecision = {
  chatMessageText: string | null;
  kind: 'absence_check_in' | 'goal_drift' | 'reward' | 'weekly_reflection' | null;
  notificationKind: Exclude<NotificationKind, 'reminder' | 'system'> | null;
  pushBody: string | null;
  pushTitle: string | null;
  reason: string;
  scheduledForOffsetHours: number | null;
  shouldSend: boolean;
};

export const reviewDueProfiles = internalAction({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    try {
      await withLangfuseTrace({
        name: 'reed.coach_outreach.review',
        tags: ['reed', 'notifications', 'coach_outreach'],
        version: MODEL_NAME,
      }, async () => {
        const now = Date.now();
        const claimed = await ctx.runMutation(internal.outreachState.claimDue, { now });
        await recordEvent('coach_outreach_claimed', { count: claimed.length });

        for (const item of claimed) {
          try {
            const snapshot = await ctx.runQuery(internal.coachOutreachData.snapshot, { profileId: item.profileId });
            if (!snapshot) {
              await recordEvent('coach_outreach_skipped', { reason: 'no_snapshot', stateId: item.stateId }, item.profileId);
              await markCompleted(ctx, item.stateId, now);
              continue;
            }

            const decision = await decide(snapshot);
            await recordEvent('coach_outreach_decided', {
              kind: decision.kind,
              reason: decision.reason,
              shouldSend: decision.shouldSend,
              stateId: item.stateId,
            }, item.profileId);
            if (shouldEnqueue(decision)) {
              await enqueueOutreach(ctx, {
                decision,
                profileId: item.profileId,
                reviewAt: now,
              });
              await recordEvent('coach_outreach_enqueued', {
                kind: decision.kind,
                stateId: item.stateId,
              }, item.profileId);
              await markCompleted(ctx, item.stateId, now, now);
            } else {
              await markCompleted(ctx, item.stateId, now);
            }
          } catch (error) {
            await recordEvent('coach_outreach_failed', {
              error: error instanceof Error ? error.message : 'coach_outreach_failed',
              stateId: item.stateId,
            }, item.profileId);
            await ctx.runMutation(internal.outreachState.markFailed, {
              error: error instanceof Error ? error.message : 'coach_outreach_failed',
              now: Date.now(),
              stateId: item.stateId,
            });
          }
        }
        return null;
      });
    } catch (error) {
      await recordEvent('coach_outreach_worker_failed', {
        error: error instanceof Error ? error.message : 'coach_outreach_worker_failed',
      });
      throw error;
    }

    return null;
  },
});

async function enqueueOutreach(ctx: ActionCtx, args: {
  decision: OutreachDecision;
  profileId: Id<'profiles'>;
  reviewAt: number;
}) {
  const offsetHours = Math.min(Math.max(args.decision.scheduledForOffsetHours ?? 1, 0), 7 * 24);
  const scheduledFor = args.reviewAt + offsetHours * 60 * 60 * 1000;
  await ctx.runMutation(internal.outboundMessages.enqueue, {
    body: args.decision.pushBody ?? '',
    channels: { push: true, reedChat: true },
    chatMessageText: args.decision.chatMessageText ?? '',
    data: { screen: 'reed' },
    dedupeKey: `coach-outreach:${args.profileId}:${weeklyBucket(args.reviewAt)}`,
    expiresAt: args.reviewAt + EXPIRES_AFTER_MS,
    kind: args.decision.kind ?? 'weekly_reflection',
    notificationKind: args.decision.notificationKind ?? 'coach_catchup',
    priority: 'normal',
    profileId: args.profileId,
    scheduledFor,
    source: 'coach_outreach_agent',
    title: args.decision.pushTitle ?? '',
  });
}

async function decide(snapshot: unknown): Promise<OutreachDecision> {
  if (!hasApiKeyForModel(MODEL_NAME)) return emptyDecision();

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
      system: traceText(COACH_OUTREACH_SYSTEM_PROMPT),
    },
    model: MODEL_NAME,
    modelParameters: modelSettings,
    name: 'reed.coach_outreach.model',
  }, async () => model.invoke([
    new SystemMessage(COACH_OUTREACH_SYSTEM_PROMPT),
    new HumanMessage(modelInput),
  ]));
  return normalizeDecision(parseJson(textFromContent(result.content)));
}

function shouldEnqueue(decision: OutreachDecision) {
  return decision.shouldSend
    && Boolean(decision.kind)
    && Boolean(decision.notificationKind)
    && Boolean(decision.chatMessageText?.trim())
    && Boolean(decision.pushTitle?.trim())
    && Boolean(decision.pushBody?.trim());
}

function normalizeDecision(value: unknown): OutreachDecision {
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const kind = parseKind(record.kind);
  const notificationKind = parseNotificationKind(record.notificationKind);
  return {
    chatMessageText: typeof record.chatMessageText === 'string' ? record.chatMessageText.slice(0, 700) : null,
    kind,
    notificationKind,
    pushBody: typeof record.pushBody === 'string' ? record.pushBody.slice(0, 180) : null,
    pushTitle: typeof record.pushTitle === 'string' ? record.pushTitle.slice(0, 80) : null,
    reason: record.shouldSend === true ? 'send' : 'model_no_send',
    scheduledForOffsetHours: typeof record.scheduledForOffsetHours === 'number' ? record.scheduledForOffsetHours : null,
    shouldSend: record.shouldSend === true,
  };
}

function parseKind(value: unknown): OutreachDecision['kind'] {
  if (value === 'absence_check_in' || value === 'goal_drift' || value === 'reward' || value === 'weekly_reflection') return value;
  return null;
}

function parseNotificationKind(value: unknown): OutreachDecision['notificationKind'] {
  if (value === 'coach_catchup' || value === 'digest' || value === 'reward') return value;
  return null;
}

function emptyDecision(): OutreachDecision {
  return {
    chatMessageText: null,
    kind: null,
    notificationKind: null,
    pushBody: null,
    pushTitle: null,
    reason: 'model_unavailable',
    scheduledForOffsetHours: null,
    shouldSend: false,
  };
}

async function markCompleted(ctx: ActionCtx, stateId: Id<'outreachStates'>, now: number, lastOutreachAt?: number) {
  await ctx.runMutation(internal.outreachState.markCompleted, { lastOutreachAt, now, stateId });
}

async function recordEvent(name: string, attrs: Record<string, string | number | boolean | null>, profileId?: Id<'profiles'>) {
  await captureBackendEvent(name, attrs, profileId);
}

function weeklyBucket(now: number) {
  return Math.floor(now / (7 * 24 * 60 * 60 * 1000));
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

"use node";

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v } from 'convex/values';
import { internalAction, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { createChatModel, hasApiKeyForModel, providerForModel } from './aiModelProvider';

const COACHING_MEMORY_MODEL = process.env.REED_COACHING_MEMORY_MODEL ?? 'gpt-5.4-mini-2026-03-17';
const COACHING_MEMORY_PROMPT_KEY = 'reed_coaching_memory_system';
const RECONCILE_WINDOW_MS = 12 * 60 * 60 * 1000;
const MAX_CHANGED_PROFILES = 25;

export const reconcileRecentlyChanged = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const profileIds: Array<Id<'profiles'>> = await ctx.runQuery(internal.reedCoachingMemory.collectRecentlyChangedProfiles, {
      limit: MAX_CHANGED_PROFILES,
      windowStartAt: now - RECONCILE_WINDOW_MS,
    });

    for (const profileId of profileIds) {
      await reconcileProfile(ctx, profileId, now);
    }

    return { processed: profileIds.length };
  },
});

export const reconcileProfileNow = internalAction({
  args: {
    profileId: v.id('profiles'),
  },
  handler: async (ctx, args) => {
    await reconcileProfile(ctx, args.profileId, Date.now());
    return null;
  },
});

async function reconcileProfile(ctx: ActionCtx, profileId: Id<'profiles'>, now: number) {
  const context = await ctx.runQuery(internal.reedCoachingMemory.loadReconciliationContext, { profileId, now });
  if (!context) return;
  if (context.messages.length === 0 && context.sessions.length === 0) return;

  const sourceFingerprint = simpleHash(JSON.stringify({
    messages: context.messages.map((message: { content: string; createdAt: number; role: string }) => [message.createdAt, message.role, message.content]),
    sessions: context.sessions.map((session: { endedAt: number | null; id: string; startedAt: number }) => [session.id, session.startedAt, session.endedAt]),
  }));
  if (sourceFingerprint === context.latestSourceFingerprint) return;
  const prompt = await ctx.runQuery(internal.reed.loadPromptByKey, { key: COACHING_MEMORY_PROMPT_KEY });

  try {
    const result = await invokeMemoryModel(context, prompt?.content ?? null);
    await ctx.runMutation(internal.reedCoachingMemory.saveReconciliationResult, {
      completedAt: Date.now(),
      journeys: result.journeys,
      mentalModel: result.mentalModel,
      modelName: COACHING_MEMORY_MODEL,
      modelProvider: providerForModel(COACHING_MEMORY_MODEL),
      profileId,
      promptHash: prompt?.contentHash ?? 'missing',
      sourceFingerprint,
      sourceThroughAt: context.sourceThroughAt,
    });
  } catch (error) {
    await ctx.runMutation(internal.reedCoachingMemory.saveReconciliationFailure, {
      error: error instanceof Error ? error.message : String(error),
      failedAt: Date.now(),
      profileId,
      sourceFingerprint,
      sourceThroughAt: context.sourceThroughAt,
    });
  }
}

async function invokeMemoryModel(context: unknown, systemPrompt: string | null): Promise<MemoryResult> {
  if (!systemPrompt || !hasApiKeyForModel(COACHING_MEMORY_MODEL)) return deterministicMemory(context);

  const model = createChatModel({
    modelName: COACHING_MEMORY_MODEL,
    temperature: 0.1,
    maxRetries: 1,
  });
  const result = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(JSON.stringify(context, null, 2)),
  ]);
  return normalizeMemoryResult(parseJson(textFromContent(result.content)));
}

type MemoryResult = {
  mentalModel: string;
  journeys: Array<{
    confidence: number;
    slug: string;
    status: 'active' | 'background' | 'dormant' | 'archived';
    strength: number;
    summary: string;
    title: string;
  }>;
};

function normalizeMemoryResult(value: unknown): MemoryResult {
  const object = isRecord(value) ? value : {};
  const journeys = Array.isArray(object.journeys) ? object.journeys : [];
  return {
    mentalModel: stringValue(object.mentalModel, 'The user is still early in Reed. Build the model from future evidence.').slice(0, 1800),
    journeys: journeys.slice(0, 12).map(normalizeJourney).filter(journey => journey.slug && journey.title && journey.summary),
  };
}

function normalizeJourney(value: unknown): MemoryResult['journeys'][number] {
  const object = isRecord(value) ? value : {};
  return {
    confidence: scoreValue(object.confidence),
    slug: slugify(stringValue(object.slug, stringValue(object.title, 'journey'))),
    status: statusValue(object.status),
    strength: scoreValue(object.strength),
    summary: stringValue(object.summary, '').slice(0, 1200),
    title: stringValue(object.title, 'Journey').slice(0, 80),
  };
}

function deterministicMemory(_context: unknown): MemoryResult {
  return {
    mentalModel: 'The user wants practical coaching that connects training, sport, skill acquisition, recovery, and identity. Keep a broad working model and avoid stale repetition.',
    journeys: [],
  };
}

function parseJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function textFromContent(content: unknown) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(part => isRecord(part) && typeof part.text === 'string' ? part.text : '').join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function scoreValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

function statusValue(value: unknown): MemoryResult['journeys'][number]['status'] {
  return value === 'active' || value === 'background' || value === 'dormant' || value === 'archived' ? value : 'background';
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function simpleHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index) | 0;
  }
  return `h${(hash >>> 0).toString(16)}`;
}

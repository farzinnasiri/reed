"use node";

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, type ActionCtx } from './_generated/server';
import { createChatModel, hasApiKeyForModel } from './aiModelProvider';
import type { Id } from './_generated/dataModel';

const MODEL_NAME = process.env.REED_PROFILE_INSIGHT_MODEL ?? 'gemini-2.5-flash-lite';

type InsightSnapshot = Awaited<ReturnType<typeof loadSnapshot>>;

export const generate = internalAction({
  args: {
    profileId: v.id('profiles'),
    reason: v.union(v.literal('daily_refresh'), v.literal('session_ended'), v.literal('profile_updated'), v.literal('body_updated')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const snapshot = await loadSnapshot(ctx, args.profileId, args.reason);
      const fallback = deterministicInsight(snapshot);
      const content = await writeInsight(snapshot, fallback);
      await ctx.runMutation(internal.profileInsight.saveGenerated, {
        profileId: args.profileId,
        content,
        modelName: MODEL_NAME,
        sourceChangedAt: snapshot.sourceChangedAt,
        sourceFingerprint: snapshot.fingerprint,
      });
    } catch (error) {
      console.error('[PROFILE_INSIGHT_ERROR]', error instanceof Error ? { message: error.message, stack: error.stack } : error);
      await ctx.runMutation(internal.profileInsight.saveFailed, {
        profileId: args.profileId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  },
});

async function loadSnapshot(ctx: ActionCtx, profileId: Id<'profiles'>, reason: string) {
  const data = await ctx.runQuery(internal.profileInsightData.snapshot, { profileId });
  return {
    ...data,
    reason,
    fingerprint: simpleHash(JSON.stringify({ data, reason })),
    sourceChangedAt: Date.now(),
  };
}

async function writeInsight(snapshot: InsightSnapshot, fallback: string) {
  if (!hasApiKeyForModel(MODEL_NAME)) return fallback;
  const model = createChatModel({
    modelName: MODEL_NAME,
    temperature: 0.35,
    maxRetries: 1,
  });
  const result = await model.invoke([
    new SystemMessage([
      'You are Reed, a precise training coach inside a serious fitness app.',
      'You help the user understand training, body status, consistency, recovery, and next focus from their own data.',
      '',
      'Write one profile insight in Reed’s voice.',
      'Speak directly to the user in first person/second person: use "I" and "you". Never say "the user".',
      'One paragraph. 35-70 words. Serious, calm, precise.',
      'Use 20/80 judgment: scan all provided signals and surface the most decision-relevant pattern, not merely the first or most numeric fact.',
      'You may combine two related signals when that creates a clearer insight, but do not list everything.',
      'No hype. No medical claims. No body-composition claims from weight alone.',
      'If data is thin, say the single next action that would create signal.',
      'Do not mention internal data structures.',
    ].join('\n')),
    new HumanMessage(JSON.stringify(snapshot)),
  ]);
  const text = textFromContent(result.content);
  return text || fallback;
}

function deterministicInsight(snapshot: InsightSnapshot) {
  if (!snapshot.trainingProfile) return 'I need your goals, body data, and training setup before this can become specific. Fill in the profile first; that gives me enough context to separate useful signal from generic coaching.';
  if (snapshot.week.sets > 0) return `I see ${snapshot.week.activeDays} active ${snapshot.week.activeDays === 1 ? 'day' : 'days'} this week, with ${snapshot.week.topGroups[0] ?? 'training'} carrying the clearest signal. Keep the next session aligned with ${snapshot.primaryGoal ?? 'your main goal'} rather than adding work just to fill space.`;
  return `I can see ${snapshot.primaryGoal ?? 'your goal'} is set, but this week has no logged training yet. One clean completed session gives me enough signal to compare your work against your target.`;
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map(part => typeof part === 'object' && part && 'text' in part ? String((part as { text: unknown }).text) : '').join('').trim();
  return '';
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  return `h${(hash >>> 0).toString(16)}`;
}

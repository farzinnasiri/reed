"use node";

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ReedContextToolCall, ReedTimeRange } from './reedContextTypes';

const CONTEXT_PLANNER_MODEL_NAME = process.env.REED_CONTEXT_PLANNER_MODEL ?? 'gemini-2.5-flash-lite';

const goalStatusSchema = z.enum(['all', 'active', 'completed', 'missed', 'archived']);

const timeRangeSchema = z.object({
  preset: z.enum(['today', 'yesterday', 'this_week', 'last_week', 'last_n_days', 'last_n_weeks']),
  days: z.number().int().min(1).max(180).optional(),
  weeks: z.number().int().min(1).max(26).optional(),
});

const contextTools = [
  tool(async () => 'planned', {
    name: 'summarize_training_window',
    description: 'Retrieve a compact deterministic summary of logged workouts/sets, top exercises, recent work, and muscle-group focus for a semantic time range.',
    schema: z.object({ range: timeRangeSchema }),
  }),
  tool(async () => 'planned', {
    name: 'get_bodyweight_trend',
    description: 'Retrieve deterministic bodyweight entries, latest value, and change over a semantic time range. Use when bodyweight could materially affect the answer.',
    schema: z.object({ range: timeRangeSchema }),
  }),
  tool(async () => 'planned', {
    name: 'get_training_goals',
    description: 'Read-only. Retrieve structured concrete training goals and deterministic progress. Use when the user asks about goals, targets, progress toward a goal, missed goals, completed goals, ongoing/active goals, priorities, or what to focus on. Use status=all when unsure.',
    schema: z.object({ status: goalStatusSchema.optional(), limit: z.number().int().min(1).max(50).optional() }),
  }),
  tool(async () => 'planned', {
    name: 'get_exercise_performance_history',
    description: 'Retrieve deterministic performance history for one named exercise over a semantic time range: exposures, working sets, best reps/load, and recent set summaries.',
    schema: z.object({ exerciseQuery: z.string().min(1).max(80), range: timeRangeSchema }),
  }),
];

export async function planReedContext(args: {
  clientNow: number;
  clientTimeZone?: string;
  recentMessages: Array<{ role: string; content: string }>;
  userMessage: string;
}): Promise<ReedContextToolCall[]> {
  if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) return [];

  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY,
    model: CONTEXT_PLANNER_MODEL_NAME,
    temperature: 0,
    maxRetries: 1,
  }).bindTools(contextTools);

  const result = await model.invoke([
    new SystemMessage(buildPlannerSystemPrompt(args)),
    new HumanMessage(args.userMessage),
  ]);

  return parseToolCalls(result.tool_calls).slice(0, 6);
}

function buildPlannerSystemPrompt(args: {
  clientNow: number;
  clientTimeZone?: string;
  recentMessages: Array<{ role: string; content: string }>;
}) {
  return [
    'You choose which context tools Reed needs before answering a fitness coaching chat.',
    'Call only tools that would materially improve the answer. Prefer fewer calls.',
    'Do not answer the user. Do not call tools for generic encouragement, greetings, or purely conversational replies.',
    'Use semantic time ranges only; never generate absolute dates.',
    'For today/this week/last week, use the matching preset.',
    'For progress goals, use enough history to judge current ability and trend, usually last_n_days 30-90.',
    '',
    `Current local time: ${formatCurrentTime(args.clientNow, args.clientTimeZone)}`,
    '',
    'Recent context:',
    ...args.recentMessages.slice(-6).map(message => `${message.role.toUpperCase()}: ${message.content.slice(0, 500)}`),
  ].join('\n');
}

function parseToolCalls(toolCalls: unknown): ReedContextToolCall[] {
  if (!Array.isArray(toolCalls)) return [];
  const parsed: ReedContextToolCall[] = [];
  for (const call of toolCalls) {
    if (!call || typeof call !== 'object') continue;
    const candidate = call as { name?: unknown; args?: unknown };
    const name = candidate.name;
    const args = candidate.args;
    if (name === 'summarize_training_window' && isObject(args) && isTimeRange(args.range)) {
      parsed.push({ name, args: { range: args.range } });
      continue;
    }
    if (name === 'get_bodyweight_trend' && isObject(args) && isTimeRange(args.range)) {
      parsed.push({ name, args: { range: args.range } });
      continue;
    }
    if (name === 'get_training_goals' && isObject(args)) {
      parsed.push({
        name,
        args: {
          ...(isGoalStatus(args.status) ? { status: args.status } : {}),
          ...(typeof args.limit === 'number' ? { limit: Math.max(1, Math.min(50, Math.round(args.limit))) } : {}),
        },
      });
      continue;
    }
    if (name === 'get_exercise_performance_history' && isObject(args) && typeof args.exerciseQuery === 'string' && isTimeRange(args.range)) {
      parsed.push({ name, args: { exerciseQuery: args.exerciseQuery.slice(0, 80), range: args.range } });
    }
  }
  return parsed;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isGoalStatus(value: unknown): value is NonNullable<Extract<ReedContextToolCall, { name: 'get_training_goals' }>['args']['status']> {
  return value === 'all' || value === 'active' || value === 'completed' || value === 'missed' || value === 'archived';
}

function isTimeRange(value: unknown): value is ReedTimeRange {
  if (!isObject(value) || typeof value.preset !== 'string') return false;
  if (['today', 'yesterday', 'this_week', 'last_week'].includes(value.preset)) return true;
  if (value.preset === 'last_n_days') return typeof value.days === 'number';
  if (value.preset === 'last_n_weeks') return typeof value.weeks === 'number';
  return false;
}

function formatCurrentTime(timestamp: number, timeZone?: string) {
  const safeTimeZone = normalizeTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    ...(safeTimeZone ? { timeZone: safeTimeZone } : {}),
  });
  const timeZoneLabel = safeTimeZone ? ` (${safeTimeZone})` : '';
  return `${formatter.format(new Date(timestamp))}${timeZoneLabel}`;
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

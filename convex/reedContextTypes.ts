import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

export const reedTimeRangeValidator = v.union(
  v.object({ preset: v.literal('today') }),
  v.object({ preset: v.literal('yesterday') }),
  v.object({ preset: v.literal('this_week') }),
  v.object({ preset: v.literal('last_week') }),
  v.object({ preset: v.literal('last_n_days'), days: v.number() }),
  v.object({ preset: v.literal('last_n_weeks'), weeks: v.number() }),
);


const reedGoalStatusFilterValidator = v.union(
  v.literal('all'),
  v.literal('active'),
  v.literal('completed'),
  v.literal('missed'),
  v.literal('archived'),
);

export const reedContextToolCallValidator = v.union(
  v.object({
    name: v.literal('summarize_training_window'),
    args: v.object({ range: reedTimeRangeValidator }),
  }),
  v.object({
    name: v.literal('get_bodyweight_trend'),
    args: v.object({ range: reedTimeRangeValidator }),
  }),
  v.object({
    name: v.literal('get_exercise_performance_history'),
    args: v.object({ exerciseQuery: v.string(), range: reedTimeRangeValidator }),
  }),
  v.object({
    name: v.literal('get_training_goals'),
    args: v.object({
      status: v.optional(reedGoalStatusFilterValidator),
      limit: v.optional(v.number()),
    }),
  }),
);

export type ReedTimeRange =
  | { preset: 'today' }
  | { preset: 'yesterday' }
  | { preset: 'this_week' }
  | { preset: 'last_week' }
  | { preset: 'last_n_days'; days: number }
  | { preset: 'last_n_weeks'; weeks: number };

export type ReedContextToolCall =
  | { name: 'summarize_training_window'; args: { range: ReedTimeRange } }
  | { name: 'get_bodyweight_trend'; args: { range: ReedTimeRange } }
  | { name: 'get_exercise_performance_history'; args: { exerciseQuery: string; range: ReedTimeRange } }
  | { name: 'get_training_goals'; args: { status?: 'all' | 'active' | 'completed' | 'missed' | 'archived'; limit?: number } };

export type ReedContextBlock = {
  content: string;
  title: string;
};

export type ReedContextScope = {
  clientNow: number;
  clientTimeZone?: string;
  profileId: Id<'profiles'>;
};

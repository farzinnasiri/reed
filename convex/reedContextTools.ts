import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
import { reedContextToolCallValidator } from './reedContextTypes';
import type { ReedContextBlock, ReedContextToolCall } from './reedContextTypes';
import {
  bodyweightTrendContext,
  exercisePerformanceHistoryContext,
  summarizeTrainingWindowContext,
} from '../domains/trainingKnowledge/reedContextRepository';

export const runContextTools = internalQuery({
  args: {
    calls: v.array(reedContextToolCallValidator),
    clientNow: v.number(),
    clientTimeZone: v.optional(v.string()),
    profileId: v.id('profiles'),
  },
  handler: async (ctx, args): Promise<ReedContextBlock[]> => {
    const blocks: ReedContextBlock[] = [];
    for (const call of args.calls.slice(0, 6) as ReedContextToolCall[]) {
      if (call.name === 'summarize_training_window') {
        blocks.push(await summarizeTrainingWindowContext(ctx, { ...args, range: call.args.range }));
      }
      if (call.name === 'get_bodyweight_trend') {
        blocks.push(await bodyweightTrendContext(ctx, { ...args, range: call.args.range }));
      }
      if (call.name === 'get_exercise_performance_history') {
        blocks.push(await exercisePerformanceHistoryContext(ctx, {
          ...args,
          exerciseQuery: call.args.exerciseQuery,
          range: call.args.range,
        }));
      }
    }
    return blocks;
  },
});

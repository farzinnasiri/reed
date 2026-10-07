import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
import { loadProfileTimeZone } from './profileTimeZone';
import { reedContextToolCallValidator } from './reedContextTypes';
import type { ReedContextBlock, ReedContextToolCall } from './reedContextTypes';
import {
  bodyweightTrendContext,
  exercisePerformanceHistoryContext,
  summarizeTrainingWindowContext,
  trainingGoalsContext,
} from './reedTrainingContext';

export const runContextTools = internalQuery({
  args: {
    calls: v.array(reedContextToolCallValidator),
    clientNow: v.number(),
    clientTimeZone: v.optional(v.string()),
    profileId: v.id('profiles'),
  },
  handler: async (ctx, args): Promise<ReedContextBlock[]> => {
    const scope = { ...args, clientTimeZone: await loadProfileTimeZone(ctx, args.profileId) };
    const blocks: ReedContextBlock[] = [];
    for (const call of args.calls.slice(0, 6) as ReedContextToolCall[]) {
      if (call.name === 'summarize_training_window') {
        blocks.push(await summarizeTrainingWindowContext(ctx, { ...scope, range: call.args.range }));
      }
      if (call.name === 'get_bodyweight_trend') {
        blocks.push(await bodyweightTrendContext(ctx, { ...scope, range: call.args.range }));
      }
      if (call.name === 'get_exercise_performance_history') {
        blocks.push(await exercisePerformanceHistoryContext(ctx, {
          ...scope,
          exerciseQuery: call.args.exerciseQuery,
          range: call.args.range,
        }));
      }
      if (call.name === 'get_training_goals') {
        blocks.push(await trainingGoalsContext(ctx, { limit: call.args.limit, profileId: args.profileId, status: call.args.status }));
      }
    }
    return blocks;
  },
});

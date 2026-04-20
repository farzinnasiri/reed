import { v } from 'convex/values';

export const recipeKeyValidator = v.union(
  v.literal('standard_load'),
  v.literal('bodyweight_reps'),
  v.literal('assist_bodyweight'),
  v.literal('added_bodyweight'),
  v.literal('hold'),
  v.literal('weighted_hold'),
);

export const recipeKeyOrNullValidator = v.union(recipeKeyValidator, v.null());

/**
 * Stores a set's raw metric values as a string→number map.
 * Field-level validation (which keys are valid, min/max clamping) is
 * intentionally delegated to `validateRecipeMetrics` in the mutations
 * rather than being encoded at the schema level, because the valid keys
 * depend on the recipe key and Convex validators cannot express that
 * dependent constraint.
 */
export const setMetricsValidator = v.record(v.string(), v.number());

export const restProcessValidator = v.object({
  durationSeconds: v.number(),
  isRunning: v.boolean(),
  kind: v.literal('rest'),
  nextSetNumber: v.number(),
  remainingSeconds: v.number(),
  sessionExerciseId: v.id('liveSessionExercises'),
  startedAt: v.union(v.number(), v.null()),
});

export const activeProcessValidator = v.union(v.null(), restProcessValidator);

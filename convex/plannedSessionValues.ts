import { v } from 'convex/values';
import { setMetricsValidator } from './workout/validators';

export const targetSetValidator = v.object({
  metrics: setMetricsValidator,
  restSeconds: v.number(),
});
export const plannedExerciseValidator = v.object({
  exerciseCatalogId: v.id('exerciseCatalog'),
  targets: v.array(targetSetValidator),
});
export const plannedStatusValidator = v.union(
  v.literal('ready'),
  v.literal('started'),
  v.literal('dismissed'),
);

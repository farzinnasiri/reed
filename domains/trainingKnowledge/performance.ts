import {
  getComparisonScalarForRecipe,
  roundMetric,
  summarizeMetrics,
  type RecipeKey,
} from '../workout/recipes';

export type PerformanceLogInput = {
  derivedEffectiveLoadKg?: number | null;
  loggedAt: number;
  metrics: Record<string, number>;
  recipeKey: RecipeKey;
  setLogId: string;
};

export function buildExercisePerformanceSnapshot(args: {
  at: number;
  exerciseCatalogId: string;
  exerciseName: string;
  logs: PerformanceLogInput[];
}) {
  const eligibleLogs = args.logs.filter(log => log.loggedAt <= args.at);
  let best:
    | (PerformanceLogInput & {
        scalar: number;
        summary: string;
      })
    | null = null;

  for (const log of eligibleLogs) {
    const scalar = getComparisonScalarForRecipe(log.recipeKey, log.metrics, log.derivedEffectiveLoadKg ?? null);
    if (scalar <= 0) {
      continue;
    }
    if (!best || scalar > best.scalar || (scalar === best.scalar && log.loggedAt > best.loggedAt)) {
      best = {
        ...log,
        scalar,
        summary: summarizeMetrics(log.recipeKey, log.metrics),
      };
    }
  }

  return {
    at: args.at,
    best: best
      ? {
          loggedAt: best.loggedAt,
          metrics: best.metrics,
          scalar: roundMetric(best.scalar),
          setLogId: best.setLogId,
          summary: best.summary,
        }
      : null,
    exerciseCatalogId: args.exerciseCatalogId,
    exerciseName: args.exerciseName,
    observedSetCount: eligibleLogs.length,
  };
}

export function compareExercisePerformance(args: {
  exerciseCatalogId: string;
  exerciseName: string;
  fromAt: number;
  logs: PerformanceLogInput[];
  toAt: number;
}) {
  const from = buildExercisePerformanceSnapshot({
    at: args.fromAt,
    exerciseCatalogId: args.exerciseCatalogId,
    exerciseName: args.exerciseName,
    logs: args.logs,
  });
  const to = buildExercisePerformanceSnapshot({
    at: args.toAt,
    exerciseCatalogId: args.exerciseCatalogId,
    exerciseName: args.exerciseName,
    logs: args.logs,
  });

  return {
    deltaScalar: from.best && to.best ? roundMetric(to.best.scalar - from.best.scalar) : null,
    exerciseCatalogId: args.exerciseCatalogId,
    exerciseName: args.exerciseName,
    from,
    to,
  };
}

import { summarizeMetrics, type RecipeKey } from '../workout/recipes';
import {
  buildWeeklyMuscleStats,
  type WeeklyStatsExerciseInput,
  type WeeklyStatsLogInput,
} from '../workout/weekly-muscle-stats';

export type TrainingWindowExerciseInput = WeeklyStatsExerciseInput & {
  exerciseName: string;
};

export type TrainingWindowLogInput = WeeklyStatsLogInput & {
  loggedAt: number;
  recipeKey: RecipeKey;
  source: 'live_session' | 'quick_log';
};

export function summarizeTrainingWindow(args: {
  exercises: TrainingWindowExerciseInput[];
  logs: TrainingWindowLogInput[];
  now: number;
  windowEndAt: number;
  windowStartAt: number;
}) {
  const exerciseById = new Map(args.exercises.map(exercise => [exercise.exerciseCatalogId, exercise]));
  const weeklyStats = buildWeeklyMuscleStats({
    exercises: args.exercises,
    logs: args.logs,
    weekEndAt: args.windowEndAt,
    weekStartAt: args.windowStartAt,
  });
  const totalsByExercise = new Map<
    string,
    {
      exerciseCatalogId: string;
      exerciseName: string;
      lastLoggedAt: number;
      setCount: number;
    }
  >();

  for (const log of args.logs) {
    const exercise = exerciseById.get(log.exerciseCatalogId);
    const exerciseName = exercise?.exerciseName ?? 'Unknown exercise';
    const existing = totalsByExercise.get(log.exerciseCatalogId);

    if (existing) {
      existing.lastLoggedAt = Math.max(existing.lastLoggedAt, log.loggedAt);
      existing.setCount += 1;
      continue;
    }

    totalsByExercise.set(log.exerciseCatalogId, {
      exerciseCatalogId: log.exerciseCatalogId,
      exerciseName,
      lastLoggedAt: log.loggedAt,
      setCount: 1,
    });
  }

  const recentActivities = [...args.logs]
    .sort((left, right) => right.loggedAt - left.loggedAt)
    .slice(0, 20)
    .map(log => {
      const exercise = exerciseById.get(log.exerciseCatalogId);
      return {
        exerciseCatalogId: log.exerciseCatalogId,
        exerciseName: exercise?.exerciseName ?? 'Unknown exercise',
        loggedAt: log.loggedAt,
        source: log.source,
        summary: summarizeMetrics(log.recipeKey, log.metrics),
      };
    });

  return {
    activityCount: args.logs.length,
    byExercise: Array.from(totalsByExercise.values()).sort(
      (left, right) => right.setCount - left.setCount || left.exerciseName.localeCompare(right.exerciseName),
    ),
    generatedAt: args.now,
    recentActivities,
    window: {
      endAt: args.windowEndAt,
      startAt: args.windowStartAt,
    },
    work: weeklyStats,
  };
}

import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';
import { buildBodyweightTrend } from '../domains/trainingKnowledge/bodyStatus';
import { calculatePersonalRecords, calculateRecordHighlights } from '../domains/trainingKnowledge/personalRecords';
import { compareExercisePerformance } from '../domains/trainingKnowledge/performance';
import { summarizeTrainingWindow } from '../domains/trainingKnowledge/trainingHistory';
import type { RecipeKey } from '../domains/workout/recipes';

const MAX_TRAINING_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;
const MAX_BODY_STATUS_WINDOW_MS = 3 * 366 * 24 * 60 * 60 * 1000;
const MAX_PERFORMANCE_LOOKBACK_MS = 5 * 366 * 24 * 60 * 60 * 1000;
const RECORD_LOOKBACK_MS = 5 * 366 * 24 * 60 * 60 * 1000;

export const summarizeWindow = query({
  args: {
    windowEndAt: v.number(),
    windowStartAt: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    validateWindow(args.windowStartAt, args.windowEndAt, MAX_TRAINING_WINDOW_MS);

    const logs = await ctx.db
      .query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q =>
        q.eq('profileId', profile._id).gte('loggedAt', args.windowStartAt).lt('loggedAt', args.windowEndAt),
      )
      .collect();
    const exercises = await loadDocsById(ctx, uniqueIds(logs.map(log => log.exerciseCatalogId)));

    return summarizeTrainingWindow({
      exercises: Array.from(exercises.entries()).flatMap(([exerciseCatalogId, exercise]) => {
        if (!exercise) {
          return [];
        }

        return [
          {
            exerciseCatalogId: exerciseCatalogId as string,
            exerciseName: exercise.name,
            isCardio: exercise.isCardio,
            mainMuscleGroups: exercise.mainMuscleGroups,
          },
        ];
      }),
      logs: logs.map(log => ({
        derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
        exerciseCatalogId: log.exerciseCatalogId as string,
        loggedAt: log.loggedAt,
        metrics: log.metrics,
        recipeKey: log.recipeKey,
        source: log.source,
      })),
      now: Date.now(),
      windowEndAt: args.windowEndAt,
      windowStartAt: args.windowStartAt,
    });
  },
});

export const getBodyweightTrend = query({
  args: {
    windowEndAt: v.number(),
    windowStartAt: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    validateWindow(args.windowStartAt, args.windowEndAt, MAX_BODY_STATUS_WINDOW_MS);

    const points = await ctx.db
      .query('bodyMeasurements')
      .withIndex('by_profile_id_and_metric_key_and_observed_at', q =>
        q
          .eq('profileId', profile._id)
          .eq('metricKey', 'body_weight')
          .gte('observedAt', args.windowStartAt)
          .lt('observedAt', args.windowEndAt),
      )
      .collect();

    return buildBodyweightTrend({
      points: points.map(point => ({
        observedAt: point.observedAt,
        unit: point.unit,
        value: point.value,
      })),
      windowEndAt: args.windowEndAt,
      windowStartAt: args.windowStartAt,
    });
  },
});

export const getRecordHighlights = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const limit = Math.min(Math.max(args.limit ?? 3, 1), 8);
    const now = Date.now();
    const logs = await ctx.db
      .query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q =>
        q.eq('profileId', profile._id).gte('loggedAt', Math.max(0, now - RECORD_LOOKBACK_MS)).lte('loggedAt', now),
      )
      .collect();
    const exercises = await loadDocsById(ctx, uniqueIds(logs.map(log => log.exerciseCatalogId)));
    const records = calculatePersonalRecords({
      activities: logs.flatMap(log => {
        const exercise = exercises.get(log.exerciseCatalogId);
        if (!exercise) return [];
        return [{
          activityLogId: log._id as string,
          derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
          exerciseCatalogId: log.exerciseCatalogId as string,
          exerciseName: exercise.name,
          loggedAt: log.loggedAt,
          metrics: log.metrics,
          profileId: log.profileId as string,
          recipeKey: log.recipeKey as RecipeKey,
          sessionId: log.sessionId ? log.sessionId as string : null,
          warmup: log.warmup,
        }];
      }),
    });

    return {
      highlights: calculateRecordHighlights({ limit, records }),
      totalRecords: records.length,
    };
  },
});

export const compareExercise = query({
  args: {
    exerciseCatalogId: v.id('exerciseCatalog'),
    fromAt: v.number(),
    toAt: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    if (args.fromAt > args.toAt) {
      throw new ConvexError('fromAt must be earlier than or equal to toAt.');
    }
    validateWindow(Math.max(0, args.toAt - MAX_PERFORMANCE_LOOKBACK_MS), args.toAt, MAX_PERFORMANCE_LOOKBACK_MS);

    const exercise = await ctx.db.get(args.exerciseCatalogId);
    if (!exercise) {
      throw new ConvexError('Exercise not found.');
    }

    const lookbackStartAt = Math.max(0, args.toAt - MAX_PERFORMANCE_LOOKBACK_MS);
    const logs = await ctx.db
      .query('activityLogs')
      .withIndex('by_profile_id_and_exercise_catalog_id_and_logged_at', q =>
        q
          .eq('profileId', profile._id)
          .eq('exerciseCatalogId', args.exerciseCatalogId)
          .gte('loggedAt', lookbackStartAt)
          .lte('loggedAt', args.toAt),
      )
      .collect();

    return compareExercisePerformance({
      exerciseCatalogId: exercise._id as string,
      exerciseName: exercise.name,
      fromAt: args.fromAt,
      logs: logs.map(log => ({
        derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
        loggedAt: log.loggedAt,
        metrics: log.metrics,
        recipeKey: log.recipeKey,
        setLogId: log._id as string,
      })),
      toAt: args.toAt,
    });
  },
});

function validateWindow(windowStartAt: number, windowEndAt: number, maxDurationMs: number) {
  if (windowStartAt >= windowEndAt) {
    throw new ConvexError('windowStartAt must be earlier than windowEndAt.');
  }
  if (windowEndAt - windowStartAt > maxDurationMs) {
    throw new ConvexError('Requested window is too large.');
  }
}

async function loadDocsById<TableName extends 'exerciseCatalog'>(
  ctx: QueryCtx,
  ids: Id<TableName>[],
) {
  const rows = await Promise.all(ids.map(id => ctx.db.get(id)));
  return new Map<Id<TableName>, Doc<TableName> | null>(ids.map((id, index) => [id, rows[index]]));
}

function uniqueIds<T>(ids: T[]) {
  return Array.from(new Set(ids));
}

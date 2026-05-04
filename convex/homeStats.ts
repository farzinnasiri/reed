import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';
import { summarizeTrainingWindow } from '../domains/trainingKnowledge/trainingHistory';

export const getWeeklyMuscleStats = query({
  args: {
    weekEndAt: v.number(),
    weekStartAt: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    if (args.weekStartAt >= args.weekEndAt) {
      throw new ConvexError('weekStartAt must be earlier than weekEndAt.');
    }

    const weekStartAt = args.weekStartAt;
    const weekEndAt = args.weekEndAt;

    const weeklyLogs = await ctx.db
      .query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q =>
        q.eq('profileId', profile._id).gte('loggedAt', weekStartAt).lt('loggedAt', weekEndAt),
      )
      .collect();

    const catalogMap = await loadDocsById(
      ctx,
      getUniqueIds(weeklyLogs.map(log => log.exerciseCatalogId)),
    );

    return summarizeTrainingWindow({
      exercises: Array.from(catalogMap.entries()).flatMap(([exerciseCatalogId, exercise]) => {
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
      logs: weeklyLogs.map(log => ({
        derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
        exerciseCatalogId: log.exerciseCatalogId as string,
        loggedAt: log.loggedAt,
        metrics: log.metrics,
        recipeKey: log.recipeKey,
        source: log.source,
      })),
      now: Date.now(),
      windowEndAt: weekEndAt,
      windowStartAt: weekStartAt,
    }).work;
  },
});

async function loadDocsById<TableName extends 'exerciseCatalog'>(
  ctx: QueryCtx,
  ids: Id<TableName>[],
) {
  const rows = await Promise.all(ids.map(id => ctx.db.get(id)));
  return new Map<Id<TableName>, Doc<TableName> | null>(ids.map((id, index) => [id, rows[index]]));
}

function getUniqueIds<T>(ids: T[]) {
  return Array.from(new Set(ids));
}

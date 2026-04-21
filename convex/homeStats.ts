import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';
import {
  getSetRepCount,
  getSetVolume,
  resolveWeeklyMuscleGroups,
  weeklyMuscleGroupLabels,
  type WeeklyMuscleGroupId,
} from '../domains/workout/weekly-muscle-stats';
import { roundMetric } from '../domains/workout/recipes';

type GroupTotals = {
  groupId: WeeklyMuscleGroupId;
  reps: number;
  setCount: number;
  volume: number;
};

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
      .query('liveSetLogs')
      .withIndex('by_profile_id_and_logged_at', q =>
        q.eq('profileId', profile._id).gte('loggedAt', weekStartAt).lt('loggedAt', weekEndAt),
      )
      .collect();

    const sessionExerciseMap = await loadDocsById(
      ctx,
      getUniqueIds(weeklyLogs.map(log => log.sessionExerciseId)),
    );
    const catalogMap = await loadDocsById(
      ctx,
      getUniqueIds(
        Array.from(sessionExerciseMap.values())
          .map(sessionExercise => sessionExercise?.exerciseCatalogId)
          .filter((catalogId): catalogId is Id<'exerciseCatalog'> => catalogId !== undefined),
      ),
    );

    const totalsByGroup = new Map<WeeklyMuscleGroupId, GroupTotals>();
    let totalSets = 0;
    let totalReps = 0;
    let totalVolume = 0;

    for (const log of weeklyLogs) {
      const sessionExercise = sessionExerciseMap.get(log.sessionExerciseId);
      const catalogExercise = sessionExercise ? catalogMap.get(sessionExercise.exerciseCatalogId) : null;
      const targetGroups = resolveWeeklyMuscleGroups({
        isCardio: Boolean(catalogExercise?.isCardio),
        mainMuscleGroups: catalogExercise?.mainMuscleGroups ?? [],
      });

      const setReps = getSetRepCount(log.metrics);
      const setVolume = getSetVolume(log.metrics);
      totalSets += 1;
      totalReps += setReps;
      totalVolume += setVolume;

      for (const groupId of targetGroups) {
        const existing = totalsByGroup.get(groupId);
        if (existing) {
          existing.reps = roundMetric(existing.reps + setReps);
          existing.setCount += 1;
          existing.volume = roundMetric(existing.volume + setVolume);
          continue;
        }

        totalsByGroup.set(groupId, {
          groupId,
          reps: setReps,
          setCount: 1,
          volume: setVolume,
        });
      }
    }

    const groups = Array.from(totalsByGroup.values())
      .sort((left, right) => {
        if (right.setCount !== left.setCount) {
          return right.setCount - left.setCount;
        }
        if (right.reps !== left.reps) {
          return right.reps - left.reps;
        }
        return right.volume - left.volume;
      })
      .map(group => ({
        ...group,
        label: weeklyMuscleGroupLabels[group.groupId],
      }));

    return {
      groups,
      totalReps: roundMetric(totalReps),
      totalSets,
      totalVolume: roundMetric(totalVolume),
      weekEndAt,
      weekStartAt,
    };
  },
});

async function loadDocsById<
  TableName extends 'exerciseCatalog' | 'liveSessionExercises',
>(
  ctx: QueryCtx,
  ids: Id<TableName>[],
) {
  const rows = await Promise.all(ids.map(id => ctx.db.get(id)));
  return new Map<Id<TableName>, Doc<TableName> | null>(ids.map((id, index) => [id, rows[index]]));
}

function getUniqueIds<T>(ids: T[]) {
  return Array.from(new Set(ids));
}

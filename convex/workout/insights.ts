import { v } from 'convex/values';
import { query } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { requireViewerProfile } from '../profiles';
import { buildLiveSessionInsights } from '../../domains/workout/session-insights';

const INSIGHTS_HISTORY_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
const INSIGHTS_HISTORY_MAX_SESSIONS = 120;

export const getCurrent = query({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const session = await ctx.db
      .query('liveSessions')
      .withIndex('by_profile_id_and_status', q => q.eq('profileId', profile._id).eq('status', 'active'))
      .unique();

    if (!session) {
      return null;
    }

    const sessionExercises = await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
      .collect();
    const currentLogs = (
      await Promise.all(
        sessionExercises.map(sessionExercise =>
          ctx.db
            .query('liveSetLogs')
            .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', sessionExercise._id))
            .collect(),
        ),
      )
    ).flat();

    const catalogExercises = await loadDocsById(
      ctx,
      uniqueIds(sessionExercises.map(sessionExercise => sessionExercise.exerciseCatalogId)),
    );

    const historyStartAt = Math.max(0, session.startedAt - INSIGHTS_HISTORY_WINDOW_MS);
    const historicalSessions = await ctx.db
      .query('liveSessions')
      .withIndex('by_profile_id_and_status_and_started_at', q =>
        q
          .eq('profileId', profile._id)
          .eq('status', 'ended')
          .gte('startedAt', historyStartAt)
          .lt('startedAt', session.startedAt),
      )
      .order('desc')
      .take(INSIGHTS_HISTORY_MAX_SESSIONS);
    const historicalLogs = (
      await Promise.all(
        historicalSessions.map(historicalSession =>
          ctx.db
            .query('liveSetLogs')
            .withIndex('by_session_id_and_set_number', q => q.eq('sessionId', historicalSession._id))
            .collect(),
        ),
      )
    ).flat();
    const historicalSessionExercises = await loadDocsById(
      ctx,
      uniqueIds(historicalLogs.map(log => log.sessionExerciseId)),
    );

    return buildLiveSessionInsights({
      historicalEntries: historicalLogs.flatMap(log => {
        const sessionExercise = historicalSessionExercises.get(log.sessionExerciseId);
        if (!sessionExercise) {
          return [];
        }

        return [
          {
            derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
            exerciseCatalogId: sessionExercise.exerciseCatalogId as string,
            metrics: log.metrics,
            recipeKey: log.recipeKey,
          },
        ];
      }),
      logs: currentLogs.map(log => ({
        derivedBodyweightKg: log.derivedBodyweightKg ?? null,
        derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
        loggedAt: log.loggedAt,
        metrics: log.metrics,
        recipeKey: log.recipeKey,
        restSeconds: log.restSeconds ?? null,
        sessionExerciseId: log.sessionExerciseId as string,
        setLogId: log._id as string,
        setNumber: log.setNumber,
      })),
      now: Date.now(),
      sessionExercises: sessionExercises.flatMap(sessionExercise => {
        const catalogExercise = catalogExercises.get(sessionExercise.exerciseCatalogId);
        if (!catalogExercise || !sessionExercise.recipeKey) {
          return [];
        }

        return [
          {
            exerciseCatalogId: sessionExercise.exerciseCatalogId as string,
            exerciseClass: catalogExercise.exerciseClass,
            exerciseName: sessionExercise.exerciseName,
            isCardio: catalogExercise.isCardio,
            isHold: catalogExercise.isHold,
            mainMuscleGroups: catalogExercise.mainMuscleGroups,
            movementPatterns: catalogExercise.movementPatterns,
            recipeKey: sessionExercise.recipeKey,
            sessionExerciseId: sessionExercise._id as string,
          },
        ];
      }),
      sessionStartedAt: session.startedAt,
    });
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

function uniqueIds<T>(ids: T[]) {
  return Array.from(new Set(ids));
}

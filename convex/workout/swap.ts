import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { patchSessionStructure } from './structure';
import type { supportedPlanningExercise } from '../plannedSessions';

export async function swapSafetyReason(
  ctx: QueryCtx | MutationCtx,
  session: Doc<'liveSessions'>,
  exercise: Doc<'liveSessionExercises'>,
) {
  if (exercise.sessionId !== session._id || exercise.profileId !== session.profileId)
    return 'exercise_missing';
  const first = await ctx.db
    .query('activityLogs')
    .withIndex('by_session_exercise_id_and_set_number', (q) =>
      q.eq('sessionExerciseId', exercise._id),
    )
    .first();
  if (first) return 'exercise_has_logged_sets';
  if (session.activeProcess?.sessionExerciseId === exercise._id) return 'exercise_has_active_timer';
  return null;
}
export async function applyUnloggedSwap(
  ctx: MutationCtx,
  session: Doc<'liveSessions'>,
  exercise: Doc<'liveSessionExercises'>,
  replacement: Awaited<ReturnType<typeof supportedPlanningExercise>>,
  targets: NonNullable<Doc<'liveSessionExercises'>['targetDefaults']>,
) {
  const reason = await swapSafetyReason(ctx, session, exercise);
  if (reason) throw new ConvexError('The exercise cannot be swapped safely.');
  const before = {
    sessionExerciseId: exercise._id,
    exerciseCatalogId: exercise.exerciseCatalogId,
    exerciseName: exercise.exerciseName,
    position: exercise.position,
    targets: exercise.targetDefaults ?? [],
  };
  await ctx.db.patch(exercise._id, {
    exerciseCatalogId: replacement.exercise._id,
    exerciseName: replacement.exercise.name,
    exerciseClass: replacement.exercise.exerciseClass,
    recipeKey: replacement.recipeKey,
    modifierCapabilities: replacement.exercise.modifierCapabilities,
    defaultSummaryFormat: replacement.exercise.defaultSummaryFormat,
    setupModifiers: undefined,
    targetDefaults: targets,
  });
  await patchSessionStructure(ctx, session, {});
  return {
    before,
    after: {
      ...before,
      exerciseCatalogId: replacement.exercise._id,
      exerciseName: replacement.exercise.name,
      targets,
    },
  };
}

import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { isBodyweightLoadRecipeKey } from '../../domains/workout/bodyweight-load-factors';
import { roundMetric, summarizeMetrics, validateRecipeMetrics } from '../../domains/workout/recipes';

type SessionExerciseWithRecipe = Doc<'liveSessionExercises'> & {
  recipeKey: NonNullable<Doc<'liveSessionExercises'>['recipeKey']>;
};

type DerivedLoadFields = {
  derivedBodyweightKg?: number;
  derivedEffectiveLoadKg?: number;
};

export function normalizeSetMetrics(
  recipeKey: SessionExerciseWithRecipe['recipeKey'],
  metrics: Record<string, number>,
) {
  return validateRecipeMetrics(recipeKey, metrics);
}

export function summarizeSetMetrics(
  recipeKey: SessionExerciseWithRecipe['recipeKey'],
  metrics: Record<string, number>,
) {
  return summarizeMetrics(recipeKey, metrics);
}

export async function insertLiveSessionSetActivity(
  ctx: MutationCtx,
  args: {
    loggedAt: number;
    metrics: Record<string, number>;
    profileId: Id<'profiles'>;
    restSeconds?: number;
    sessionExercise: SessionExerciseWithRecipe;
    sessionId: Id<'liveSessions'>;
    setNumber: number;
    warmup: boolean;
  },
) {
  const derivedLoadFields = await resolveLiveSessionSetDerivedLoadFields(ctx, {
    loggedAt: args.loggedAt,
    metrics: args.metrics,
    profileId: args.profileId,
    sessionExercise: args.sessionExercise,
  });

  return await ctx.db.insert('activityLogs', {
    ...derivedLoadFields,
    exerciseCatalogId: args.sessionExercise.exerciseCatalogId,
    loggedAt: args.loggedAt,
    metrics: args.metrics,
    profileId: args.profileId,
    recipeKey: args.sessionExercise.recipeKey,
    restSeconds: args.restSeconds,
    sessionExerciseId: args.sessionExercise._id,
    sessionId: args.sessionId,
    setNumber: args.setNumber,
    source: 'live_session',
    warmup: args.warmup,
  });
}

export async function patchLiveSessionSetActivity(
  ctx: MutationCtx,
  args: {
    loggedAt: number;
    metrics: Record<string, number>;
    profileId: Id<'profiles'>;
    sessionExercise: SessionExerciseWithRecipe;
    setLogId: Id<'activityLogs'>;
    warmup: boolean;
  },
) {
  const derivedLoadFields = await resolveLiveSessionSetDerivedLoadFields(ctx, {
    loggedAt: args.loggedAt,
    metrics: args.metrics,
    profileId: args.profileId,
    sessionExercise: args.sessionExercise,
  });

  await ctx.db.patch(args.setLogId, {
    ...derivedLoadFields,
    loggedAt: args.loggedAt,
    metrics: args.metrics,
    warmup: args.warmup,
  });
}

export async function deleteLiveSessionSetActivity(
  ctx: MutationCtx,
  setLog: Doc<'activityLogs'> & { sessionExerciseId: Id<'liveSessionExercises'> },
) {
  const siblingLogs = await ctx.db
    .query('activityLogs')
    .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', setLog.sessionExerciseId))
    .collect();

  for (const sibling of siblingLogs) {
    if (sibling._id === setLog._id) {
      continue;
    }
    if (sibling.setNumber > setLog.setNumber) {
      await ctx.db.patch(sibling._id, { setNumber: sibling.setNumber - 1 });
    }
  }

  await ctx.db.delete(setLog._id);

  return {
    deletedSetNumber: setLog.setNumber,
    sessionExerciseId: setLog.sessionExerciseId,
  };
}

export async function insertQuickLogActivity(
  ctx: MutationCtx,
  args: {
    loggedAt: number;
    metrics: Record<string, number>;
    preset: Doc<'quickLogPresets'>;
    profileId: Id<'profiles'>;
  },
) {
  const derivedLoadFields = await resolveQuickLogDerivedLoadFields(ctx, args);

  return await ctx.db.insert('activityLogs', {
    ...derivedLoadFields,
    exerciseCatalogId: args.preset.exerciseCatalogId,
    loggedAt: args.loggedAt,
    metrics: args.metrics,
    profileId: args.profileId,
    recipeKey: args.preset.recipeKey,
    setNumber: 1,
    source: 'quick_log',
    warmup: false,
  });
}

async function resolveLiveSessionSetDerivedLoadFields(
  ctx: MutationCtx,
  args: {
    loggedAt: number;
    metrics: Record<string, number>;
    profileId: Id<'profiles'>;
    sessionExercise: SessionExerciseWithRecipe;
  },
): Promise<DerivedLoadFields> {
  const totalReps = roundMetric(
    (args.metrics.reps ?? 0) + (args.metrics.leftReps ?? 0) + (args.metrics.rightReps ?? 0),
  );

  if (totalReps <= 0) {
    return {};
  }

  if (!isBodyweightLoadRecipeKey(args.sessionExercise.recipeKey)) {
    return {};
  }

  const catalogExercise = await ctx.db.get(args.sessionExercise.exerciseCatalogId);
  const bodyweightLoadFactor = catalogExercise?.bodyweightLoadFactor ?? null;

  if (!catalogExercise || bodyweightLoadFactor === null) {
    return {};
  }

  const latestBodyweight = await getLatestBodyweight(ctx, args.profileId, args.loggedAt);

  if (latestBodyweight === null) {
    return {};
  }

  const baseEffectiveLoadKg = latestBodyweight * bodyweightLoadFactor;
  const derivedEffectiveLoadKg =
    args.sessionExercise.recipeKey === 'assist_bodyweight'
      ? Math.max(0, baseEffectiveLoadKg - (args.metrics.assistLoad ?? 0))
      : args.sessionExercise.recipeKey === 'added_bodyweight'
        ? baseEffectiveLoadKg + (args.metrics.addedLoad ?? 0)
        : baseEffectiveLoadKg;

  return {
    derivedBodyweightKg: roundMetric(latestBodyweight),
    derivedEffectiveLoadKg: roundMetric(derivedEffectiveLoadKg),
  };
}

async function resolveQuickLogDerivedLoadFields(
  ctx: MutationCtx,
  args: {
    loggedAt: number;
    metrics: Record<string, number>;
    preset: Doc<'quickLogPresets'>;
    profileId: Id<'profiles'>;
  },
): Promise<DerivedLoadFields> {
  if (args.preset.inputKind !== 'reps' || !args.metrics.reps) {
    return {};
  }

  const exercise = await ctx.db.get(args.preset.exerciseCatalogId);
  const bodyweightLoadFactor = exercise?.bodyweightLoadFactor ?? null;
  if (bodyweightLoadFactor === null) {
    return {};
  }

  const latestBodyweight = await getLatestBodyweight(ctx, args.profileId, args.loggedAt);

  if (latestBodyweight === null) {
    return {};
  }

  return {
    derivedBodyweightKg: roundMetric(latestBodyweight),
    derivedEffectiveLoadKg: roundMetric(latestBodyweight * bodyweightLoadFactor),
  };
}

async function getLatestBodyweight(
  ctx: MutationCtx,
  profileId: Id<'profiles'>,
  observedAt: number,
) {
  const latestBodyweightRows = await ctx.db
    .query('bodyMeasurements')
    .withIndex('by_profile_id_and_metric_key_and_observed_at', q =>
      q.eq('profileId', profileId).eq('metricKey', 'body_weight').lte('observedAt', observedAt),
    )
    .order('desc')
    .take(1);

  return latestBodyweightRows[0]?.value ?? null;
}

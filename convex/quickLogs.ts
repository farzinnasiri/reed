import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';
import { roundMetric } from '../domains/workout/recipes';

type PresetSeed = {
  key: string;
  label: string;
  group: 'strength' | 'cardio' | 'recovery';
  inputKind: 'reps' | 'duration' | 'duration_or_distance';
  sortOrder: number;
  exercise: {
    exerciseId: string;
    name: string;
    canonicalFamily: string;
    recipeKey: Doc<'quickLogPresets'>['recipeKey'];
    rawMetricRecipe: string;
    exerciseClass: string;
    isHold: boolean;
    isCardio: boolean;
    usesBodyweight: boolean;
    bodyweightLoadFactor?: number;
    mainMuscleGroups: string[];
    movementPatterns: string[];
    equipment?: string[];
    contextTags?: string[];
  };
};

const QUICK_LOG_PRESETS: PresetSeed[] = [
  strengthPreset('push_ups', 'Push-ups', 10, 'push-up', 'Push-Up', 'push-up', 0.64, ['pecs', 'triceps', 'front delts'], ['horizontal-push']),
  strengthPreset('pull_ups', 'Pull-ups', 20, 'pull-up', 'Pull-Up', 'pull-up', 0.95, ['lats', 'biceps'], ['vertical-pull'], ['pull-up-bar']),
  strengthPreset('dips', 'Dips', 30, 'dip', 'Dip', 'dip', 0.87, ['lower pecs', 'triceps'], ['vertical-push'], ['dip-bars']),
  strengthPreset('air_squats', 'Air squats', 40, 'air-squat', 'Air Squat', 'squat', 0.7, ['quads', 'glute max'], ['squat']),
  {
    key: 'plank',
    label: 'Plank',
    group: 'strength',
    inputKind: 'duration',
    sortOrder: 50,
    exercise: baseExercise({
      canonicalFamily: 'plank',
      exerciseClass: 'hold',
      exerciseId: 'plank',
      isCardio: false,
      isHold: true,
      mainMuscleGroups: ['core'],
      movementPatterns: ['core-stability'],
      name: 'Plank',
      rawMetricRecipe: 'duration+rpe',
      recipeKey: 'hold',
      usesBodyweight: true,
    }),
  },
  cardioPreset('walk', 'Walk', 100, 'walk', 'Walk', 'walking'),
  cardioPreset('run', 'Run', 110, 'run', 'Run', 'running'),
  cardioPreset('cycle', 'Cycle', 120, 'cycle', 'Cycle', 'cycling'),
  recoveryPreset('mobility', 'Mobility', 200, 'mobility', 'Mobility'),
  recoveryPreset('stretching', 'Stretching', 210, 'stretching', 'Stretching'),
];

export const listPresets = query({
  args: {},
  handler: async ctx => {
    await requireViewerProfile(ctx);
    const presets = await ctx.db
      .query('quickLogPresets')
      .withIndex('by_enabled_and_sort_order', q => q.eq('isEnabled', true))
      .collect();

    return presets.map(preset => ({
      _id: preset._id,
      group: preset.group,
      inputKind: preset.inputKind,
      key: preset.key,
      label: preset.label,
      sortOrder: preset.sortOrder,
    }));
  },
});

export const ensurePresets = mutation({
  args: {},
  handler: async ctx => {
    await requireViewerProfile(ctx);
    let upserted = 0;

    for (const seed of QUICK_LOG_PRESETS) {
      const exerciseCatalogId = await upsertExercise(ctx, seed.exercise);
      const existing = await ctx.db
        .query('quickLogPresets')
        .withIndex('by_key', q => q.eq('key', seed.key))
        .unique();
      const patch = {
        exerciseCatalogId,
        group: seed.group,
        inputKind: seed.inputKind,
        isEnabled: true,
        key: seed.key,
        label: seed.label,
        recipeKey: seed.exercise.recipeKey,
        sortOrder: seed.sortOrder,
      };

      if (existing) {
        await ctx.db.patch(existing._id, patch);
      } else {
        await ctx.db.insert('quickLogPresets', patch);
      }
      upserted += 1;
    }

    return { upserted };
  },
});

export const log = mutation({
  args: {
    distanceKm: v.union(v.number(), v.null()),
    durationSeconds: v.union(v.number(), v.null()),
    presetId: v.id('quickLogPresets'),
    reps: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const preset = await ctx.db.get(args.presetId);

    if (!preset || !preset.isEnabled) {
      throw new ConvexError('Quick log preset is unavailable.');
    }

    const metrics = buildMetrics(preset, args);
    const loggedAt = Date.now();
    const derivedLoadFields = await resolveQuickDerivedLoad(ctx, {
      loggedAt,
      metrics,
      preset,
      profileId: profile._id,
    });

    await ctx.db.insert('activityLogs', {
      ...derivedLoadFields,
      exerciseCatalogId: preset.exerciseCatalogId,
      loggedAt,
      metrics,
      profileId: profile._id,
      recipeKey: preset.recipeKey,
      setNumber: 1,
      source: 'quick_log',
      warmup: false,
    });

    return { logged: true };
  },
});

function buildMetrics(
  preset: Doc<'quickLogPresets'>,
  args: { distanceKm: number | null; durationSeconds: number | null; reps: number | null },
) {
  if (preset.inputKind === 'reps') {
    if (args.reps === null || args.reps < 1 || args.reps > 500) {
      throw new ConvexError('Enter reps between 1 and 500.');
    }
    return { reps: Math.round(args.reps) };
  }

  if (preset.inputKind === 'duration') {
    if (args.durationSeconds === null || args.durationSeconds < 1 || args.durationSeconds > 24 * 60 * 60) {
      throw new ConvexError('Enter a duration.');
    }
    return { duration: Math.round(args.durationSeconds) };
  }

  const duration = args.durationSeconds;
  const distance = args.distanceKm;
  if ((duration === null || duration <= 0) && (distance === null || distance <= 0)) {
    throw new ConvexError('Enter duration or distance.');
  }
  const metrics: Record<string, number> = {};
  if (duration !== null && duration > 0) {
    metrics.duration = Math.round(duration);
  }
  if (distance !== null && distance > 0) {
    metrics.distance = roundMetric(distance);
  }
  return metrics;
}

async function resolveQuickDerivedLoad(
  ctx: MutationCtx,
  args: {
    loggedAt: number;
    metrics: Record<string, number>;
    preset: Doc<'quickLogPresets'>;
    profileId: Id<'profiles'>;
  },
) {
  if (args.preset.inputKind !== 'reps' || !args.metrics.reps) {
    return {};
  }

  const exercise = await ctx.db.get(args.preset.exerciseCatalogId);
  const bodyweightLoadFactor = exercise?.bodyweightLoadFactor ?? null;
  if (bodyweightLoadFactor === null) {
    return {};
  }

  const latestBodyweightRows = await ctx.db
    .query('bodyMeasurements')
    .withIndex('by_profile_id_and_metric_key_and_observed_at', q =>
      q.eq('profileId', args.profileId).eq('metricKey', 'body_weight').lte('observedAt', args.loggedAt),
    )
    .order('desc')
    .take(1);
  const bodyweight = latestBodyweightRows[0]?.value;
  if (bodyweight === undefined) {
    return {};
  }

  return {
    derivedBodyweightKg: roundMetric(bodyweight),
    derivedEffectiveLoadKg: roundMetric(bodyweight * bodyweightLoadFactor),
  };
}

async function upsertExercise(ctx: MutationCtx, exercise: PresetSeed['exercise']) {
  const existing = await ctx.db
    .query('exerciseCatalog')
    .withIndex('by_exercise_id', q => q.eq('exerciseId', exercise.exerciseId))
    .unique();
  const patch = {
    aliases: [exercise.name],
    ...(exercise.bodyweightLoadFactor === undefined ? {} : { bodyweightLoadFactor: exercise.bodyweightLoadFactor }),
    canonicalFamily: exercise.canonicalFamily,
    contextTags: exercise.contextTags ?? ['quick-log'],
    discoveryTags: ['quick-log'],
    equipment: exercise.equipment ?? ['none'],
    exerciseClass: exercise.exerciseClass,
    exerciseId: exercise.exerciseId,
    isCardio: exercise.isCardio,
    isHold: exercise.isHold,
    isSupportedInLiveSession: true,
    jointsEmphasized: [],
    laterality: 'bilateral',
    loadType: exercise.usesBodyweight ? 'bodyweight' : 'none',
    mainMuscleGroups: exercise.mainMuscleGroups,
    movementPatterns: exercise.movementPatterns,
    name: exercise.name,
    notes: 'Quick log preset exercise.',
    primaryModality: exercise.isCardio ? 'cardio' : exercise.isHold ? 'hold' : 'strength',
    rawMetricRecipe: exercise.rawMetricRecipe,
    recipeKey: exercise.recipeKey,
    searchText: `${exercise.name} ${exercise.canonicalFamily} quick log`,
    secondaryMuscleGroups: [],
    skillTags: [],
    supportsLiveTracking: false,
    updatedAt: Date.now(),
    usesBodyweight: exercise.usesBodyweight,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }

  return await ctx.db.insert('exerciseCatalog', patch);
}

function strengthPreset(
  key: string,
  label: string,
  sortOrder: number,
  exerciseId: string,
  name: string,
  canonicalFamily: string,
  bodyweightLoadFactor: number,
  mainMuscleGroups: string[],
  movementPatterns: string[],
  equipment?: string[],
): PresetSeed {
  return {
    key,
    label,
    group: 'strength',
    inputKind: 'reps',
    sortOrder,
    exercise: baseExercise({
      bodyweightLoadFactor,
      canonicalFamily,
      equipment,
      exerciseClass: 'calisthenics',
      exerciseId,
      isCardio: false,
      isHold: false,
      mainMuscleGroups,
      movementPatterns,
      name,
      rawMetricRecipe: 'reps+rpe',
      recipeKey: 'bodyweight_reps',
      usesBodyweight: true,
    }),
  };
}

function cardioPreset(key: string, label: string, sortOrder: number, exerciseId: string, name: string, family: string): PresetSeed {
  return {
    key,
    label,
    group: 'cardio',
    inputKind: 'duration_or_distance',
    sortOrder,
    exercise: baseExercise({
      canonicalFamily: family,
      exerciseClass: 'cardio-live',
      exerciseId,
      isCardio: true,
      isHold: false,
      mainMuscleGroups: ['cardiorespiratory system'],
      movementPatterns: ['locomotion'],
      name,
      rawMetricRecipe: 'duration+distance',
      recipeKey: 'cardio_live_duration_distance',
      usesBodyweight: false,
    }),
  };
}

function recoveryPreset(key: string, label: string, sortOrder: number, exerciseId: string, name: string): PresetSeed {
  return {
    key,
    label,
    group: 'recovery',
    inputKind: 'duration',
    sortOrder,
    exercise: baseExercise({
      canonicalFamily: exerciseId,
      exerciseClass: 'mobility',
      exerciseId,
      isCardio: false,
      isHold: true,
      mainMuscleGroups: ['other'],
      movementPatterns: ['mobility'],
      name,
      rawMetricRecipe: 'duration+rpe',
      recipeKey: 'hold',
      usesBodyweight: false,
    }),
  };
}

function baseExercise(exercise: PresetSeed['exercise']) {
  return exercise;
}

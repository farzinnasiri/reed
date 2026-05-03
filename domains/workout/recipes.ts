export const supportedRecipeKeys = [
  'standard_load',
  'bodyweight_reps',
  'assist_bodyweight',
  'added_bodyweight',
  'hold',
  'weighted_hold',
  'unilateral_load_pair',
  'unilateral_reps_pair',
  'unilateral_duration_rpe_pair',
  'unilateral_duration_distance_load_pair',
  'cardio_manual_duration_rpe',
  'cardio_manual_distance_time_rpe',
  'cardio_live_duration_distance',
  'cardio_live_duration_distance_pace',
  'cardio_live_duration_distance_load',
  'cardio_live_duration_floors',
] as const;

export type RecipeKey = (typeof supportedRecipeKeys)[number];
export type LiveCardioRecipeKey =
  | 'cardio_live_duration_distance'
  | 'cardio_live_duration_distance_pace'
  | 'cardio_live_duration_distance_load'
  | 'cardio_live_duration_floors';

export type RecipeLayoutKind = 'standard' | 'unilateral_pair' | 'cardio_manual' | 'cardio_live';
export type RecipeProcessKind = 'none' | 'rest_after_log' | 'live_cardio';
export type RecipeFieldGroup = 'left' | 'right' | 'shared';
export type ComparisonKind = 'distance' | 'duration' | 'floors' | 'load' | 'reps' | 'volume';

export type RecipeFieldDefinition = {
  adjustInLiveTracking?: boolean;
  defaultValue: number;
  group?: RecipeFieldGroup;
  kind?: 'duration';
  key: string;
  label: string;
  max?: number;
  min?: number;
  pickerMax: number;
  pickerMin: number;
  step: number;
  unit?: string;
};

export function isDurationField(field: RecipeFieldDefinition) {
  return field.kind === 'duration';
}

export type RecipeMappingInput = {
  exerciseClass: string;
  isCardio: boolean;
  isHold: boolean;
  laterality?: string;
  rawMetricRecipe: string;
  supportsLiveTracking: boolean;
};

type RecipeDefinition = {
  fields: readonly RecipeFieldDefinition[];
  formatSummary: (metrics: Record<string, number>) => string;
  label: string;
  layoutKind: RecipeLayoutKind;
  processKind: RecipeProcessKind;
};

const recipeRegistry: Record<RecipeKey, RecipeDefinition> = {
  standard_load: {
    fields: [
      { defaultValue: 0, key: 'load', label: 'Load', min: 0, pickerMax: 200, pickerMin: 0, step: 2.5, unit: 'kg' },
      { defaultValue: 8, key: 'reps', label: 'Reps', max: 50, min: 0, pickerMax: 50, pickerMin: 0, step: 1 },
      { defaultValue: 8, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics => `${formatLoad(metrics.load)} × ${formatCount(metrics.reps, 'rep')} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Load + reps',
    layoutKind: 'standard',
    processKind: 'rest_after_log',
  },
  bodyweight_reps: {
    fields: [
      { defaultValue: 8, key: 'reps', label: 'Reps', max: 50, min: 0, pickerMax: 50, pickerMin: 0, step: 1 },
      { defaultValue: 8, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics => `${formatCount(metrics.reps, 'rep')} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Bodyweight reps',
    layoutKind: 'standard',
    processKind: 'rest_after_log',
  },
  assist_bodyweight: {
    fields: [
      { defaultValue: 0, key: 'assistLoad', label: 'Assist', min: 0, pickerMax: 200, pickerMin: 0, step: 2.5, unit: 'kg' },
      { defaultValue: 8, key: 'reps', label: 'Reps', max: 50, min: 0, pickerMax: 50, pickerMin: 0, step: 1 },
      { defaultValue: 8, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics =>
      `${formatLoad(metrics.assistLoad)} assist × ${formatCount(metrics.reps, 'rep')} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Assisted bodyweight',
    layoutKind: 'standard',
    processKind: 'rest_after_log',
  },
  added_bodyweight: {
    fields: [
      { defaultValue: 0, key: 'addedLoad', label: 'Added load', min: 0, pickerMax: 150, pickerMin: 0, step: 2.5, unit: 'kg' },
      { defaultValue: 8, key: 'reps', label: 'Reps', max: 50, min: 0, pickerMax: 50, pickerMin: 0, step: 1 },
      { defaultValue: 8, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics =>
      `${formatCount(metrics.reps, 'rep')} + ${formatLoad(metrics.addedLoad)} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Weighted bodyweight',
    layoutKind: 'standard',
    processKind: 'rest_after_log',
  },
  hold: {
    fields: [
      { defaultValue: 30, key: 'duration', kind: 'duration', label: 'Duration', max: 1800, min: 0, pickerMax: 1800, pickerMin: 0, step: 5, unit: 's' },
      { defaultValue: 8, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics => `${formatDuration(metrics.duration)} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Hold',
    layoutKind: 'standard',
    processKind: 'rest_after_log',
  },
  weighted_hold: {
    fields: [
      { defaultValue: 30, key: 'duration', kind: 'duration', label: 'Duration', max: 1800, min: 0, pickerMax: 1800, pickerMin: 0, step: 5, unit: 's' },
      { defaultValue: 0, key: 'load', label: 'Load', min: 0, pickerMax: 200, pickerMin: 0, step: 2.5, unit: 'kg' },
      { defaultValue: 8, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics =>
      `${formatDuration(metrics.duration)} + ${formatLoad(metrics.load)} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Weighted hold',
    layoutKind: 'standard',
    processKind: 'rest_after_log',
  },
  unilateral_load_pair: {
    fields: [
      {
        defaultValue: 0,
        group: 'left',
        key: 'leftLoad',
        label: 'Left load',
        min: 0,
        pickerMax: 200,
        pickerMin: 0,
        step: 2.5,
        unit: 'kg',
      },
      {
        defaultValue: 0,
        group: 'right',
        key: 'rightLoad',
        label: 'Right load',
        min: 0,
        pickerMax: 200,
        pickerMin: 0,
        step: 2.5,
        unit: 'kg',
      },
      { defaultValue: 8, group: 'shared', key: 'reps', label: 'Reps', max: 50, min: 0, pickerMax: 50, pickerMin: 0, step: 1 },
      { defaultValue: 8, group: 'shared', key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics =>
      `L ${formatNumber(metrics.leftLoad)} / R ${formatNumber(metrics.rightLoad)} kg × ${formatCount(metrics.reps, 'rep')} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Unilateral load pair',
    layoutKind: 'unilateral_pair',
    processKind: 'rest_after_log',
  },
  unilateral_reps_pair: {
    fields: [
      { defaultValue: 8, group: 'left', key: 'leftReps', label: 'Left reps', max: 50, min: 0, pickerMax: 50, pickerMin: 0, step: 1 },
      { defaultValue: 8, group: 'right', key: 'rightReps', label: 'Right reps', max: 50, min: 0, pickerMax: 50, pickerMin: 0, step: 1 },
      { defaultValue: 8, group: 'shared', key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics =>
      `L ${formatCount(metrics.leftReps, 'rep')} / R ${formatCount(metrics.rightReps, 'rep')} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Unilateral reps pair',
    layoutKind: 'unilateral_pair',
    processKind: 'rest_after_log',
  },
  unilateral_duration_rpe_pair: {
    fields: [
      {
        defaultValue: 30,
        group: 'left',
        key: 'leftDuration',
        kind: 'duration',
        label: 'Duration',
        max: 1800,
        min: 0,
        pickerMax: 1800,
        pickerMin: 0,
        step: 5,
        unit: 's',
      },
      {
        defaultValue: 30,
        group: 'right',
        key: 'rightDuration',
        kind: 'duration',
        label: 'Duration',
        max: 1800,
        min: 0,
        pickerMax: 1800,
        pickerMin: 0,
        step: 5,
        unit: 's',
      },
      { defaultValue: 8, group: 'shared', key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics =>
      `L ${formatDuration(metrics.leftDuration)} / R ${formatDuration(metrics.rightDuration)} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Unilateral duration pair',
    layoutKind: 'unilateral_pair',
    processKind: 'rest_after_log',
  },
  unilateral_duration_distance_load_pair: {
    fields: [
      {
        defaultValue: 30,
        group: 'left',
        key: 'leftDuration',
        kind: 'duration',
        label: 'Duration',
        max: 1800,
        min: 0,
        pickerMax: 1800,
        pickerMin: 0,
        step: 5,
        unit: 's',
      },
      {
        defaultValue: 30,
        group: 'right',
        key: 'rightDuration',
        kind: 'duration',
        label: 'Duration',
        max: 1800,
        min: 0,
        pickerMax: 1800,
        pickerMin: 0,
        step: 5,
        unit: 's',
      },
      {
        defaultValue: 0,
        group: 'shared',
        key: 'distance',
        label: 'Distance',
        min: 0,
        max: 1000,
        pickerMin: 0,
        pickerMax: 1000,
        step: 0.1,
        unit: 'km',
      },
      {
        defaultValue: 0,
        group: 'shared',
        key: 'load',
        label: 'Load',
        min: 0,
        max: 300,
        pickerMin: 0,
        pickerMax: 300,
        step: 2.5,
        unit: 'kg',
      },
    ],
    formatSummary: metrics =>
      `L ${formatDuration(metrics.leftDuration)} / R ${formatDuration(metrics.rightDuration)} · ${formatDistance(metrics.distance)} · ${formatLoad(metrics.load)}`,
    label: 'Unilateral carry pair',
    layoutKind: 'unilateral_pair',
    processKind: 'rest_after_log',
  },
  cardio_manual_duration_rpe: {
    fields: [
      { defaultValue: 600, key: 'duration', kind: 'duration', label: 'Duration', min: 0, max: 10800, pickerMin: 0, pickerMax: 10800, step: 5, unit: 's' },
      { defaultValue: 7, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics => `${formatDuration(metrics.duration)} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Cardio manual (duration)',
    layoutKind: 'cardio_manual',
    processKind: 'none',
  },
  cardio_manual_distance_time_rpe: {
    fields: [
      { defaultValue: 1, key: 'distance', label: 'Distance', min: 0, max: 1000, pickerMin: 0, pickerMax: 1000, step: 0.1, unit: 'km' },
      { defaultValue: 600, key: 'time', kind: 'duration', label: 'Time', min: 0, max: 10800, pickerMin: 0, pickerMax: 10800, step: 5, unit: 's' },
      { defaultValue: 7, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics =>
      `${formatDistance(metrics.distance)} in ${formatDuration(metrics.time)} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Cardio manual (distance/time)',
    layoutKind: 'cardio_manual',
    processKind: 'none',
  },
  cardio_live_duration_distance: {
    fields: [
      { defaultValue: 0, key: 'duration', kind: 'duration', label: 'Duration', min: 0, max: 10800, pickerMin: 0, pickerMax: 10800, step: 1, unit: 's' },
      {
        adjustInLiveTracking: true,
        defaultValue: 0,
        key: 'distance',
        label: 'Distance',
        min: 0,
        max: 1000,
        pickerMin: 0,
        pickerMax: 1000,
        step: 0.1,
        unit: 'km',
      },
    ],
    formatSummary: metrics => `${formatDistance(metrics.distance)} in ${formatDuration(metrics.duration)}`,
    label: 'Cardio live (distance)',
    layoutKind: 'cardio_live',
    processKind: 'live_cardio',
  },
  cardio_live_duration_distance_pace: {
    fields: [
      { defaultValue: 0, key: 'duration', kind: 'duration', label: 'Duration', min: 0, max: 10800, pickerMin: 0, pickerMax: 10800, step: 1, unit: 's' },
      {
        adjustInLiveTracking: true,
        defaultValue: 0,
        key: 'distance',
        label: 'Distance',
        min: 0,
        max: 1000,
        pickerMin: 0,
        pickerMax: 1000,
        step: 0.1,
        unit: 'km',
      },
      {
        adjustInLiveTracking: true,
        defaultValue: 0,
        key: 'pace',
        label: 'Pace',
        min: 0,
        max: 30,
        pickerMin: 0,
        pickerMax: 30,
        step: 0.1,
        unit: 'km/h',
      },
    ],
    formatSummary: metrics =>
      `${formatDistance(metrics.distance)} in ${formatDuration(metrics.duration)} · ${formatNumber(metrics.pace)} km/h`,
    label: 'Cardio live (distance + pace)',
    layoutKind: 'cardio_live',
    processKind: 'live_cardio',
  },
  cardio_live_duration_distance_load: {
    fields: [
      { defaultValue: 0, key: 'duration', kind: 'duration', label: 'Duration', min: 0, max: 10800, pickerMin: 0, pickerMax: 10800, step: 1, unit: 's' },
      {
        adjustInLiveTracking: true,
        defaultValue: 0,
        key: 'distance',
        label: 'Distance',
        min: 0,
        max: 1000,
        pickerMin: 0,
        pickerMax: 1000,
        step: 0.1,
        unit: 'km',
      },
      {
        adjustInLiveTracking: true,
        defaultValue: 0,
        key: 'load',
        label: 'Load',
        min: 0,
        max: 300,
        pickerMin: 0,
        pickerMax: 300,
        step: 1,
        unit: 'kg',
      },
    ],
    formatSummary: metrics =>
      `${formatDistance(metrics.distance)} in ${formatDuration(metrics.duration)} · ${formatLoad(metrics.load)}`,
    label: 'Cardio live (distance + load)',
    layoutKind: 'cardio_live',
    processKind: 'live_cardio',
  },
  cardio_live_duration_floors: {
    fields: [
      { defaultValue: 0, key: 'duration', kind: 'duration', label: 'Duration', min: 0, max: 10800, pickerMin: 0, pickerMax: 10800, step: 1, unit: 's' },
      {
        adjustInLiveTracking: true,
        defaultValue: 0,
        key: 'floors',
        label: 'Floors',
        min: 0,
        max: 300,
        pickerMin: 0,
        pickerMax: 300,
        step: 1,
        unit: 'floors',
      },
    ],
    formatSummary: metrics => `${formatNumber(metrics.floors)} floors in ${formatDuration(metrics.duration)}`,
    label: 'Cardio live (floors)',
    layoutKind: 'cardio_live',
    processKind: 'live_cardio',
  },
};

const recipeComparisonKinds: Record<RecipeKey, ComparisonKind> = {
  added_bodyweight: 'volume',
  assist_bodyweight: 'volume',
  bodyweight_reps: 'reps',
  cardio_live_duration_distance: 'distance',
  cardio_live_duration_distance_load: 'distance',
  cardio_live_duration_distance_pace: 'distance',
  cardio_live_duration_floors: 'floors',
  cardio_manual_distance_time_rpe: 'distance',
  cardio_manual_duration_rpe: 'duration',
  hold: 'duration',
  standard_load: 'volume',
  unilateral_duration_distance_load_pair: 'distance',
  unilateral_duration_rpe_pair: 'duration',
  unilateral_load_pair: 'volume',
  unilateral_reps_pair: 'reps',
  weighted_hold: 'duration',
};

export function getRecipeDefinition(recipeKey: RecipeKey) {
  return recipeRegistry[recipeKey];
}

export function mapCatalogRecipeKey(row: RecipeMappingInput): RecipeKey | null {
  const exerciseClass = normalizeExerciseClass(row.exerciseClass);
  const laterality = normalizeLaterality(row.laterality);
  const cardioLiveTrackable = isCardioLiveTrackable(row, exerciseClass);
  const cardioManual = isCardioManualRow(row, exerciseClass);

  switch (row.rawMetricRecipe) {
    case 'load+reps+rpe':
      return 'standard_load';
    case 'reps+rpe':
      if (laterality === 'unilateral') {
        return 'unilateral_reps_pair';
      }
      return 'bodyweight_reps';
    case 'assist_load+reps+rpe':
      return 'assist_bodyweight';
    case 'added_load+reps+rpe':
      return 'added_bodyweight';
    case 'duration+load+rpe':
      return 'weighted_hold';
    case 'left_load+right_load+reps+rpe':
      return 'unilateral_load_pair';
    case 'left_reps+right_reps+rpe':
      return 'unilateral_reps_pair';
    case 'duration+rpe':
      if (laterality === 'unilateral' && (row.isHold || exerciseClass === 'hold')) {
        return 'unilateral_duration_rpe_pair';
      }
      if (row.isHold || exerciseClass === 'hold') {
        return 'hold';
      }
      if (cardioManual) {
        return 'cardio_manual_duration_rpe';
      }
      if (row.isCardio && !cardioLiveTrackable) {
        return 'cardio_manual_duration_rpe';
      }
      return null;
    case 'distance+time+rpe':
      if (!row.isCardio) {
        return null;
      }
      // Keep the explicit RPE metric for this source recipe. Mapping this to
      // a live-cardio recipe would silently drop RPE from the captured set.
      if (cardioManual || cardioLiveTrackable) {
        return 'cardio_manual_distance_time_rpe';
      }
      return 'cardio_manual_distance_time_rpe';
    case 'duration+distance':
      return cardioLiveTrackable ? 'cardio_live_duration_distance' : null;
    case 'duration+distance+pace':
      return cardioLiveTrackable ? 'cardio_live_duration_distance_pace' : null;
    case 'duration+distance+load':
      if (laterality === 'unilateral' && !row.isCardio) {
        return 'unilateral_duration_distance_load_pair';
      }
      return cardioLiveTrackable ? 'cardio_live_duration_distance_load' : null;
    case 'duration+floors':
      return cardioLiveTrackable ? 'cardio_live_duration_floors' : null;
    default:
      return null;
  }
}

function normalizeExerciseClass(value: string) {
  return value.trim().toLowerCase();
}

function normalizeLaterality(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

function isCardioManualRow(row: RecipeMappingInput, exerciseClass: string) {
  return row.isCardio && exerciseClass === 'cardio-manual';
}

function isCardioLiveTrackable(row: RecipeMappingInput, exerciseClass: string) {
  return row.isCardio && row.supportsLiveTracking && exerciseClass === 'cardio-live';
}

function isLegacyEmptyMetricRecipe(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.length === 0 || normalized === 'legacy-empty';
}

function getVolumeComparisonScalar(
  recipeKey: RecipeKey,
  metrics: Record<string, number>,
  derivedEffectiveLoadKg?: number | null,
) {
  const reps = getSetRepCount(metrics);
  const normalizedDerivedLoad = finiteOrZero(derivedEffectiveLoadKg ?? 0);

  if (reps > 0 && normalizedDerivedLoad > 0) {
    return roundMetric(normalizedDerivedLoad * reps);
  }

  if (recipeKey === 'unilateral_load_pair') {
    return roundMetric((finiteOrZero(metrics.leftLoad) + finiteOrZero(metrics.rightLoad)) * reps);
  }

  if (recipeKey === 'assist_bodyweight') {
    return roundMetric(finiteOrZero(metrics.assistLoad) * reps);
  }

  if (recipeKey === 'added_bodyweight') {
    return roundMetric(finiteOrZero(metrics.addedLoad) * reps);
  }

  return roundMetric(finiteOrZero(metrics.load) * reps);
}

export function getRecipeFieldDefinitions(recipeKey: RecipeKey) {
  return recipeRegistry[recipeKey].fields;
}

export function getRecipeInitialMetrics(recipeKey: RecipeKey, previousMetrics?: Record<string, number> | null) {
  const initialMetrics: Record<string, number> = {};

  for (const field of recipeRegistry[recipeKey].fields) {
    const rawValue = previousMetrics?.[field.key] ?? field.defaultValue;
    initialMetrics[field.key] = normalizeMetricForField(field, rawValue);
  }

  return initialMetrics;
}

export function prepareRecipeCaptureInput(
  recipeKey: RecipeKey,
  previousMetrics?: Record<string, number> | null,
) {
  const definition = getRecipeDefinition(recipeKey);

  return {
    fields: getRecipeFieldDefinitions(recipeKey),
    initialMetrics: getRecipeInitialMetrics(recipeKey, previousMetrics),
    layoutKind: definition.layoutKind,
    previousMetrics: previousMetrics ?? null,
    processKind: definition.processKind,
    recipeKey,
  };
}

export function prepareLiveCardioInput(recipeKey: LiveCardioRecipeKey) {
  const definition = getRecipeDefinition(recipeKey);
  const initialMetrics = getRecipeInitialMetrics(recipeKey);
  const trackedFields = getLiveCardioTrackedFields(recipeKey);

  return {
    initialMetrics,
    layoutKind: definition.layoutKind,
    processKind: definition.processKind,
    recipeKey,
    trackedFields,
    trackedMetrics: Object.fromEntries(
      trackedFields.map(field => [field.key, initialMetrics[field.key] ?? field.defaultValue]),
    ),
  };
}

export function getLiveCardioTrackedFields(recipeKey: RecipeKey) {
  if (recipeRegistry[recipeKey].processKind !== 'live_cardio') {
    return [];
  }

  return recipeRegistry[recipeKey].fields.filter(field => field.adjustInLiveTracking);
}

export function isSupportedRecipeKey(value: string): value is RecipeKey {
  return supportedRecipeKeys.includes(value as RecipeKey);
}

export function resolveCatalogRecipeKey(input: {
  exerciseClass: string;
  isCardio: boolean;
  isHold: boolean;
  laterality?: string;
  rawMetricRecipe: string;
  recipeKey?: string | null;
  supportsLiveTracking: boolean;
}): RecipeKey | null {
  const mapped = mapCatalogRecipeKey({
    exerciseClass: input.exerciseClass,
    isCardio: input.isCardio,
    isHold: input.isHold,
    laterality: input.laterality,
    rawMetricRecipe: input.rawMetricRecipe,
    supportsLiveTracking: input.supportsLiveTracking,
  });

  if (mapped) {
    return mapped;
  }

  if (isLegacyEmptyMetricRecipe(input.rawMetricRecipe) && input.recipeKey && isSupportedRecipeKey(input.recipeKey)) {
    return input.recipeKey;
  }

  return null;
}

export function getComparisonScalarForRecipe(
  recipeKey: RecipeKey,
  metrics: Record<string, number>,
  derivedEffectiveLoadKg?: number | null,
) {
  const comparisonKind = recipeComparisonKinds[recipeKey];

  switch (comparisonKind) {
    case 'volume':
      return getVolumeComparisonScalar(recipeKey, metrics, derivedEffectiveLoadKg);
    case 'reps':
      return getSetRepCount(metrics);
    case 'duration':
      return roundMetric(
        finiteOrZero(metrics.duration) + finiteOrZero(metrics.leftDuration) + finiteOrZero(metrics.rightDuration),
      );
    case 'distance':
      // Hybrid carry recipes intentionally compare PRs by distance for now.
      return roundMetric(finiteOrZero(metrics.distance));
    case 'floors':
      return roundMetric(finiteOrZero(metrics.floors));
    case 'load':
      return roundMetric(finiteOrZero(metrics.load));
    default:
      return 0;
  }
}

export function isLiveCardioRecipeKey(recipeKey: RecipeKey): recipeKey is LiveCardioRecipeKey {
  return recipeRegistry[recipeKey].processKind === 'live_cardio';
}

export const summarizeMetrics = (recipeKey: RecipeKey, metrics: Record<string, number>) =>
  recipeRegistry[recipeKey].formatSummary(metrics);

export function validateRecipeMetrics(recipeKey: RecipeKey, metrics: Record<string, number>) {
  const fields = recipeRegistry[recipeKey].fields;
  const seenKeys = Object.keys(metrics);

  if (seenKeys.length !== fields.length) {
    throw new Error(`Expected ${fields.length} metrics for ${recipeKey}, received ${seenKeys.length}.`);
  }

  const normalized: Record<string, number> = {};

  for (const field of fields) {
    const value = metrics[field.key];

    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
      throw new Error(`${field.label} must be a finite number.`);
    }

    if (field.min !== undefined && value < field.min) {
      throw new Error(`${field.label} must be at least ${field.min}.`);
    }

    if (field.max !== undefined && value > field.max) {
      throw new Error(`${field.label} must be at most ${field.max}.`);
    }

    normalized[field.key] = roundMetric(value);
  }

  for (const key of seenKeys) {
    if (!fields.some(field => field.key === key)) {
      throw new Error(`Unexpected metric key: ${key}.`);
    }
  }

  return normalized;
}

function formatCount(value: number, unit: string) {
  const rounded = roundMetric(value);
  return `${rounded} ${rounded === 1 ? unit : `${unit}s`}`;
}

function formatDistance(value: number) {
  return `${formatNumber(value)} km`;
}

function formatDuration(value: number) {
  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatLoad(value: number) {
  return `${formatNumber(value)} kg`;
}

function formatNumber(value: number) {
  return roundMetric(value).toString();
}

const formatRpe = (value: number) => roundMetric(value).toString();

function finiteOrZero(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function getSetRepCount(metrics: Record<string, number>) {
  const reps = finiteOrZero(metrics.reps) + finiteOrZero(metrics.leftReps) + finiteOrZero(metrics.rightReps);
  return roundMetric(reps);
}

export function roundMetric(value: number) {
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function normalizeMetricForField(field: RecipeFieldDefinition, value: number) {
  const min = field.min ?? field.pickerMin;
  const max = field.max ?? field.pickerMax;
  const clamped = Math.max(min, Math.min(max, value));
  return roundMetric(clamped);
}

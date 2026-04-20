export const supportedRecipeKeys = [
  'standard_load',
  'bodyweight_reps',
  'assist_bodyweight',
  'added_bodyweight',
  'hold',
  'weighted_hold',
] as const;

export type RecipeKey = (typeof supportedRecipeKeys)[number];

export type RecipeFieldDefinition = {
  defaultValue: number;
  key: string;
  label: string;
  max?: number;
  min?: number;
  pickerMax: number;
  pickerMin: number;
  step: number;
  unit?: string;
};

type RecipeDefinition = {
  fields: readonly RecipeFieldDefinition[];
  formatSummary: (metrics: Record<string, number>) => string;
  label: string;
};

const recipeRegistry: Record<RecipeKey, RecipeDefinition> = {
  standard_load: {
    fields: [
      { defaultValue: 0, key: 'load', label: 'Load', min: 0, pickerMax: 200, pickerMin: 0, step: 2.5, unit: 'kg' },
      { defaultValue: 8, key: 'reps', label: 'Reps', max: 30, min: 0, pickerMax: 30, pickerMin: 0, step: 1 },
      { defaultValue: 8, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics => `${formatLoad(metrics.load)} × ${formatCount(metrics.reps, 'rep')} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Load + reps',
  },
  bodyweight_reps: {
    fields: [
      { defaultValue: 8, key: 'reps', label: 'Reps', max: 30, min: 0, pickerMax: 30, pickerMin: 0, step: 1 },
      { defaultValue: 8, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics => `${formatCount(metrics.reps, 'rep')} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Bodyweight reps',
  },
  assist_bodyweight: {
    fields: [
      { defaultValue: 0, key: 'assistLoad', label: 'Assist', min: 0, pickerMax: 200, pickerMin: 0, step: 2.5, unit: 'kg' },
      { defaultValue: 8, key: 'reps', label: 'Reps', max: 30, min: 0, pickerMax: 30, pickerMin: 0, step: 1 },
      { defaultValue: 8, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics =>
      `${formatLoad(metrics.assistLoad)} assist × ${formatCount(metrics.reps, 'rep')} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Assisted bodyweight',
  },
  added_bodyweight: {
    fields: [
      { defaultValue: 0, key: 'addedLoad', label: 'Added load', min: 0, pickerMax: 100, pickerMin: 0, step: 2.5, unit: 'kg' },
      { defaultValue: 8, key: 'reps', label: 'Reps', max: 30, min: 0, pickerMax: 30, pickerMin: 0, step: 1 },
      { defaultValue: 8, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics =>
      `${formatCount(metrics.reps, 'rep')} + ${formatLoad(metrics.addedLoad)} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Weighted bodyweight',
  },
  hold: {
    fields: [
      { defaultValue: 30, key: 'duration', label: 'Duration', max: 300, min: 0, pickerMax: 300, pickerMin: 0, step: 5, unit: 's' },
      { defaultValue: 8, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics => `${formatDuration(metrics.duration)} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Hold',
  },
  weighted_hold: {
    fields: [
      { defaultValue: 30, key: 'duration', label: 'Duration', max: 300, min: 0, pickerMax: 300, pickerMin: 0, step: 5, unit: 's' },
      { defaultValue: 0, key: 'load', label: 'Load', min: 0, pickerMax: 100, pickerMin: 0, step: 2.5, unit: 'kg' },
      { defaultValue: 8, key: 'rpe', label: 'RPE', max: 10, min: 5, pickerMax: 10, pickerMin: 5, step: 0.5 },
    ],
    formatSummary: metrics =>
      `${formatDuration(metrics.duration)} + ${formatLoad(metrics.load)} · RPE ${formatRpe(metrics.rpe)}`,
    label: 'Weighted hold',
  },
};

const csvRecipeMap: Record<string, RecipeKey> = {
  'assist_load+reps+rpe': 'assist_bodyweight',
  'added_load+reps+rpe': 'added_bodyweight',
  'duration+load+rpe': 'weighted_hold',
  'duration+rpe': 'hold',
  'load+reps+rpe': 'standard_load',
  'reps+rpe': 'bodyweight_reps',
};

export function getRecipeDefinition(recipeKey: RecipeKey) {
  return recipeRegistry[recipeKey];
}

export function mapCsvMetricRecipe(rawMetricRecipe: string): RecipeKey | null {
  return csvRecipeMap[rawMetricRecipe] ?? null;
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

export function isSupportedRecipeKey(value: string): value is RecipeKey {
  return supportedRecipeKeys.includes(value as RecipeKey);
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

function formatDuration(value: number) {
  return `${roundMetric(value)}s`;
}

function formatLoad(value: number) {
  return `${roundMetric(value)} kg`;
}

const formatRpe = (value: number) => roundMetric(value).toString();

function roundMetric(value: number) {
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function normalizeMetricForField(field: RecipeFieldDefinition, value: number) {
  const min = field.min ?? field.pickerMin;
  const max = field.max ?? field.pickerMax;
  const clamped = Math.max(min, Math.min(max, value));
  return roundMetric(clamped);
}

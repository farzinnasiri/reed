import { isDurationField, type RecipeFieldDefinition } from './recipes';

export function formatMetricValue(field: RecipeFieldDefinition, value: number) {
  const precision = getMetricPrecision(field);
  const rounded = roundMetricValue(value, precision);

  if (field.key === 'reps') {
    return `${Math.round(rounded)}`;
  }

  if (field.key === 'rpe') {
    return rounded.toFixed(1);
  }

  if (field.key === 'load' || field.key === 'assistLoad' || field.key === 'addedLoad') {
    return formatNumberWithPrecision(rounded, precision);
  }

  if (isDurationField(field)) {
    return formatDurationClock(Math.round(rounded));
  }

  return formatNumberWithPrecision(rounded, precision);
}

export function formatMetricLabel(field: RecipeFieldDefinition) {
  if (field.key === 'load') {
    return 'LOAD (KG)';
  }
  if (field.key === 'assistLoad') {
    return 'ASSIST (KG)';
  }
  if (field.key === 'addedLoad') {
    return 'ADDED LOAD (KG)';
  }
  if (field.key === 'reps') {
    return 'REPS';
  }
  if (field.key === 'rpe') {
    return 'TARGET RPE';
  }
  return field.label.toUpperCase();
}

export function roundMetricValue(value: number, precision = 2) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (precision <= 0) {
    return Math.round(value);
  }
  return Number(value.toFixed(precision));
}

export function normalizeMetricInput(value: number, min: number, max: number, precision = 2) {
  return roundMetricValue(Math.max(min, Math.min(max, value)), precision);
}

export function normalizeMetricValueForField(field: RecipeFieldDefinition, value: number) {
  const min = field.min ?? field.pickerMin;
  const max = field.max ?? field.pickerMax;
  const precision = getMetricPrecision(field);
  return normalizeMetricInput(value, min, max, precision);
}

export function normalizeMinutePart(input: string) {
  return input.replace(/\D+/g, '');
}

export function normalizeSecondPart(input: string) {
  const digitsOnly = input.replace(/\D+/g, '').slice(0, 2);
  if (digitsOnly.length === 0) {
    return '';
  }
  const numericValue = Number.parseInt(digitsOnly, 10);
  if (Number.isNaN(numericValue)) {
    return '';
  }
  return String(Math.max(0, Math.min(59, numericValue))).padStart(digitsOnly.length === 1 ? 1 : 2, '0');
}

function formatDurationClock(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getMetricPrecision(field: RecipeFieldDefinition) {
  if (isDurationField(field)) {
    return 0;
  }
  if (field.key === 'rpe') {
    return 1;
  }
  if (Number.isInteger(field.step)) {
    return 0;
  }
  // Manual logging can include quarter-style values (e.g. 1.25, 70.75).
  return 2;
}

function formatNumberWithPrecision(value: number, precision: number) {
  if (precision <= 0) {
    return `${Math.round(value)}`;
  }
  const fixed = value.toFixed(precision);
  return fixed.replace(/\.?0+$/, '');
}

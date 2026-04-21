import { isDurationField, type RecipeFieldDefinition } from './recipes';

export function formatMetricValue(field: RecipeFieldDefinition, value: number) {
  const rounded = roundMetricValue(value);

  if (field.key === 'reps') {
    return `${Math.round(rounded)}`;
  }

  if (field.key === 'rpe') {
    return rounded.toFixed(1);
  }

  if (field.key === 'load' || field.key === 'assistLoad' || field.key === 'addedLoad') {
    return rounded.toFixed(1);
  }

  if (isDurationField(field)) {
    return formatDurationClock(Math.round(rounded));
  }

  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
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

export function roundMetricValue(value: number) {
  return Number.isInteger(value) ? value : Number(value.toFixed(1));
}

export function normalizeMetricInput(value: number, min: number, max: number) {
  return roundMetricValue(Math.max(min, Math.min(max, value)));
}

export function normalizeMetricValueForField(field: RecipeFieldDefinition, value: number) {
  const min = field.min ?? field.pickerMin;
  const max = field.max ?? field.pickerMax;
  return normalizeMetricInput(value, min, max);
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

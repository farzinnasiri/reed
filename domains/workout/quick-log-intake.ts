import { roundMetric } from './recipes';

export type QuickLogInputKind = 'reps' | 'duration' | 'duration_or_distance';

export type QuickLogInputValues = {
  distanceKm: number | null;
  durationSeconds: number | null;
  reps: number | null;
};

export function getQuickLogInputError(
  inputKind: QuickLogInputKind,
  values: QuickLogInputValues,
) {
  if (inputKind === 'reps') {
    if (values.reps === null || values.reps < 1 || values.reps > 500) {
      return 'Enter reps between 1 and 500.';
    }
    return null;
  }

  if (inputKind === 'duration') {
    if (values.durationSeconds === null || values.durationSeconds < 1 || values.durationSeconds > 24 * 60 * 60) {
      return 'Enter a duration.';
    }
    return null;
  }

  const duration = values.durationSeconds;
  const distance = values.distanceKm;
  if ((duration === null || duration <= 0) && (distance === null || distance <= 0)) {
    return 'Enter duration or distance.';
  }

  return null;
}

export function buildQuickLogMetrics(
  inputKind: QuickLogInputKind,
  values: QuickLogInputValues,
) {
  const error = getQuickLogInputError(inputKind, values);

  if (error) {
    throw new Error(error);
  }

  if (inputKind === 'reps') {
    return { reps: Math.round(values.reps as number) };
  }

  if (inputKind === 'duration') {
    return { duration: Math.round(values.durationSeconds as number) };
  }

  const metrics: Record<string, number> = {};
  if (values.durationSeconds !== null && values.durationSeconds > 0) {
    metrics.duration = Math.round(values.durationSeconds);
  }
  if (values.distanceKm !== null && values.distanceKm > 0) {
    metrics.distance = roundMetric(values.distanceKm);
  }
  return metrics;
}

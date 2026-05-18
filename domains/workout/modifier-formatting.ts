import type { ExerciseSetupModifiers, SetOutcomeDetails } from './modifier-aware-calculations';

export function formatExerciseSetupLabel(_setup: ExerciseSetupModifiers | null | undefined) {
  // Keep this intentionally empty for now. Angle and assistance are set-level
  // facts in Reed's current logging model, so showing them under the exercise
  // title duplicates the timeline set summary and implies they apply globally.
  return '';
}

export function formatSetOutcomeDetails(details: SetOutcomeDetails | null | undefined, metrics: Record<string, number>) {
  const labels: string[] = [];

  if (details?.rangeOfMotion && details.rangeOfMotion !== 'full') {
    labels.push(formatRangeOfMotion(details.rangeOfMotion));
  }

  const failedReps = Math.max(0, Math.round(details?.failedReps ?? 0));
  if (failedReps > 0) {
    const completedReps = (metrics.reps ?? 0) + (metrics.leftReps ?? 0) + (metrics.rightReps ?? 0);
    const firstFailedRep = Math.max(1, Math.round(completedReps + 1));
    labels.push(`failed ${firstFailedRep}${failedReps > 1 ? ` +${failedReps - 1}` : ''}`);
  }

  return labels.join(' · ');
}

function formatRangeOfMotion(rangeOfMotion: NonNullable<SetOutcomeDetails['rangeOfMotion']>) {
  switch (rangeOfMotion) {
    case 'top_partial':
      return 'top partial';
    case 'bottom_partial':
      return 'bottom partial';
    case 'mid_partial':
      return 'mid partial';
    case 'full':
    default:
      return 'full ROM';
  }
}

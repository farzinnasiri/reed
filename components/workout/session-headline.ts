import type { LiveSessionSummary } from './workout-surface.types';
import { formatCompactMinutes, formatCompactNumber } from './workout-surface.utils';

export type SessionHeadline = {
  /** The session's output in the unit that fits it: kg moved, km covered or time held. Null when there is none. */
  output: { label: string; unit: string; value: string } | null;
  prCount: number;
  reps: number;
  sets: number;
};

/** The numbers a session leads with, taken from its insights summary. */
export function sessionHeadline(summary: LiveSessionSummary): SessionHeadline {
  const { output } = summary;
  return {
    sets: output.completedSets,
    reps: summary.distribution.byMuscleGroup.reduce((total, group) => total + group.reps, 0),
    prCount: summary.highlights.prCount,
    output:
      output.totalLoadKg > 0
        ? { value: Math.round(output.totalLoadKg).toLocaleString('en-US'), unit: 'kg', label: 'moved' }
        : output.totalDistanceKm > 0
          ? { value: formatCompactNumber(output.totalDistanceKm, 1), unit: 'km', label: 'covered' }
          : output.totalHoldSeconds > 0
            ? { value: formatCompactMinutes(output.totalHoldSeconds), unit: '', label: 'held' }
            : null,
  };
}

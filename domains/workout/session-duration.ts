export const MAX_WORKOUT_DURATION_SECONDS = 24 * 60 * 60;
export function validateManualWorkoutDuration(value: number | null) {
  if (value === null) return null;
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_WORKOUT_DURATION_SECONDS
  ) {
    throw new Error(
      'Workout duration must be between one second and 24 hours.',
    );
  }
  return value;
}
export function sessionDurationSeconds(
  session: {
    startedAt: number;
    endedAt?: number;
    manualDurationSeconds?: number;
  },
  now: number,
) {
  return (
    session.manualDurationSeconds ??
    Math.max(
      0,
      Math.floor(((session.endedAt ?? now) - session.startedAt) / 1000),
    )
  );
}

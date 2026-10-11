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

// How long after its last set a session is taken to have run: the rest and the walk to the rack.
const SESSION_TAIL_SECONDS = 120;
const LONG_GAP_SECONDS = 45 * 60;
const LONG_GAP_RATIO = 1.5;

/**
 * When a session was left open (or finished late) its clock keeps running long after the last set.
 * Returns the duration the sets themselves point to, in whole minutes, when the recorded one is far
 * longer; otherwise null. A duration the user has set is never second-guessed.
 */
export function suggestSessionDuration(session: {
  startedAt: number;
  endedAt?: number;
  manualDurationSeconds?: number;
  lastSetAt: number | null;
}, now: number) {
  if (session.manualDurationSeconds !== undefined || session.lastSetAt === null) return null;
  const elapsed = sessionDurationSeconds(session, now);
  const active = Math.max(0, Math.floor((session.lastSetAt - session.startedAt) / 1000)) + SESSION_TAIL_SECONDS;
  if (elapsed - active < LONG_GAP_SECONDS || elapsed < active * LONG_GAP_RATIO) return null;
  return Math.max(60, Math.round(active / 60) * 60);
}

export type RestProcessLike = {
  durationSeconds: number;
  isRunning: boolean;
  remainingSeconds: number;
  startedAt: number | null;
};

export function getRestSnapshot(process: RestProcessLike, now = Date.now()) {
  const remainingSeconds = getRemainingSeconds(process, now);

  return {
    durationSeconds: process.durationSeconds,
    isComplete: remainingSeconds === 0,
    isRunning: process.isRunning && remainingSeconds > 0,
    remainingSeconds,
    startedAt: process.startedAt,
  };
}

export function getRemainingSeconds(process: RestProcessLike, now = Date.now()) {
  if (!process.isRunning || process.startedAt === null) {
    return clampSeconds(process.remainingSeconds);
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - process.startedAt) / 1000));
  return clampSeconds(process.remainingSeconds - elapsedSeconds);
}

export function clampSeconds(value: number, min = 0, max = 240) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

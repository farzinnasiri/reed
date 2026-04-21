export type LiveCardioProcessLike = {
  elapsedSeconds: number;
  isRunning: boolean;
  lastResumedAt: number | null;
};

export function getLiveCardioSnapshot(process: LiveCardioProcessLike, now = Date.now()) {
  const elapsedSeconds = getLiveCardioElapsedSeconds(process, now);

  return {
    elapsedSeconds,
    isRunning: process.isRunning,
  };
}

export function getLiveCardioElapsedSeconds(process: LiveCardioProcessLike, now = Date.now()) {
  if (!process.isRunning || process.lastResumedAt === null) {
    return clampLiveCardioSeconds(process.elapsedSeconds);
  }

  const runningDelta = Math.max(0, Math.floor((now - process.lastResumedAt) / 1000));
  return clampLiveCardioSeconds(process.elapsedSeconds + runningDelta);
}

export function clampLiveCardioSeconds(value: number, max = 86_400) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

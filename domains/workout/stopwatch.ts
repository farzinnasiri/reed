export type StopwatchState = {
  accumulatedSeconds: number;
  startedAt: number | null;
};
export function stopwatchSeconds(state: StopwatchState, now: number) {
  return (
    state.accumulatedSeconds +
    (state.startedAt === null
      ? 0
      : Math.max(0, Math.floor((now - state.startedAt) / 1000)))
  );
}

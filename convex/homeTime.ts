export { localDayBounds, localDayNumber, localWeekDayNumbers } from './localCalendar';

export const HOME_CLOCK_MAX_SKEW_MS = 36 * 60 * 60 * 1000;

export function resolveHomeNow(requestedNow: number, serverNow: number) {
  return Number.isFinite(requestedNow) && Math.abs(requestedNow - serverNow) <= HOME_CLOCK_MAX_SKEW_MS
    ? requestedNow : serverNow;
}

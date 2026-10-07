import { localDayBounds, localWeekDayNumbers } from '../time/local-calendar';

export type ProfilePeriod = '30d' | '90d' | 'week';

export function getCurrentWeekBounds(now: number, timeZone: string) {
  const firstDay = localWeekDayNumbers(now, timeZone)[0];
  return {
    startAt: localDayBounds(firstDay, timeZone).startAt,
    endAt: localDayBounds(firstDay + 7, timeZone).startAt,
  };
}

export function getProfilePeriodRange(period: ProfilePeriod, now: number, timeZone: string, currentBucketMs = 0) {
  if (period === 'week') {
    const firstDay = localWeekDayNumbers(now, timeZone)[0];
    const current = getCurrentWeekBounds(now, timeZone);
    return {
      current,
      previous: { startAt: localDayBounds(firstDay - 7, timeZone).startAt, endAt: current.startAt },
    };
  }
  const duration = (period === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000;
  // Include writes in the active bucket while preserving equal comparison durations.
  const endAt = now + currentBucketMs;
  return {
    current: { startAt: endAt - duration, endAt },
    previous: { startAt: endAt - duration * 2, endAt: endAt - duration },
  };
}

import { weekStart } from './history-weeks';

export type HistoryPeriod = 'week' | 'month' | 'all';

/** Calendar bounds are inclusive at the start and exclusive at the next midnight. */
export function historyPeriodRange(period: HistoryPeriod, now: number) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);
  let since: number | undefined;
  if (period === 'week') {
    since = weekStart(now);
    end.setTime(since);
    end.setDate(end.getDate() + 7);
  } else if (period === 'month') {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    since = start.getTime();
  }
  const last = new Date(end);
  last.setDate(last.getDate() - 1);
  const date = new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return {
    since,
    before: end.getTime(),
    label:
      since === undefined
        ? `All recorded dates · through ${date.format(last)}`
        : `${date.format(since)} – ${date.format(last)}`,
  };
}

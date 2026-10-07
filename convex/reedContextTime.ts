import { localDayBounds, localDayNumber, localWeekDayNumbers, normalizeTimeZone } from './localCalendar';
import type { ReedTimeRange } from './reedContextTypes';

export type ResolvedReedTimeRange = {
  endAt: number;
  label: string;
  startAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveReedTimeRange(args: {
  now: number;
  range: ReedTimeRange;
  timeZone?: string;
}): ResolvedReedTimeRange {
  const timeZone = normalizeTimeZone(args.timeZone);
  const today = localDayNumber(args.now, timeZone);
  const weekStart = localWeekDayNumbers(args.now, timeZone)[0];
  const window = (label: string, firstDay: number, afterLastDay: number) => ({
    label,
    startAt: localDayBounds(firstDay, timeZone).startAt,
    endAt: localDayBounds(afterLastDay, timeZone).startAt - 1,
  });

  switch (args.range.preset) {
    case 'today': return window('today', today, today + 1);
    case 'yesterday': return window('yesterday', today - 1, today);
    case 'this_week': return window('this week', weekStart, weekStart + 7);
    case 'last_week': return window('last week', weekStart - 7, weekStart);
    case 'last_n_days': {
      const days = clampInteger(args.range.days, 1, 180);
      return window(`last ${days} days`, today - days + 1, today + 1);
    }
    case 'last_n_weeks': {
      const weeks = clampInteger(args.range.weeks, 1, 26);
      return window(`last ${weeks} weeks`, today - weeks * 7 + 1, today + 1);
    }
  }
}

export function formatReedTimelineTime(args: {
  now: number;
  timestamp: number;
  timeZone?: string;
}) {
  const timeZone = normalizeTimeZone(args.timeZone);
  const eventDay = new Date(localDayNumber(args.timestamp, timeZone) * DAY_MS).toISOString().slice(0, 10);
  const nowDay = new Date(localDayNumber(args.now, timeZone) * DAY_MS).toISOString().slice(0, 10);
  const yesterdayDay = new Date((localDayNumber(args.now, timeZone) - 1) * DAY_MS).toISOString().slice(0, 10);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(args.timestamp));

  if (eventDay === nowDay) return `Today ${time}`;
  if (eventDay === yesterdayDay) return `Yesterday ${time}`;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(args.timestamp));
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export type ReedTimeRange =
  | { preset: 'today' }
  | { preset: 'yesterday' }
  | { preset: 'this_week' }
  | { preset: 'last_week' }
  | { preset: 'last_n_days'; days: number }
  | { preset: 'last_n_weeks'; weeks: number };

export type ResolvedReedTimeRange = {
  endAt: number;
  label: string;
  startAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function resolveReedTimeRange(args: {
  now: number;
  range: ReedTimeRange;
  timeZone?: string;
}): ResolvedReedTimeRange {
  const timeZone = normalizeTimeZone(args.timeZone);
  const todayStart = startOfLocalDay(args.now, timeZone);

  switch (args.range.preset) {
    case 'today':
      return { label: 'today', startAt: todayStart, endAt: todayStart + DAY_MS - 1 };
    case 'yesterday':
      return { label: 'yesterday', startAt: todayStart - DAY_MS, endAt: todayStart - 1 };
    case 'this_week': {
      const weekStart = startOfLocalWeek(args.now, timeZone);
      return { label: 'this week', startAt: weekStart, endAt: weekStart + WEEK_MS - 1 };
    }
    case 'last_week': {
      const weekStart = startOfLocalWeek(args.now, timeZone);
      return { label: 'last week', startAt: weekStart - WEEK_MS, endAt: weekStart - 1 };
    }
    case 'last_n_days': {
      const days = clampInteger(args.range.days, 1, 180);
      return { label: `last ${days} days`, startAt: todayStart - (days - 1) * DAY_MS, endAt: todayStart + DAY_MS - 1 };
    }
    case 'last_n_weeks': {
      const weeks = clampInteger(args.range.weeks, 1, 26);
      return { label: `last ${weeks} weeks`, startAt: todayStart - (weeks * 7 - 1) * DAY_MS, endAt: todayStart + DAY_MS - 1 };
    }
  }
}

export function formatReedTimelineTime(args: {
  now: number;
  timestamp: number;
  timeZone?: string;
}) {
  const timeZone = normalizeTimeZone(args.timeZone);
  const eventDay = localDateKey(args.timestamp, timeZone);
  const nowDay = localDateKey(args.now, timeZone);
  const yesterdayDay = localDateKey(args.now - DAY_MS, timeZone);
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

function startOfLocalWeek(timestamp: number, timeZone: string) {
  const parts = getLocalParts(timestamp, timeZone);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(new Date(timestamp));
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  const mondayOffset = dayIndex === 0 ? 6 : Math.max(0, dayIndex - 1);
  return localTimeToUtcMs({ ...parts, hour: 0, minute: 0, second: 0, millisecond: 0 }, timeZone) - mondayOffset * DAY_MS;
}

function startOfLocalDay(timestamp: number, timeZone: string) {
  const parts = getLocalParts(timestamp, timeZone);
  return localTimeToUtcMs({ ...parts, hour: 0, minute: 0, second: 0, millisecond: 0 }, timeZone);
}

function getLocalParts(timestamp: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    millisecond: 0,
  };
}

function localDateKey(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).format(new Date(timestamp));
}

function localTimeToUtcMs(parts: ReturnType<typeof getLocalParts>, timeZone: string) {
  let guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
  for (let index = 0; index < 2; index += 1) {
    const offset = getTimeZoneOffsetMs(guess, timeZone);
    guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond) - offset;
  }
  return guess;
}

function getTimeZoneOffsetMs(timestamp: number, timeZone: string) {
  const parts = getLocalParts(timestamp, timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
  return localAsUtc - timestamp;
}

function normalizeTimeZone(timeZone?: string) {
  if (!timeZone || timeZone.length > 80) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'UTC';
  }
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

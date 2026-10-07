const DAY_MS = 24 * 60 * 60 * 1000;

export function getLocalParts(timestamp: number, timeZone: string) {
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
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  );
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

function localTimeToUtcMs(parts: ReturnType<typeof getLocalParts>, timeZone: string) {
  let guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
  for (let index = 0; index < 2; index += 1) {
    const offset = getTimeZoneOffsetMs(guess, timeZone);
    guess =
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        parts.millisecond,
      ) - offset;
  }
  return guess;
}

function getTimeZoneOffsetMs(timestamp: number, timeZone: string) {
  const parts = getLocalParts(timestamp, timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
  return localAsUtc - timestamp;
}

export function normalizeTimeZone(timeZone?: string) {
  if (!timeZone || timeZone.length > 80) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'UTC';
  }
}

// Calendar-day arithmetic keeps midnight boundaries correct across DST changes.
export function localDayNumber(timestamp: number, timeZone?: string) {
  const parts = getLocalParts(timestamp, normalizeTimeZone(timeZone));
  return Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS;
}

export function localDayBounds(dayNumber: number, timeZone?: string) {
  const zone = normalizeTimeZone(timeZone);
  const midnight = (day: number) => {
    const date = new Date(day * DAY_MS);
    const candidate = localTimeToUtcMs(
      {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      zone,
    );
    if (localDayNumber(candidate, zone) === day && localDayNumber(candidate - 1, zone) < day)
      return candidate;
    // A midnight DST gap can make offset iteration oscillate onto yesterday;
    // a fold can select the second midnight. Find the first instant of this
    // calendar date. A skipped date gets the same boundary as its successor.
    let before = day * DAY_MS - 36 * 60 * 60 * 1000;
    let after = day * DAY_MS + 36 * 60 * 60 * 1000;
    while (after - before > 1) {
      const middle = Math.floor((before + after) / 2);
      if (localDayNumber(middle, zone) < day) before = middle;
      else after = middle;
    }
    return after;
  };
  return { startAt: midnight(dayNumber), endAt: midnight(dayNumber + 1) };
}

export function localWeekDayNumbers(now: number, timeZone?: string) {
  const today = localDayNumber(now, timeZone);
  const daysSinceMonday = (new Date(today * DAY_MS).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, index) => today - daysSinceMonday + index);
}

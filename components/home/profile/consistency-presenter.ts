const DAY_MS = 24 * 60 * 60 * 1000;

export type ConsistencyDay = {
  activityCount: number;
  active: boolean;
  date: string;
  dayStartAt: number;
  isFuture: boolean;
  weekStartAt: number;
};

export function getConsistencyGaugeSegmentFill({
  accentColor,
  filled,
  index,
  isLoading,
  shellColor,
}: {
  accentColor: string;
  filled: number;
  index: number;
  isLoading: boolean;
  shellColor: string;
}) {
  if (isLoading || index >= filled) {
    return shellColor;
  }

  return accentColor;
}

export function getConsistencyGaugeSegmentOpacity(index: number) {
  return Math.min(1, 0.38 + index * 0.08);
}

export function groupConsistencyWeeks(days: ConsistencyDay[]) {
  const byWeek = new Map<number, ConsistencyDay[]>();
  for (const day of days) {
    const week = byWeek.get(day.weekStartAt) ?? [];
    week.push(day);
    byWeek.set(day.weekStartAt, week);
  }

  return Array.from(byWeek.entries())
    .sort(([left], [right]) => left - right)
    .map(([weekStartAt, weekDays]) => ({
      days: getSevenDayWeek(weekStartAt, weekDays),
      weekStartAt,
    }));
}

function getSevenDayWeek(weekStartAt: number, weekDays: ConsistencyDay[]) {
  const byDayStart = new Map(weekDays.map(day => [day.dayStartAt, day]));
  return Array.from({ length: 7 }, (_, index) => {
    const dayStartAt = weekStartAt + index * DAY_MS;
    return byDayStart.get(dayStartAt) ?? {
      activityCount: 0,
      active: false,
      date: new Date(dayStartAt).toISOString().slice(0, 10),
      dayStartAt,
      isFuture: true,
      weekStartAt,
    };
  });
}

export function getConsistencyCellFill({
  active,
  activeFill,
  isFuture,
  shellColor,
}: {
  active: boolean;
  activeFill: string;
  isFuture: boolean;
  shellColor: string;
}) {
  if (isFuture || !active) {
    return shellColor;
  }

  return activeFill;
}

export function getConsistencyCellOpacity({
  active,
  activityCount,
  isFuture,
}: {
  active: boolean;
  activityCount: number;
  isFuture: boolean;
}) {
  if (isFuture) {
    return 0.42;
  }

  if (!active) {
    return 1;
  }

  if (activityCount >= 5) {
    return 0.86;
  }

  if (activityCount >= 3) {
    return 0.62;
  }

  return 0.38;
}

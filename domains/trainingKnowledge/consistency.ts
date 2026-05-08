const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const GRID_WEEK_COUNT = 12;
const RECENT_WEEK_COUNT = 8;

type WeeklySessions = 'one_to_two' | 'two_to_four' | 'four_plus';

type CadenceTarget = { label: string; targetActiveDays: number };

const cadenceTargets: Record<WeeklySessions, CadenceTarget> = {
  four_plus: {
    label: '4+ days/week',
    targetActiveDays: 4,
  },
  one_to_two: {
    label: '1-2 days/week',
    targetActiveDays: 1,
  },
  two_to_four: {
    label: '2-4 days/week',
    targetActiveDays: 2,
  },
};

export type ConsistencyDay = {
  activityCount: number;
  active: boolean;
  date: string;
  dayStartAt: number;
  isFuture: boolean;
  weekStartAt: number;
};

export function getConsistencyWindow(now: number) {
  const currentWeekStartAt = startOfUtcWeek(now);
  return {
    currentWeekStartAt,
    gridEndAt: currentWeekStartAt + WEEK_MS,
    gridStartAt: currentWeekStartAt - (GRID_WEEK_COUNT - 1) * WEEK_MS,
  };
}

export function summarizeConsistency(args: {
  loggedAts: number[];
  now: number;
  weeklySessions: string | null;
}) {
  const { currentWeekStartAt, gridEndAt, gridStartAt } = getConsistencyWindow(args.now);
  const activityByDay = countActivityByUtcDay(args.loggedAts);
  const target = resolveCadenceTarget(args.weeklySessions);

  const weekSummaries = Array.from({ length: GRID_WEEK_COUNT }, (_, index) => {
    const weekStartAt = gridStartAt + index * WEEK_MS;
    const activeDays = countActiveDaysInWeek(activityByDay, weekStartAt);
    return {
      activeDays,
      isCurrent: weekStartAt === currentWeekStartAt,
      isOnTarget: target ? activeDays >= target.targetActiveDays : false,
      weekEndAt: weekStartAt + WEEK_MS,
      weekStartAt,
    };
  });

  const currentWeek = weekSummaries[weekSummaries.length - 1];
  const recentCompleteWeeks = weekSummaries
    .filter(week => !week.isCurrent)
    .slice(-RECENT_WEEK_COUNT);
  const recentOnTargetWeeks = recentCompleteWeeks.filter(week => week.isOnTarget).length;
  const remainingActiveDays = target
    ? Math.max(0, target.targetActiveDays - currentWeek.activeDays)
    : 0;

  const dayMap = buildDayMap({
    activityByDay,
    endAt: gridEndAt,
    now: args.now,
    startAt: gridStartAt,
  });

  const weekGrid = groupByWeek(dayMap);

  if (!target) {
    return {
      currentOnTargetWeekRun: 0,
      currentWeek: {
        ...currentWeek,
        remainingActiveDays: 0,
        targetActiveDays: 0,
      },
      hasTrainingTarget: false,
      helperLine: 'Finish your training profile before Reed evaluates rhythm.',
      recentOnTargetRate: {
        onTargetWeeks: 0,
        percent: 0,
        totalWeeks: recentCompleteWeeks.length,
      },
      subline: 'Finish the profile setup to activate the weekly target.',
      summaryLine: 'Set a weekly rhythm first.',
      target: null,
      weekGrid,
    };
  }

  const currentOnTargetWeekRun = countOnTargetRun(weekSummaries);

  return {
    currentOnTargetWeekRun,
    currentWeek: {
      ...currentWeek,
      remainingActiveDays,
      targetActiveDays: target.targetActiveDays,
    },
    hasTrainingTarget: true,
    helperLine: `Your target is ${target.label}. Each filled square is a day with logged training. Reed checks weeks against your cadence target, not daily streaks.`,
    recentOnTargetRate: {
      onTargetWeeks: recentOnTargetWeeks,
      percent: recentCompleteWeeks.length === 0
        ? 0
        : Math.round((recentOnTargetWeeks / recentCompleteWeeks.length) * 100),
      totalWeeks: recentCompleteWeeks.length,
    },
    subline: formatConsistencySubline({
      onTargetWeeks: recentOnTargetWeeks,
      totalWeeks: recentCompleteWeeks.length,
    }),
    summaryLine: formatSummaryLine({
      currentActiveDays: currentWeek.activeDays,
      currentRun: currentOnTargetWeekRun,
      remainingActiveDays,
      targetActiveDays: target.targetActiveDays,
    }),
    target,
    weekGrid,
  };
}

function resolveCadenceTarget(weeklySessions: string | null): CadenceTarget | null {
  if (weeklySessions === 'one_to_two' || weeklySessions === 'two_to_four' || weeklySessions === 'four_plus') {
    return cadenceTargets[weeklySessions];
  }

  return null;
}

function countActivityByUtcDay(loggedAts: number[]) {
  const counts = new Map<string, number>();
  for (const loggedAt of loggedAts) {
    const key = formatUtcDateKey(startOfUtcDay(loggedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function countActiveDaysInWeek(activityByDay: Map<string, number>, weekStartAt: number) {
  let activeDays = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    if ((activityByDay.get(formatUtcDateKey(weekStartAt + offset * DAY_MS)) ?? 0) > 0) {
      activeDays += 1;
    }
  }
  return activeDays;
}

function countOnTargetRun(weekSummaries: Array<{ isCurrent: boolean; isOnTarget: boolean }>) {
  let run = 0;
  for (let index = weekSummaries.length - 1; index >= 0; index -= 1) {
    const week = weekSummaries[index];
    if (week.isCurrent && !week.isOnTarget) {
      continue;
    }
    if (!week.isOnTarget) {
      break;
    }
    run += 1;
  }
  return run;
}

function buildDayMap({
  activityByDay,
  endAt,
  now,
  startAt,
}: {
  activityByDay: Map<string, number>;
  endAt: number;
  now: number;
  startAt: number;
}) {
  const days = Math.round((endAt - startAt) / DAY_MS);
  return Array.from({ length: days }, (_, index) => {
    const dayStartAt = startAt + index * DAY_MS;
    const key = formatUtcDateKey(dayStartAt);
    const activityCount = activityByDay.get(key) ?? 0;
    return {
      activityCount,
      active: activityCount > 0,
      date: key,
      dayStartAt,
      isFuture: dayStartAt > now,
      weekStartAt: startOfUtcWeek(dayStartAt),
    };
  });
}

function groupByWeek(days: ConsistencyDay[]) {
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

function formatConsistencySubline({
  onTargetWeeks,
  totalWeeks,
}: {
  onTargetWeeks: number;
  totalWeeks: number;
}) {
  if (totalWeeks === 0) {
    return 'Reed needs a few complete weeks before the recent rate is meaningful.';
  }

  return `${onTargetWeeks}/${totalWeeks} recent weeks met target. Complete-week run only.`;
}

function formatSummaryLine({
  currentActiveDays,
  currentRun,
  remainingActiveDays,
  targetActiveDays,
}: {
  currentActiveDays: number;
  currentRun: number;
  remainingActiveDays: number;
  targetActiveDays: number;
}) {
  if (remainingActiveDays === 0) {
    return currentRun > 1
      ? `On target this week. ${currentRun} weeks in rhythm.`
      : 'On target this week.';
  }

  if (currentActiveDays === 0) {
    return `${targetActiveDays} training ${targetActiveDays === 1 ? 'day' : 'days'} puts this week on target.`;
  }

  return `${remainingActiveDays} more ${remainingActiveDays === 1 ? 'day' : 'days'} puts this week on target.`;
}

function startOfUtcDay(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function startOfUtcWeek(timestamp: number) {
  const dayStartAt = startOfUtcDay(timestamp);
  const day = new Date(dayStartAt).getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return dayStartAt - daysSinceMonday * DAY_MS;
}

function formatUtcDateKey(dayStartAt: number) {
  return new Date(dayStartAt).toISOString().slice(0, 10);
}

import { localDayBounds, localDayNumber, localWeekDayNumbers, normalizeTimeZone } from '../time/local-calendar';
import { resolveWeeklyActiveDaysTarget } from './weekly-target';

const DAY_MS = 24 * 60 * 60 * 1000;
const GRID_WEEK_COUNT = 12;
const RECENT_WEEK_COUNT = 8;

export type ConsistencyDay = {
  activityCount: number;
  activityCountIsCapped: boolean;
  active: boolean;
  date: string;
  dayStartAt: number;
  isFuture: boolean;
  weekStartAt: number;
};

export function getConsistencyWindow(now: number, timeZone: string) {
  const currentWeekFirstDay = localWeekDayNumbers(now, timeZone)[0];
  const gridFirstDay = currentWeekFirstDay - (GRID_WEEK_COUNT - 1) * 7;
  return {
    currentWeekStartAt: localDayBounds(currentWeekFirstDay, timeZone).startAt,
    gridEndAt: localDayBounds(currentWeekFirstDay + 7, timeZone).startAt,
    gridStartAt: localDayBounds(gridFirstDay, timeZone).startAt,
    dayNumbers: Array.from({ length: GRID_WEEK_COUNT * 7 }, (_, index) => gridFirstDay + index),
  };
}

export function summarizeConsistency(args: {
  loggedAts: number[];
  now: number;
  timeZone: string;
  weeklyActiveDaysTarget?: number;
  cappedDayNumbers?: number[];
}) {
  const timeZone = normalizeTimeZone(args.timeZone);
  const { currentWeekStartAt, dayNumbers } = getConsistencyWindow(args.now, timeZone);
  const activityByDay = new Map<number, number>();
  for (const loggedAt of args.loggedAts) {
    if (loggedAt > args.now) continue;
    const day = localDayNumber(loggedAt, timeZone);
    activityByDay.set(day, (activityByDay.get(day) ?? 0) + 1);
  }
  const cappedDays = new Set(args.cappedDayNumbers);
  const targetActiveDays = resolveWeeklyActiveDaysTarget(args);
  const target = targetActiveDays === null ? null : {
    label: `${targetActiveDays} ${targetActiveDays === 1 ? 'day' : 'days'}/week`,
    targetActiveDays,
  };
  const weekGrid = Array.from({ length: GRID_WEEK_COUNT }, (_, index) => {
    const firstDay = dayNumbers[index * 7];
    const weekStartAt = localDayBounds(firstDay, timeZone).startAt;
    const days: ConsistencyDay[] = dayNumbers.slice(index * 7, index * 7 + 7).map(day => {
      const dayStartAt = localDayBounds(day, timeZone).startAt;
      const activityCount = activityByDay.get(day) ?? 0;
      return {
        activityCount,
        activityCountIsCapped: cappedDays.has(day),
        active: activityCount > 0,
        date: new Date(day * DAY_MS).toISOString().slice(0, 10),
        dayStartAt,
        isFuture: dayStartAt > args.now,
        weekStartAt,
      };
    });
    return { days, weekStartAt };
  });
  const weekSummaries = weekGrid.map((week, index) => {
    const activeDays = week.days.filter(day => day.active).length;
    return {
      activeDays,
      isCurrent: week.weekStartAt === currentWeekStartAt,
      isOnTarget: target ? activeDays >= target.targetActiveDays : false,
      weekEndAt: localDayBounds(dayNumbers[index * 7] + 7, timeZone).startAt,
      weekStartAt: week.weekStartAt,
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

  if (!target) {
    return {
      currentOnTargetWeekRun: 0,
      currentWeek: {
        ...currentWeek,
        remainingActiveDays: 0,
        targetActiveDays: 0,
      },
      hasTrainingTarget: false,
      timeZone,
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
    timeZone,
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

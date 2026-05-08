import { query } from './_generated/server';
import { requireViewerProfile } from './profiles';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const GRID_WEEK_COUNT = 12;
const RECENT_WEEK_COUNT = 8;

type WeeklySessions = 'one_to_two' | 'two_to_four' | 'four_plus';

const cadenceTargets: Record<WeeklySessions, { label: string; targetActiveDays: number }> = {
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

function resolveCadenceTarget(weeklySessions: string) {
  if (weeklySessions === 'one_to_two' || weeklySessions === 'two_to_four' || weeklySessions === 'four_plus') {
    return cadenceTargets[weeklySessions];
  }

  return null;
}

export const viewerConsistency = query({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const trainingProfile = await ctx.db
      .query('trainingProfiles')
      .withIndex('by_profile_id', q => q.eq('profileId', profile._id))
      .unique();
    const now = Date.now();
    const currentWeekStartAt = startOfUtcWeek(now);
    const gridStartAt = currentWeekStartAt - (GRID_WEEK_COUNT - 1) * WEEK_MS;
    const gridEndAt = currentWeekStartAt + WEEK_MS;

    const logs = await ctx.db
      .query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q =>
        q.eq('profileId', profile._id).gte('loggedAt', gridStartAt).lt('loggedAt', Math.min(now + 1, gridEndAt)),
      )
      .collect();
    const activityByDay = countActivityByUtcDay(logs.map(log => log.loggedAt));
    const target = trainingProfile
      ? resolveCadenceTarget(trainingProfile.trainingReality.weeklySessions)
      : null;
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
    const currentOnTargetWeekRun = countOnTargetRun(weekSummaries);
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
        dayMap: buildDayMap({ activityByDay, endAt: gridEndAt, now, startAt: gridStartAt }),
        hasTrainingTarget: false,
        helperCopy: 'Finish your training profile before Reed evaluates rhythm.',
        helperLine: 'Finish your training profile before Reed evaluates rhythm.',
        recentOnTargetRate: {
          onTargetWeeks: 0,
          percent: 0,
          totalWeeks: recentCompleteWeeks.length,
        },
        subline: 'Finish the profile setup to activate the weekly target.',
        summaryLine: 'Set a weekly rhythm first.',
        target: null,
      };
    }

    return {
      currentOnTargetWeekRun,
      currentWeek: {
        ...currentWeek,
        remainingActiveDays,
        targetActiveDays: target.targetActiveDays,
      },
      dayMap: buildDayMap({ activityByDay, endAt: gridEndAt, now, startAt: gridStartAt }),
      hasTrainingTarget: true,
      helperCopy: 'Each filled square is a day with logged training. Reed checks weeks against your cadence target, not daily streaks.',
      helperLine: `Your target is ${target.label}. Each filled square is a day with logged training. Reed checks weeks against your cadence target, not daily streaks.`,
      recentOnTargetRate: {
        onTargetWeeks: recentOnTargetWeeks,
        percent: recentCompleteWeeks.length === 0
          ? 0
          : Math.round((recentOnTargetWeeks / recentCompleteWeeks.length) * 100),
        totalWeeks: recentCompleteWeeks.length,
      },
      subline: formatConsistencySubline({
        hasTrainingTarget: true,
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
    };
  },
});

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

function formatConsistencySubline({
  hasTrainingTarget,
  onTargetWeeks,
  totalWeeks,
}: {
  hasTrainingTarget: boolean;
  onTargetWeeks: number;
  totalWeeks: number;
}) {
  if (!hasTrainingTarget) {
    return 'Finish the profile setup to activate the weekly target.';
  }

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

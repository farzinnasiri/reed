import { trainingCadence } from './trainingProfileRead';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import type { QueryCtx } from './_generated/server';
import { getConsistencyWindow, summarizeConsistency } from '../domains/trainingKnowledge/consistency';
import { localDayBounds } from './localCalendar';
import { loadProfileTimeZone } from './profileTimeZone';

const DAILY_ACTIVITY_COUNT_LIMIT = 128;

export const consistencyValidator = v.object({
  currentOnTargetWeekRun: v.number(),
  currentWeek: v.object({
    activeDays: v.number(), isCurrent: v.boolean(), isOnTarget: v.boolean(),
    weekEndAt: v.number(), weekStartAt: v.number(),
    remainingActiveDays: v.number(), targetActiveDays: v.number(),
  }),
  hasTrainingTarget: v.boolean(), timeZone: v.string(),
  helperLine: v.string(), subline: v.string(), summaryLine: v.string(),
  recentOnTargetRate: v.object({ onTargetWeeks: v.number(), percent: v.number(), totalWeeks: v.number() }),
  target: v.union(v.null(), v.object({ label: v.string(), targetActiveDays: v.number() })),
  weekGrid: v.array(v.object({
    weekStartAt: v.number(),
    days: v.array(v.object({
      activityCount: v.number(), activityCountIsCapped: v.boolean(), active: v.boolean(),
      date: v.string(), dayStartAt: v.number(), isFuture: v.boolean(), weekStartAt: v.number(),
    })),
  })),
});

export async function readProfileConsistency(ctx: QueryCtx, profileId: Id<'profiles'>, now: number) {
  const [timeZone, trainingProfile] = await Promise.all([
    loadProfileTimeZone(ctx, profileId),
    ctx.db.query('trainingProfiles').withIndex('by_profile_id', q => q.eq('profileId', profileId)).unique(),
  ]);
  const { dayNumbers } = getConsistencyWindow(now, timeZone);
  // Read each day's index range separately so a dense day cannot hide other
  // active days. Counts may cap, but weekly active days always match Pulse.
  const days = await Promise.all(dayNumbers.map(async day => {
    const { startAt, endAt } = localDayBounds(day, timeZone);
    const logs = startAt > now ? [] : await ctx.db.query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q => q.eq('profileId', profileId)
        .gte('loggedAt', startAt).lt('loggedAt', Math.min(now + 1, endAt)))
      .take(DAILY_ACTIVITY_COUNT_LIMIT + 1);
    return { day, logs: logs.slice(0, DAILY_ACTIVITY_COUNT_LIMIT), capped: logs.length > DAILY_ACTIVITY_COUNT_LIMIT };
  }));
  return summarizeConsistency({
    loggedAts: days.flatMap(day => day.logs.map(log => log.loggedAt)),
    cappedDayNumbers: days.filter(day => day.capped).map(day => day.day),
    now,
    timeZone,
    weeklyActiveDaysTarget: trainingCadence(trainingProfile).weeklyActiveDaysTarget,
  });
}

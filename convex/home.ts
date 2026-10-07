import { trainingCadence } from './trainingProfileRead';
import { v } from 'convex/values';
import { query } from './_generated/server';
import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';
import { resolveWeeklyActiveDaysTarget } from './weeklyTrainingTarget';
import { loadProfileTimeZone } from './profileTimeZone';
import { localDayBounds, localDayNumber, localWeekDayNumbers, resolveHomeNow } from './homeTime';
import { selectNearestGoal } from './homePulse';
import { deriveTodayCards, RECOVERY_TRAINING_DAYS, selectTodayPresetKeys } from './homeTodayCards';

const ACTIVE_TARGET_LIMIT = 100;
const ENABLED_PRESET_LIMIT = 100;
const QUICK_LOG_USAGE_LIMIT = 200;

const bodyweightValidator = v.union(v.null(), v.object({ latestKg: v.number(), loggedAt: v.number() }));
const todayCardValidator = v.union(
  v.object({ kind: v.literal('weigh_in'), lastKg: v.union(v.number(), v.null()), lastLoggedAt: v.union(v.number(), v.null()), reason: v.string() }),
  v.object({ kind: v.literal('quick_log'), presetKeys: v.array(v.string()), reason: v.string() }),
);

export const getPulse = query({
  args: { now: v.number() },
  returns: v.object({
    week: v.object({
      days: v.array(v.union(v.literal('done'), v.literal('today'), v.literal('none'))),
      count: v.number(),
      target: v.union(v.number(), v.null()),
    }),
    bodyweight: bodyweightValidator,
    nearestGoal: v.union(v.null(), v.object({
      targetId: v.id('trainingTargets'), label: v.string(), current: v.number(), goal: v.number(), unit: v.string(),
    })),
  }),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const now = resolveHomeNow(args.now, Date.now());
    const [timeZone, trainingProfile, bodyweight, targets] = await Promise.all([
      loadProfileTimeZone(ctx, profile._id),
      ctx.db.query('trainingProfiles').withIndex('by_profile_id', q => q.eq('profileId', profile._id)).unique(),
      loadLatestBodyweight(ctx, profile._id),
      ctx.db.query('trainingTargets')
        .withIndex('by_profile_id_and_status_and_updated_at', q => q.eq('profileId', profile._id).eq('status', 'active'))
        .order('desc').take(ACTIVE_TARGET_LIMIT),
    ]);

    const today = localDayNumber(now, timeZone);
    const weekDays = localWeekDayNumbers(now, timeZone);
    const activityCounts = await loadDayActivityCounts(ctx, profile._id, weekDays, now, timeZone);
    const days = weekDays.map((day, index): 'done' | 'today' | 'none' =>
      activityCounts[index] > 0 ? 'done' : day === today ? 'today' : 'none');
    const target = resolveWeeklyActiveDaysTarget(trainingCadence(trainingProfile));
    return {
      week: { days, count: days.filter(day => day === 'done').length, target },
      bodyweight,
      nearestGoal: selectNearestGoal(targets),
    };
  },
});

export const getTodayCards = query({
  args: { now: v.number() },
  returns: v.array(todayCardValidator),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const now = resolveHomeNow(args.now, Date.now());
    const [timeZone, bodyweight] = await Promise.all([
      loadProfileTimeZone(ctx, profile._id), loadLatestBodyweight(ctx, profile._id),
    ]);
    const today = localDayNumber(now, timeZone);
    const activityCounts = await loadDayActivityCounts(ctx, profile._id,
      Array.from({ length: RECOVERY_TRAINING_DAYS + 1 }, (_, index) => today - index), now, timeZone);
    const cards = deriveTodayCards({ now, timeZone, bodyweight, activityCounts, presetKeys: [] });
    if (!cards.some(card => card.kind === 'quick_log')) return cards;

    const [presets, usageLogs] = await Promise.all([
      ctx.db.query('quickLogPresets').withIndex('by_enabled_and_sort_order', q => q.eq('isEnabled', true))
        .take(ENABLED_PRESET_LIMIT),
      ctx.db.query('activityLogs')
        .withIndex('by_profile_id_and_source_and_logged_at', q => q.eq('profileId', profile._id).eq('source', 'quick_log'))
        .order('desc').take(QUICK_LOG_USAGE_LIMIT),
    ]);
    // Most used recently: count only the user's most recent 200 quick logs.
    const counts = new Map<Id<'exerciseCatalog'>, number>();
    for (const log of usageLogs) counts.set(log.exerciseCatalogId, (counts.get(log.exerciseCatalogId) ?? 0) + 1);
    const presetKeys = selectTodayPresetKeys(presets.map(preset => ({
      key: preset.key, group: preset.group, sortOrder: preset.sortOrder, count: counts.get(preset.exerciseCatalogId) ?? 0,
    })));
    return deriveTodayCards({ now, timeZone, bodyweight, activityCounts, presetKeys });
  },
});

async function loadLatestBodyweight(ctx: QueryCtx, profileId: Id<'profiles'>) {
  const measurement = await ctx.db.query('bodyMeasurements')
    .withIndex('by_profile_id_and_metric_key_and_observed_at', q => q.eq('profileId', profileId).eq('metricKey', 'body_weight'))
    .order('desc').first();
  return measurement ? { latestKg: measurement.value, loggedAt: measurement.observedAt } : null;
}

async function loadDayActivityCounts(ctx: QueryCtx, profileId: Id<'profiles'>, dayNumbers: number[], now: number, timeZone: string) {
  return await Promise.all(dayNumbers.map(async day => {
    const { startAt, endAt } = localDayBounds(day, timeZone);
    if (startAt > now) return 0;
    const log = await ctx.db.query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q => q.eq('profileId', profileId).gte('loggedAt', startAt).lt('loggedAt', Math.min(endAt, now + 1)))
      .first();
    return log ? 1 : 0;
  }));
}

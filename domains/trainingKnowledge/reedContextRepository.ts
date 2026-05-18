import type { QueryCtx } from '../../convex/_generated/server';
import type { Id } from '../../convex/_generated/dataModel';
import type { ReedContextBlock, ReedTimeRange } from '../../convex/reedContextTypes';
import { resolveReedTimeRange } from '../../convex/reedContextTime';
import { summarizeTrainingWindow } from './trainingHistory';
import { buildBodyweightTrend } from './bodyStatus';
import { formatSetOutcomeDetails } from '../workout/modifier-formatting';
import { summarizeMetrics, type RecipeKey } from '../workout/recipes';

export async function summarizeTrainingWindowContext(ctx: QueryCtx, args: {
  clientNow: number;
  clientTimeZone?: string;
  profileId: Id<'profiles'>;
  range: ReedTimeRange;
}): Promise<ReedContextBlock> {
  const range = resolveReedTimeRange({ now: args.clientNow, range: args.range, timeZone: args.clientTimeZone });
  const logs = await ctx.db
    .query('activityLogs')
    .withIndex('by_profile_id_and_logged_at', q => q.eq('profileId', args.profileId).gte('loggedAt', range.startAt).lte('loggedAt', range.endAt))
    .take(500);
  const sessions = await ctx.db
    .query('liveSessions')
    .withIndex('by_profile_id_and_status_and_started_at', q => q.eq('profileId', args.profileId).eq('status', 'ended').gte('startedAt', range.startAt).lte('startedAt', range.endAt))
    .order('desc')
    .take(12);
  const sessionExercises = await Promise.all(sessions.map(async session => ({
    session,
    exercises: await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
      .collect(),
  })));
  const exercises = await loadExerciseMap(ctx, getUniqueIds(logs.map(log => log.exerciseCatalogId)));
  const summary = summarizeTrainingWindow({
    exercises: Array.from(exercises.entries()).flatMap(([exerciseCatalogId, exercise]) => exercise ? [{
      exerciseCatalogId,
      exerciseName: exercise.name,
      isCardio: exercise.isCardio,
      mainMuscleGroups: exercise.mainMuscleGroups,
      secondaryMuscleGroups: exercise.secondaryMuscleGroups,
    }] : []),
    logs: logs.map(log => ({
      exerciseCatalogId: log.exerciseCatalogId,
      loggedAt: log.loggedAt,
      metrics: log.metrics,
      recipeKey: log.recipeKey as RecipeKey,
      setOutcome: log.setOutcomeDetails ?? null,
      source: log.source,
    })),
    now: args.clientNow,
    windowEndAt: range.endAt,
    windowStartAt: range.startAt,
  });

  return {
    title: `Training summary: ${range.label}`,
    content: [
      `${summary.activityCount} logged set${summary.activityCount === 1 ? '' : 's'} in ${range.label}.`,
      sessionExercises.length > 0 ? `Ended sessions: ${sessionExercises.map(item => {
        const names = item.exercises.slice(0, 5).map(exercise => exercise.exerciseName).join(', ');
        const durationMinutes = item.session.endedAt ? Math.max(1, Math.round((item.session.endedAt - item.session.startedAt) / 60000)) : null;
        return `${formatDateForContext(item.session.startedAt, args.clientTimeZone)}${durationMinutes ? ` (${durationMinutes} min)` : ''}${names ? `: ${names}` : ''}`;
      }).join('; ')}.` : null,
      summary.byExercise.length > 0 ? `Top exercises: ${summary.byExercise.slice(0, 6).map(exercise => `${exercise.exerciseName} (${exercise.setCount})`).join(', ')}.` : 'No exercises logged in this range.',
      summary.recentActivities.length > 0 ? `Recent work: ${summary.recentActivities.slice(0, 6).map(activity => `${activity.exerciseName} ${activity.summary}`).join('; ')}.` : null,
      summary.work.groups.length > 0 ? `Main work focus: ${summary.work.groups.slice(0, 5).map(group => `${group.label} (${group.setCount} sets)`).join(', ')}.` : null,
    ].filter(Boolean).join('\n'),
  };
}

export async function bodyweightTrendContext(ctx: QueryCtx, args: {
  clientNow: number;
  clientTimeZone?: string;
  profileId: Id<'profiles'>;
  range: ReedTimeRange;
}): Promise<ReedContextBlock> {
  const range = resolveReedTimeRange({ now: args.clientNow, range: args.range, timeZone: args.clientTimeZone });
  const points = await ctx.db
    .query('bodyMeasurements')
    .withIndex('by_profile_id_and_metric_key_and_observed_at', q => q.eq('profileId', args.profileId).eq('metricKey', 'body_weight').gte('observedAt', range.startAt).lte('observedAt', range.endAt))
    .take(200);
  const trend = buildBodyweightTrend({
    points: points.map(point => ({ observedAt: point.observedAt, unit: point.unit, value: point.value })),
    windowEndAt: range.endAt,
    windowStartAt: range.startAt,
  });

  return {
    title: `Bodyweight trend: ${range.label}`,
    content: trend.latest
      ? [
          `${trend.pointCount} bodyweight point${trend.pointCount === 1 ? '' : 's'} in ${range.label}.`,
          `Latest: ${formatNumber(trend.latest.value)} ${trend.latest.unit}.`,
          trend.delta === null ? null : `Change: ${trend.delta >= 0 ? '+' : ''}${formatNumber(trend.delta)} ${trend.latest.unit}.`,
        ].filter(Boolean).join('\n')
      : `No bodyweight entries found in ${range.label}.`,
  };
}

export async function exercisePerformanceHistoryContext(ctx: QueryCtx, args: {
  clientNow: number;
  clientTimeZone?: string;
  exerciseQuery: string;
  profileId: Id<'profiles'>;
  range: ReedTimeRange;
}): Promise<ReedContextBlock> {
  const range = resolveReedTimeRange({ now: args.clientNow, range: args.range, timeZone: args.clientTimeZone });
  const exercise = await findExercise(ctx, args.exerciseQuery);
  if (!exercise) {
    return { title: `Exercise history: ${args.exerciseQuery}`, content: `No matching exercise found for "${args.exerciseQuery}".` };
  }

  const logs = await ctx.db
    .query('activityLogs')
    .withIndex('by_profile_id_and_exercise_catalog_id_and_logged_at', q =>
      q.eq('profileId', args.profileId).eq('exerciseCatalogId', exercise._id).gte('loggedAt', range.startAt).lte('loggedAt', range.endAt),
    )
    .take(500);
  const workingLogs = logs.filter(log => !log.warmup);
  const topReps = maxMetric(workingLogs, 'reps');
  const topLoad = maxMetric(workingLogs, 'load') ?? maxMetric(workingLogs, 'addedLoad');
  const sessions = new Set(workingLogs.map(log => log.sessionId ?? `quick:${log._id}`));
  const recent = [...workingLogs]
    .sort((left, right) => right.loggedAt - left.loggedAt)
    .slice(0, 8)
    .map(log => summarizeLogForCoaching(log.recipeKey as RecipeKey, log.metrics, log.setOutcomeDetails ?? null));

  return {
    title: `${exercise.name} history: ${range.label}`,
    content: [
      `${workingLogs.length} working set${workingLogs.length === 1 ? '' : 's'} across ${sessions.size} exposure${sessions.size === 1 ? '' : 's'} in ${range.label}.`,
      topReps === null ? null : `Best reps in a set: ${formatNumber(topReps)}.`,
      topLoad === null ? null : `Heaviest load: ${formatNumber(topLoad)} kg.`,
      recent.length > 0 ? `Recent sets: ${recent.join('; ')}.` : 'No working sets found in this range.',
    ].filter(Boolean).join('\n'),
  };
}

async function findExercise(ctx: QueryCtx, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  const searchResults = await ctx.db
    .query('exerciseCatalog')
    .withSearchIndex('search_text', q => q.search('searchText', normalized).eq('isSupportedInLiveSession', true))
    .take(1);
  if (searchResults[0]) return searchResults[0];

  const supported = await ctx.db
    .query('exerciseCatalog')
    .withIndex('by_supported_in_live_session', q => q.eq('isSupportedInLiveSession', true))
    .take(200);
  return supported.find(exercise => exercise.name.toLowerCase().includes(normalized) || exercise.aliases.some(alias => alias.toLowerCase().includes(normalized))) ?? null;
}

async function loadExerciseMap(ctx: QueryCtx, ids: Id<'exerciseCatalog'>[]) {
  const entries = await Promise.all(ids.map(async id => [id, await ctx.db.get(id)] as const));
  return new Map(entries);
}

function getUniqueIds(ids: Id<'exerciseCatalog'>[]) {
  return Array.from(new Set(ids));
}

function maxMetric(logs: Array<{ metrics: Record<string, number> }>, key: string) {
  let max: number | null = null;
  for (const log of logs) {
    const value = log.metrics[key];
    if (typeof value === 'number' && Number.isFinite(value)) max = max === null ? value : Math.max(max, value);
  }
  return max;
}

function summarizeLogForCoaching(
  recipeKey: RecipeKey,
  metrics: Record<string, number>,
  setOutcome: Parameters<typeof formatSetOutcomeDetails>[0],
) {
  const baseSummary = summarizeMetrics(recipeKey, metrics);
  const outcomeDetails = formatSetOutcomeDetails(setOutcome, metrics);
  return outcomeDetails ? `${baseSummary} (${outcomeDetails})` : baseSummary;
}

function formatDateForContext(timestamp: number, timeZone?: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone && timeZone.length <= 80 ? { timeZone } : {}),
  });
  return formatter.format(new Date(timestamp));
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

import { internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { summarizeTrainingWindow } from '../domains/trainingKnowledge/trainingHistory';
import { buildBodyweightTrend } from '../domains/trainingKnowledge/bodyStatus';
import type { RecipeKey } from '../domains/workout/recipes';

const DAY_MS = 24 * 60 * 60 * 1000;

export const snapshot = internalQuery({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    const now = Date.now();
    const weekStartAt = now - 7 * DAY_MS;
    const bodyStartAt = now - 90 * DAY_MS;
    const trainingProfile = await ctx.db.query('trainingProfiles').withIndex('by_profile_id', q => q.eq('profileId', args.profileId)).unique();
    const logs = await ctx.db.query('activityLogs').withIndex('by_profile_id_and_logged_at', q => q.eq('profileId', args.profileId).gte('loggedAt', weekStartAt).lte('loggedAt', now)).take(500);
    const bodyPoints = await ctx.db.query('bodyMeasurements').withIndex('by_profile_id_and_metric_key_and_observed_at', q => q.eq('profileId', args.profileId).eq('metricKey', 'body_weight').gte('observedAt', bodyStartAt).lte('observedAt', now)).take(200);
    const exercises = await Promise.all(Array.from(new Set(logs.map(log => log.exerciseCatalogId))).map(async id => [id, await ctx.db.get(id)] as const));
    const exerciseMap = new Map(exercises);
    const summary = summarizeTrainingWindow({
      exercises: Array.from(exerciseMap.entries()).flatMap(([exerciseCatalogId, exercise]) => exercise ? [{
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
        source: log.source,
      })),
      now,
      windowEndAt: now,
      windowStartAt: weekStartAt,
    });
    const body = buildBodyweightTrend({
      points: bodyPoints.map(point => ({ observedAt: point.observedAt, unit: point.unit, value: point.value })),
      windowEndAt: now,
      windowStartAt: bodyStartAt,
    });
    return {
      now,
      trainingProfile: trainingProfile ? {
        weeklyTarget: trainingProfile.trainingReality.weeklySessions,
        constraints: trainingProfile.constraints.areas,
      } : null,
      primaryGoal: trainingProfile?.rankedGoals[0] ?? null,
      week: {
        activeDays: new Set(logs.map(log => new Date(log.loggedAt).toISOString().slice(0, 10))).size,
        sets: summary.activityCount,
        topExercises: summary.byExercise.slice(0, 5).map(exercise => `${exercise.exerciseName} (${exercise.setCount})`),
        topGroups: summary.work.groups.filter(group => group.setCount > 0).slice(0, 4).map(group => `${group.label} (${group.setCount})`),
        totalVolume: summary.work.totalVolume,
      },
      body: {
        latestWeightKg: body.latest?.value ?? null,
        weightDelta90d: body.delta,
        points: body.pointCount,
      },
    };
  },
});

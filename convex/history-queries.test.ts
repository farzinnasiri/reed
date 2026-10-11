/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('quick log history pages through the source index', async () => {
  const t = convexTest(schema, modules);
  const viewer = t.withIdentity({ tokenIdentifier: 'test|owner', email: 'owner@example.test' });
  await t.run(async ctx => {
    const profileId = await ctx.db.insert('profiles', {
      authUserId: 'test|owner',
      email: 'owner@example.test',
      updatedAt: 1,
    });
    const exerciseCatalogId = await ctx.db.insert('exerciseCatalog', {
      aliases: [],
      canonicalFamily: 'push_up',
      contextTags: [],
      equipment: [],
      exerciseClass: 'strength',
      exerciseId: 'push-up',
      isCardio: false,
      isHold: false,
      isSupportedInLiveSession: true,
      jointsEmphasized: [],
      mainMuscleGroups: ['chest'],
      movementPatterns: [],
      name: 'Push-Up',
      rawMetricRecipe: '',
      recipeKey: 'bodyweight_reps',
      searchText: 'push-up',
      secondaryMuscleGroups: [],
      skillTags: [],
      supportsLiveTracking: false,
      updatedAt: 1,
      usesBodyweight: true,
    });
    for (const loggedAt of [5, 10, 20, 30]) {
      await ctx.db.insert('activityLogs', {
        exerciseCatalogId,
        loggedAt,
        metrics: { reps: 5 },
        profileId,
        recipeKey: 'bodyweight_reps',
        setNumber: 1,
        source: 'quick_log',
        warmup: false,
      });
    }
  });

  const first = await viewer.query(api.quickLogs.listRecentActivity, { limit: 2, sinceLoggedAt: 10 });
  expect(first.logs.map(log => log.loggedAt)).toEqual([30, 20]);
  expect(first.nextBeforeLoggedAt).toBe(20);
  const second = await viewer.query(api.quickLogs.listRecentActivity, {
    beforeLoggedAt: first.nextBeforeLoggedAt ?? undefined,
    limit: 2,
    sinceLoggedAt: 10,
  });
  expect(second.logs.map(log => log.loggedAt)).toEqual([10]);
  expect(second.nextBeforeLoggedAt).toBeNull();
});

test('history queries keep the date window and the owner', async () => {
  const t = convexTest(schema, modules);
  const viewer = t.withIdentity({ tokenIdentifier: 'test|owner', email: 'owner@example.test' });
  const since = Date.UTC(2026, 9, 5);
  const before = Date.UTC(2026, 9, 12);
  await t.run(async ctx => {
    const profileId = await ctx.db.insert('profiles', {
      authUserId: 'test|owner', email: 'owner@example.test', updatedAt: 1,
    });
    const foreignProfileId = await ctx.db.insert('profiles', {
      authUserId: 'test|foreign', email: 'foreign@example.test', updatedAt: 1,
    });
    const exerciseCatalogId = await ctx.db.insert('exerciseCatalog', {
      aliases: [], canonicalFamily: 'push_up', contextTags: [], equipment: [],
      exerciseClass: 'strength', exerciseId: 'push-up', isCardio: false, isHold: false,
      isSupportedInLiveSession: true, jointsEmphasized: [], mainMuscleGroups: ['chest'],
      movementPatterns: [], name: 'Push-Up', rawMetricRecipe: '', recipeKey: 'bodyweight_reps',
      searchText: 'push-up', secondaryMuscleGroups: [], skillTags: [], supportsLiveTracking: false,
      updatedAt: 1, usesBodyweight: true,
    });
    for (const startedAt of [since - 1, since, before - 1, before]) {
      const sessionId = await ctx.db.insert('liveSessions', {
        activeProcess: null, endedAt: startedAt + 1, profileId, startedAt, status: 'ended',
      });
      await ctx.db.insert('liveSessionExercises', {
        addedAt: startedAt, exerciseCatalogId, exerciseClass: 'strength', exerciseName: 'Push-Up',
        position: 0, profileId, recipeKey: 'bodyweight_reps', sessionId,
      });
      await ctx.db.insert('activityLogs', {
        exerciseCatalogId, loggedAt: startedAt, metrics: { reps: 5 }, profileId,
        recipeKey: 'bodyweight_reps', setNumber: 1, source: 'quick_log', warmup: false,
      });
    }
    const foreignSessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null, endedAt: since + 1, profileId: foreignProfileId, startedAt: since, status: 'ended',
    });
    await ctx.db.insert('liveSessionExercises', {
      addedAt: since, exerciseCatalogId, exerciseClass: 'strength', exerciseName: 'Push-Up',
      position: 0, profileId: foreignProfileId, recipeKey: 'bodyweight_reps', sessionId: foreignSessionId,
    });
    await ctx.db.insert('activityLogs', {
      exerciseCatalogId, loggedAt: since, metrics: { reps: 5 }, profileId: foreignProfileId,
      recipeKey: 'bodyweight_reps', setNumber: 1, source: 'quick_log', warmup: false,
    });
  });

  const workouts = await viewer.query(api.liveSessions.listEndedSummaries, {
    beforeStartedAt: before, limit: 8, sinceStartedAt: since,
  });
  expect(workouts.summaries.map(row => row.startedAt)).toEqual([before - 1, since]);
  expect(workouts.nextBeforeStartedAt).toBeNull();
  const logs = await viewer.query(api.quickLogs.listRecentActivity, {
    beforeLoggedAt: before, limit: 40, sinceLoggedAt: since,
  });
  expect(logs.logs.map(log => log.loggedAt)).toEqual([before - 1, since]);
  expect(logs.nextBeforeLoggedAt).toBeNull();
  await expect(t.query(api.liveSessions.listEndedSummaries, { beforeStartedAt: before, sinceStartedAt: since })).rejects.toThrow();
  await expect(t.query(api.quickLogs.listRecentActivity, { beforeLoggedAt: before, sinceLoggedAt: since })).rejects.toThrow();
});

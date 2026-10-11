/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function owner() {
  const t = convexTest(schema, modules);
  const profileId = await t.run(ctx => ctx.db.insert('profiles', {
    authUserId: 'test|owner',
    email: 'owner@example.test',
    updatedAt: 1,
  }));
  return { t, profileId, viewer: t.withIdentity({ tokenIdentifier: 'test|owner', email: 'owner@example.test' }) };
}

function catalog(name: string) {
  return {
    aliases: [] as string[],
    canonicalFamily: 'bench_press',
    contextTags: [] as string[],
    equipment: ['barbell'],
    exerciseClass: 'strength',
    exerciseId: name.toLowerCase().replace(/\s+/g, '-'),
    isCardio: false,
    isHold: false,
    isSupportedInLiveSession: true,
    jointsEmphasized: [] as string[],
    mainMuscleGroups: ['chest'],
    movementPatterns: [] as string[],
    name,
    rawMetricRecipe: '',
    recipeKey: 'standard_load' as const,
    searchText: name.toLowerCase(),
    secondaryMuscleGroups: [] as string[],
    skillTags: [] as string[],
    supportsLiveTracking: false,
    updatedAt: 1,
    usesBodyweight: false,
  };
}

test('deleting a workout lets the remaining logs decide verified goals', async () => {
  const { t, profileId, viewer } = await owner();
  const now = Date.now();
  const { keptId, sessionId } = await t.run(async ctx => {
    const exerciseCatalogId = await ctx.db.insert('exerciseCatalog', catalog('Bench press'));
    const otherExerciseId = await ctx.db.insert('exerciseCatalog', { ...catalog('Row'), canonicalFamily: 'row', exerciseId: 'row' });
    const sessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null,
      endedAt: now - 1_000,
      profileId,
      startedAt: now - 60_000,
      status: 'ended',
    });
    const keptSessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null,
      endedAt: now - 1_000,
      profileId,
      startedAt: now - 120_000,
      status: 'ended',
    });
    const provedId = await ctx.db.insert('activityLogs', {
      exerciseCatalogId,
      loggedAt: now - 30_000,
      metrics: { reps: 10 },
      profileId,
      recipeKey: 'standard_load',
      sessionId,
      setNumber: 1,
      source: 'live_session',
      warmup: false,
    });
    const keptId = await ctx.db.insert('activityLogs', {
      exerciseCatalogId: otherExerciseId,
      loggedAt: now - 90_000,
      metrics: { reps: 10 },
      profileId,
      recipeKey: 'standard_load',
      sessionId: keptSessionId,
      setNumber: 1,
      source: 'live_session',
      warmup: false,
    });
    const goal = (title: string, threshold: number, patch: Record<string, unknown>) => ctx.db.insert('trainingTargets', {
      createdAt: now,
      endsAt: now + 86_400_000,
      previewText: title,
      profileId,
      progressSummary: { current: 10, currentLabel: '10 reps', required: threshold, requiredLabel: `${threshold} reps` },
      rule: {
        cadence: 'total',
        exerciseCatalogId,
        metricKind: 'exerciseTotalReps',
        threshold,
        thresholdUnit: 'reps',
      },
      startsAt: now - 86_400_000,
      status: 'active',
      title,
      updatedAt: now,
      ...patch,
    });
    await goal('Open', 10, {
      completedAt: now,
      completionSource: 'verified',
      status: 'completed',
      verifiedSnapshot: { evaluatedAt: now, evidenceActivityLogIds: [provedId], summary: '10 / 10 reps' },
    });
    await goal('By hand', 10, {
      completedAt: now,
      completionSource: 'manual',
      status: 'completed',
      verifiedSnapshot: { evaluatedAt: now, evidenceActivityLogIds: [provedId], summary: 'Marked' },
    });
    await goal('Still counting', 20, {});
    await goal('Still met', 10, {
      completedAt: now,
      completionSource: 'verified',
      rule: {
        cadence: 'total',
        exerciseCatalogId: otherExerciseId,
        metricKind: 'exerciseTotalReps',
        threshold: 10,
        thresholdUnit: 'reps',
      },
      status: 'completed',
      verifiedSnapshot: { evaluatedAt: now, evidenceActivityLogIds: [provedId, keptId], summary: '10 / 10 reps' },
    });
    await goal('Window closed', 10, {
      completedAt: now,
      completionSource: 'verified',
      endsAt: now - 1_000,
      status: 'completed',
      verifiedSnapshot: { evaluatedAt: now - 1_000, evidenceActivityLogIds: [provedId], summary: '10 / 10 reps' },
    });
    return { keptId, sessionId };
  });

  await viewer.mutation(api.liveSessions.deleteEndedSession, { sessionId });
  const before = await viewer.query(api.trainingTargets.list, {});
  expect(before.find(goal => goal.title === 'Open')).toMatchObject({ status: 'completed' });
  const scheduled = await t.run(async ctx => {
    const jobs = await ctx.db.system.query('_scheduled_functions').collect();
    return jobs.map(job => job.name);
  });
  expect(scheduled).toContain('trainingTargets:refreshAfterSessionDeleted');

  await t.mutation(internal.trainingTargets.refreshAfterSessionDeleted, { profileId });
  const after = await viewer.query(api.trainingTargets.list, {});
  const byTitle = new Map(after.map(goal => [goal.title, goal]));
  const open = byTitle.get('Open');
  expect(open?.status).toBe('active');
  expect(open?.completionSource).toBeUndefined();
  expect(open?.verifiedSnapshot).toBeUndefined();
  expect(open?.progressSummary.current).toBe(0);
  expect(byTitle.get('By hand')).toMatchObject({ completionSource: 'manual', status: 'completed' });
  expect(byTitle.get('Still counting')?.status).toBe('active');
  expect(byTitle.get('Still counting')?.progressSummary.current).toBe(0);
  expect(byTitle.get('Still met')).toMatchObject({
    completionSource: 'verified',
    status: 'completed',
    verifiedSnapshot: { evidenceActivityLogIds: [keptId] },
  });
  const closed = byTitle.get('Window closed');
  expect(closed?.status).toBe('missed');
  expect(closed?.completionSource).toBeUndefined();
  expect(closed?.verifiedSnapshot).toBeUndefined();
});

test('deleting a workout removes its sets and leaves the conversation and other training', async () => {
  const { t, profileId, viewer } = await owner();
  const ids = await t.run(async ctx => {
    const exerciseCatalogId = await ctx.db.insert('exerciseCatalog', catalog('Bench press'));
    const sessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null, endedAt: 200, profileId, startedAt: 100, status: 'ended',
    });
    const otherSessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null, endedAt: 200, profileId, startedAt: 50, status: 'ended',
    });
    const exerciseId = await ctx.db.insert('liveSessionExercises', {
      addedAt: 100, exerciseCatalogId, exerciseClass: 'strength', exerciseName: 'Bench press',
      position: 0, profileId, recipeKey: 'standard_load', sessionId,
    });
    const otherExerciseId = await ctx.db.insert('liveSessionExercises', {
      addedAt: 50, exerciseCatalogId, exerciseClass: 'strength', exerciseName: 'Bench press',
      position: 0, profileId, recipeKey: 'standard_load', sessionId: otherSessionId,
    });
    await ctx.db.insert('activityLogs', {
      exerciseCatalogId, loggedAt: 120, metrics: { reps: 8 }, profileId, recipeKey: 'standard_load',
      sessionExerciseId: exerciseId, sessionId, setNumber: 1, source: 'live_session', warmup: false,
    });
    const otherLogId = await ctx.db.insert('activityLogs', {
      exerciseCatalogId, loggedAt: 80, metrics: { reps: 8 }, profileId, recipeKey: 'standard_load',
      sessionExerciseId: otherExerciseId, sessionId: otherSessionId, setNumber: 1, source: 'live_session', warmup: false,
    });
    const quickLogId = await ctx.db.insert('activityLogs', {
      exerciseCatalogId, loggedAt: 90, metrics: { reps: 5 }, profileId, recipeKey: 'standard_load',
      setNumber: 1, source: 'quick_log', warmup: false,
    });
    const threadId = await ctx.db.insert('reedThreads', {
      createdAt: 1, profileId, status: 'active', updatedAt: 1,
    });
    const messageId = await ctx.db.insert('reedMessages', {
      content: 'Kept', createdAt: 1, profileId, relatedSessionId: sessionId, role: 'assistant',
      source: 'typed', status: 'sent', threadId,
    });
    return { messageId, otherExerciseId, otherLogId, otherSessionId, quickLogId, sessionId };
  });

  await viewer.mutation(api.liveSessions.deleteEndedSession, { sessionId: ids.sessionId });

  const left = await t.run(async ctx => ({
    sessions: (await ctx.db.query('liveSessions').collect()).map(row => row._id),
    exercises: (await ctx.db.query('liveSessionExercises').collect()).map(row => row._id),
    logs: (await ctx.db.query('activityLogs').collect()).map(row => row._id),
    message: await ctx.db.get(ids.messageId),
    scheduled: (await ctx.db.system.query('_scheduled_functions').collect()).map(job => job.name),
  }));
  expect(left.sessions).toEqual([ids.otherSessionId]);
  expect(left.exercises).toEqual([ids.otherExerciseId]);
  expect(left.logs.sort()).toEqual([ids.otherLogId, ids.quickLogId].sort());
  expect(left.message?.content).toBe('Kept');
  expect(left.scheduled.sort()).toEqual([
    'profileInsight:markStale',
    'reedJourney:rebuildLatest',
    'trainingTargets:refreshAfterSessionDeleted',
  ]);
});

test('session deletion requires the owner and an ended session', async () => {
  const { t, profileId, viewer } = await owner();
  const { activeId, foreignId } = await t.run(async ctx => {
    const strangerId = await ctx.db.insert('profiles', {
      authUserId: 'test|stranger', email: 'stranger@example.test', updatedAt: 1,
    });
    const foreignId = await ctx.db.insert('liveSessions', {
      activeProcess: null, endedAt: 200, profileId: strangerId, startedAt: 100, status: 'ended',
    });
    const activeId = await ctx.db.insert('liveSessions', {
      activeProcess: null, profileId, startedAt: 100, status: 'active',
    });
    return { activeId, foreignId };
  });

  await expect(viewer.mutation(api.liveSessions.deleteEndedSession, { sessionId: foreignId })).rejects.toThrow();
  await expect(viewer.mutation(api.liveSessions.deleteEndedSession, { sessionId: activeId })).rejects.toThrow();
  await expect(t.mutation(api.liveSessions.deleteEndedSession, { sessionId: activeId })).rejects.toThrow();
  const left = await t.run(async ctx => ({
    active: await ctx.db.get(activeId),
    foreign: await ctx.db.get(foreignId),
    scheduled: await ctx.db.system.query('_scheduled_functions').collect(),
  }));
  expect(left.foreign?.status).toBe('ended');
  expect(left.active?.status).toBe('active');
  expect(left.scheduled).toEqual([]);
});

test('deleting a workout dismisses the plan that started it', async () => {
  const { t, profileId, viewer } = await owner();
  const { planId, sessionId } = await t.run(async ctx => {
    const threadId = await ctx.db.insert('reedThreads', {
      createdAt: 1, profileId, status: 'active', updatedAt: 1,
    });
    const sourceMessageId = await ctx.db.insert('reedMessages', {
      content: 'Legs', createdAt: 1, profileId, role: 'assistant', source: 'typed', status: 'sent', threadId,
    });
    const sessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null, endedAt: 200, profileId, startedAt: 100, status: 'ended',
    });
    const planId = await ctx.db.insert('plannedSessions', {
      createdAt: 1, creator: 'reed', exercises: [], liveSessionId: sessionId, profileId,
      revision: 1, sourceMessageId, status: 'started', title: 'Legs', updatedAt: 1,
    });
    await ctx.db.patch(sessionId, { sourcePlannedSessionId: planId });
    return { planId, sessionId };
  });

  await viewer.mutation(api.liveSessions.deleteEndedSession, { sessionId });
  const plan = await t.run(ctx => ctx.db.get(planId));
  expect(plan?.status).toBe('dismissed');
  expect(plan?.liveSessionId).toBeUndefined();
  expect(await t.run(ctx => ctx.db.get(sessionId))).toBeNull();
});

test('an oversized workout is refused before any record changes', async () => {
  const { t, profileId, viewer } = await owner();
  const sessionId = await t.run(async ctx => {
    const exerciseCatalogId = await ctx.db.insert('exerciseCatalog', catalog('Bench press'));
    const sessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null, endedAt: 200, profileId, startedAt: 100, status: 'ended',
    });
    for (let setNumber = 1; setNumber <= 2001; setNumber += 1) {
      await ctx.db.insert('activityLogs', {
        exerciseCatalogId, loggedAt: setNumber, metrics: { reps: 1 }, profileId, recipeKey: 'standard_load',
        sessionId, setNumber, source: 'live_session', warmup: false,
      });
    }
    return sessionId;
  });

  await expect(viewer.mutation(api.liveSessions.deleteEndedSession, { sessionId })).rejects.toThrow(/too large/);
  const left = await t.run(async ctx => ({
    logs: (await ctx.db.query('activityLogs').collect()).length,
    session: await ctx.db.get(sessionId),
  }));
  expect(left.session?.status).toBe('ended');
  expect(left.logs).toBe(2001);
});

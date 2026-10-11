/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function owner() {
  const t = convexTest(schema, modules);
  const profileId = await t.run(ctx => ctx.db.insert('profiles', {
    authUserId: 'test|owner',
    email: 'owner@example.test',
    updatedAt: 1,
  }));
  return { t, profileId, viewer: t.withIdentity({ tokenIdentifier: 'test|owner', email: 'owner@example.test' }) };
}

function catalog(name: string, equipment: string[]) {
  return {
    aliases: [] as string[],
    canonicalFamily: 'bench_press',
    contextTags: [] as string[],
    equipment,
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

async function queuedWorkout() {
  const fixture = await owner();
  const ids = await fixture.t.run(async ctx => {
    const first = await ctx.db.insert('exerciseCatalog', catalog('First press', ['barbell']));
    const second = await ctx.db.insert('exerciseCatalog', catalog('Second press', ['dumbbell']));
    return [first, second];
  });
  const { sessionExerciseIds } = await fixture.viewer.mutation(api.liveSessions.addExercises, { exerciseCatalogIds: ids });
  const exercise = await fixture.t.run(ctx => ctx.db.get(sessionExerciseIds[0]));
  return { ...fixture, sessionExerciseIds, sessionId: exercise!.sessionId };
}

test('branching log selects the next queued exercise atomically without creating rest', async () => {
  const { t, viewer, sessionId, sessionExerciseIds } = await queuedWorkout();
  const committed = await viewer.mutation(api.liveSessions.logSet, {
    sessionExerciseId: sessionExerciseIds[0], metrics: { load: 25, reps: 8, rpe: 8 }, warmup: false, afterSet: 'nextExercise',
  });
  expect(committed.enteredRest).toBe(false);
  expect(committed.nextSessionExerciseId).toBe(sessionExerciseIds[1]);
  const { session, log } = await t.run(async ctx => ({ session: await ctx.db.get(sessionId), log: await ctx.db.get(committed.setLogId) }));
  expect(session!.activeSessionExerciseId).toBe(sessionExerciseIds[1]);
  expect(session!.activeProcess).toBeNull();
  expect(log!.metrics).toEqual({ load: 25, reps: 8, rpe: 8 });
  expect(log!.restSeconds).toBeUndefined();
});

test('last exercise branch saves once and returns no destination for the picker', async () => {
  const { t, viewer, sessionId, sessionExerciseIds } = await queuedWorkout();
  const committed = await viewer.mutation(api.liveSessions.logSet, {
    sessionExerciseId: sessionExerciseIds[1], metrics: { load: 10, reps: 9, rpe: 8 }, warmup: true, afterSet: 'nextExercise',
  });
  expect(committed.nextSessionExerciseId).toBeNull();
  expect(committed.enteredRest).toBe(false);
  const session = await t.run(ctx => ctx.db.get(sessionId));
  expect(session!.activeSessionExerciseId).toBe(sessionExerciseIds[1]);
  expect(session!.activeProcess).toBeNull();
  const logs = await t.run(ctx => ctx.db.query('activityLogs').withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', sessionExerciseIds[1])).collect());
  expect(logs).toHaveLength(1);
  expect(logs[0].warmup).toBe(true);
  expect(committed.nextSetNumber).toBe(2);
});

test.each([undefined, 'rest'] as const)('another-set log preserves automatic rest (%s)', async afterSet => {
  const { t, viewer, sessionId, sessionExerciseIds } = await queuedWorkout();
  const committed = await viewer.mutation(api.liveSessions.logSet, {
    sessionExerciseId: sessionExerciseIds[0], metrics: { load: 10, reps: 8, rpe: 8 }, warmup: false, ...(afterSet ? { afterSet } : {}),
  });
  expect(committed.enteredRest).toBe(true);
  expect(committed.nextSessionExerciseId).toBeNull();
  const session = await t.run(ctx => ctx.db.get(sessionId));
  expect(session!.activeSessionExerciseId).toBe(sessionExerciseIds[0]);
  expect(session!.activeProcess).toMatchObject({ kind: 'rest', isRunning: true, sessionExerciseId: sessionExerciseIds[0], nextSetNumber: 2 });
});

test('branching log resolves a removed next exercise from the current queue', async () => {
  const { t, viewer, sessionId, sessionExerciseIds } = await queuedWorkout();
  await t.run(ctx => ctx.db.delete(sessionExerciseIds[1]));
  const committed = await viewer.mutation(api.liveSessions.logSet, {
    sessionExerciseId: sessionExerciseIds[0], metrics: { load: 10, reps: 8, rpe: 8 }, warmup: false, afterSet: 'nextExercise',
  });
  expect(committed.nextSessionExerciseId).toBeNull();
  expect((await t.run(ctx => ctx.db.get(sessionId)))!.activeProcess).toBeNull();
});

test('foreign exercise cannot be logged or change the active destination', async () => {
  const { t, sessionId, sessionExerciseIds } = await queuedWorkout();
  await t.run(ctx => ctx.db.insert('profiles', { authUserId: 'test|intruder', email: 'intruder@example.test', updatedAt: 1 }));
  const intruder = t.withIdentity({ tokenIdentifier: 'test|intruder', email: 'intruder@example.test' });
  await intruder.mutation(api.liveSessions.start, {});
  await expect(intruder.mutation(api.liveSessions.logSet, {
    sessionExerciseId: sessionExerciseIds[0], metrics: { load: 10, reps: 8, rpe: 8 }, warmup: false, afterSet: 'nextExercise',
  })).rejects.toThrow();
  expect((await t.run(ctx => ctx.db.get(sessionId)))!.activeProcess).toBeNull();
  expect(await t.run(ctx => ctx.db.query('activityLogs').collect())).toHaveLength(0);
});

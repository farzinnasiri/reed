import assert from 'node:assert/strict';
import test from 'node:test';
import type { Doc, Id } from '../convex/_generated/dataModel';
import { buildCurrentLiveSessionState, getNextSessionSetNumber, resolveCurrentSessionExercise } from '../convex/workout/sessionState';
import { addExercise, addExercises, selectExercise } from '../convex/workout/sessions';
import { getRestDeadline } from '../domains/workout/rest';
import { fixture, handler } from './helpers/session-fixture';

const first = { _id: 'first' as Id<'liveSessionExercises'> };
const selected = { _id: 'selected' as Id<'liveSessionExercises'> };
const cardio = { _id: 'cardio' as Id<'liveSessionExercises'> };
const session = {
  _id: 'session' as Id<'liveSessions'>, _creationTime: 0, profileId: 'profile' as Id<'profiles'>,
  status: 'active' as const, startedAt: 0, activeProcess: null,
} satisfies Doc<'liveSessions'>;

test('live status and workout state share empty, selected, fallback and live-cardio selection', () => {
  assert.equal(resolveCurrentSessionExercise(session, []), null);
  assert.equal(resolveCurrentSessionExercise(session, [first, selected, cardio]), first);
  assert.equal(resolveCurrentSessionExercise({ ...session, activeSessionExerciseId: selected._id }, [first, selected, cardio]), selected);
  assert.equal(resolveCurrentSessionExercise({ ...session, activeSessionExerciseId: selected._id }, [first]), first);
  assert.equal(resolveCurrentSessionExercise({ ...session, activeSessionExerciseId: selected._id, activeProcess: {
    kind: 'live_cardio', sessionExerciseId: cardio._id, recipeKey: 'cardio_live_duration_distance',
    elapsedSeconds: 0, isRunning: true, lastResumedAt: 0, startedAt: 0, trackedMetrics: {},
  } }, [first, selected, cardio]), cardio);
});

test('status numbering matches capture for warm-ups, unilateral pairs, edits and deletion', () => {
  const exercise = {
    ...first, _creationTime: 0, sessionId: session._id, profileId: session.profileId,
    exerciseCatalogId: 'catalog' as Id<'exerciseCatalog'>, position: 0, addedAt: 0,
    exerciseName: 'Unilateral exercise', exerciseClass: 'strength', recipeKey: 'unilateral_reps_pair' as const,
  } satisfies Doc<'liveSessionExercises'>;
  const makeLog = (id: string, warmup: boolean, setNumber: number): Doc<'activityLogs'> => ({
    _id: id as Id<'activityLogs'>, _creationTime: 0, profileId: session.profileId, sessionId: session._id,
    sessionExerciseId: exercise._id, exerciseCatalogId: exercise.exerciseCatalogId, loggedAt: 0,
    recipeKey: exercise.recipeKey, metrics: { leftReps: 8, rightReps: 7, rpe: 8 },
    source: 'live_session', warmup, setNumber,
  });
  const warmup = makeLog('warmup', true, 1);
  const pair = makeLog('pair', false, 2);
  const editedPair = { ...pair, metrics: { leftReps: 10, rightReps: 9, rpe: 7 }, warmup: true };
  const scenarios = [
    { logs: [], expected: 1 },
    { logs: [warmup], expected: 2 },
    { logs: [warmup, pair], expected: 3 },
    { logs: [warmup, editedPair], expected: 3 },
    { logs: [{ ...pair, setNumber: 1 }], expected: 2 },
  ];
  for (const { logs, expected } of scenarios) {
    const state = buildCurrentLiveSessionState({ session, sessionExercises: [exercise], logsByExercise: new Map([[exercise._id, logs]]) });
    assert.equal(state.activeCard.capture?.currentSetNumber, expected);
    assert.equal(getNextSessionSetNumber(logs), state.activeCard.capture?.currentSetNumber);
  }
});

test('server rest projection and client countdown subtract elapsed time only once', async () => {
  const { getRestSnapshot, getRestDeadline } = await import('../domains/workout/rest');
  const now = Date.now();
  const exercise = {
    ...first, _creationTime: 0, sessionId: session._id, profileId: session.profileId,
    exerciseCatalogId: 'catalog' as Id<'exerciseCatalog'>, position: 0, addedAt: 0,
    exerciseName: 'Squat', exerciseClass: 'strength', recipeKey: 'standard_load' as const,
  } satisfies Doc<'liveSessionExercises'>;
  const state = buildCurrentLiveSessionState({
    session: { ...session, activeProcess: { kind: 'rest', durationSeconds: 60, remainingSeconds: 60,
      startedAt: now - 20_000, isRunning: true, sessionExerciseId: first._id, nextSetNumber: 2 } },
    sessionExercises: [exercise], logsByExercise: new Map(),
  });
  assert.ok(state.restRuntime);
  assert.equal(getRestSnapshot(state.restRuntime, now).remainingSeconds, 40);
  assert.equal(getRestDeadline(state.restRuntime), now + 40_000);
});

test('moving to queued or newly added exercises preserves rest and returning restores its card', async () => {
  for (const destination of ['queued', 'single', 'bulk'] as const) {
    const exercise = {
      ...first, _creationTime: 0, sessionId: session._id, profileId: session.profileId,
      exerciseCatalogId: 'catalog' as Id<'exerciseCatalog'>, position: 0, addedAt: 0,
      exerciseName: 'Squat', exerciseClass: 'strength', recipeKey: 'standard_load' as const,
    } satisfies Doc<'liveSessionExercises'>;
    const rest = { kind: 'rest' as const, sessionExerciseId: first._id, durationSeconds: 90,
      remainingSeconds: 90, startedAt: Date.now(), isRunning: true, nextSetNumber: 4 };
    const f = fixture({
      liveSessions: [{ ...session, activeSessionExerciseId: first._id, activeProcess: rest }],
      liveSessionExercises: [exercise, ...(destination === 'queued' ? [{ ...exercise,
        _id: selected._id, position: 1, exerciseName: 'Bench' }] : [])],
      exerciseCatalog: ['bench', 'row'].map(id => ({ _id: id, name: id,
        exerciseClass: 'strength', recipeKey: 'standard_load', rawMetricRecipe: '', isCardio: false,
        isHold: false, supportsLiveTracking: false, equipment: [], mainMuscleGroups: [] })),
    });
    let nextId = selected._id;
    if (destination === 'single') {
      nextId = (await handler(addExercise)(f.ctx, {
        exerciseCatalogId: 'bench' as Id<'exerciseCatalog'>,
      })).sessionExerciseId;
    } else if (destination === 'bulk') {
      const added = await handler(addExercises)(f.ctx, {
        exerciseCatalogIds: ['bench', 'row'] as Id<'exerciseCatalog'>[],
      });
      nextId = added.sessionExerciseIds[0];
      assert.equal(added.sessionExerciseIds.length, 2);
    }
    await handler(selectExercise)(f.ctx, { sessionExerciseId: nextId });
    const current = await f.ctx.db.get(session._id);
    assert.ok(current);
    assert.ok(current.status === 'active');
    assert.deepEqual(current.activeProcess, rest);
    const rows = await f.ctx.db.query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id)).collect();
    const exercises = rows.map(row => {
      assert.ok(row.recipeKey);
      return { ...row, recipeKey: row.recipeKey };
    });
    const state = buildCurrentLiveSessionState({ session: { ...current, status: current.status }, sessionExercises: exercises, logsByExercise: new Map() });
    assert.equal(state.activeCard.capture?.sessionExerciseId, nextId);
    assert.equal(state.activeCard.capture?.currentSetNumber, 1);
    assert.equal(getRestDeadline(state.restRuntime!), getRestDeadline(rest));
    await handler(selectExercise)(f.ctx, { sessionExerciseId: first._id });
    const returned = await f.ctx.db.get(session._id);
    assert.ok(returned);
    assert.ok(returned.status === 'active');
    const back = buildCurrentLiveSessionState({ session: { ...returned, status: returned.status }, sessionExercises: exercises, logsByExercise: new Map() });
    assert.equal(back.cardMode, 'rest');
    assert.equal(back.activeCard.rest?.sessionExerciseId, first._id);
    assert.equal(getRestDeadline(back.restRuntime!), getRestDeadline(rest));
  }
});

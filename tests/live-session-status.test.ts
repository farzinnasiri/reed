import assert from 'node:assert/strict';
import test from 'node:test';
import type { Doc, Id } from '../convex/_generated/dataModel';
import { buildCurrentLiveSessionState, getNextSessionSetNumber, resolveCurrentSessionExercise } from '../convex/workout/sessionState';

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

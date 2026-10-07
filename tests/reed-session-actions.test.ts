import { onboardingAnswers } from './helpers/onboarding-fixture';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Doc, Id } from '../convex/_generated/dataModel';
import { fixture, handler } from './helpers/session-fixture';
import {
  confirmSessionAction,
  rejectSessionAction,
  getSessionAction,
  prepareSessionAction,
  saveSessionAction,
} from '../convex/reedSessionActions';
import {
  logSet,
  updateSet,
  deleteSet,
  selectExercise,
  startLiveCardio,
  pauseLiveCardio,
  resumeLiveCardio,
  adjustLiveCardioMetric,
  reorderExercises,
  addExercise,
  endRest,
  updateRestProcess,
} from '../convex/workout/sessions';
import { sanitizeReedWidget } from '../convex/reedWidgets';

const actionId = 'action' as Id<'reedSessionActions'>;
function swapFixture() {
  process.env.REED_SESSION_ACTOR_PROFILE_IDS = 'profile';
  return fixture({
    trainingProfiles: [
      {
        _id: 'training',
        profileId: 'profile',
        onboarding: onboardingAnswers(),
      },
    ],
    liveSessions: [
      {
        _id: 'session',
        profileId: 'profile',
        status: 'active',
        structureRevision: 3,
        activeProcess: null,
        activeSessionExerciseId: 'entry',
      },
    ],
    liveSessionExercises: [
      {
        _id: 'entry',
        sessionId: 'session',
        profileId: 'profile',
        exerciseCatalogId: 'old',
        exerciseName: 'Bench',
        exerciseClass: 'strength',
        position: 1,
        recipeKey: 'standard_load',
      },
    ],
    exerciseCatalog: ['old', 'new'].map((id) => ({
      _id: id,
      name: id,
      exerciseClass: 'strength',
      recipeKey: 'standard_load',
      rawMetricRecipe: '',
      isSupportedInLiveSession: true,
      isCardio: false,
      isHold: false,
      supportsLiveTracking: false,
      equipment: [],
      jointsEmphasized: [],
      mainMuscleGroups: [],
      movementPatterns: [],
    })),
    reedSessionActions: [
      {
        _id: 'action',
        _creationTime: 0,
        profileId: 'profile',
        sessionId: 'session',
        sourceMessageId: 'assistant',
        operation: 'swap',
        sessionExerciseId: 'entry',
        previousCatalogId: 'old',
        replacementCatalogId: 'new',
        expectedRevision: 3,
        targets: [{ metrics: { load: 20, reps: 8, rpe: 8 }, restSeconds: 60 }],
        rationale: 'Use dumbbells',
        status: 'pending',
        expiresAt: Date.now() + 300000,
        createdAt: Date.now(),
        modelContractVersion: 'reed-session-swap-v1',
      },
    ],
  });
}
test('a proposal changes nothing; explicit confirmation applies one position-preserving swap once with atomic audit', async () => {
  const f = swapFixture();
  f.tables.reedSessionActions = [];
  const user = {
    _id: 'user',
    profileId: 'profile',
    threadId: 'thread',
    role: 'user',
    content: 'Swap bench for dumbbells',
  } as Doc<'reedMessages'>;
  const assistant = {
    _id: 'assistant',
    profileId: 'profile',
    threadId: 'thread',
    role: 'assistant',
    source: 'typed',
  } as Doc<'reedMessages'>;
  const prepared = await prepareSessionAction(
    f.ctx,
    'profile' as Id<'profiles'>,
    {
      operation: 'swap',
      sessionId: 'session',
      sessionExerciseId: 'entry',
      replacementCatalogId: 'new',
      expectedRevision: 3,
      setCount: 2,
      restSeconds: 60,
      rationale: 'Use dumbbells',
    },
    user,
    assistant,
  );
  assert.ok(prepared);
  const id = await saveSessionAction(f.ctx, 'profile' as Id<'profiles'>, assistant._id, prepared);
  assert.equal(f.tables.liveSessionExercises[0].exerciseCatalogId, 'old');
  assert.equal(f.tables.liveSessions[0].structureRevision, 3);
  const args = { actionId: id };
  const first = await handler(confirmSessionAction)(f.ctx, args);
  const writes = f.writes.length;
  assert.deepEqual(await handler(confirmSessionAction)(f.ctx, args), first);
  assert.equal(f.writes.length, writes);
  assert.equal(first.status, 'applied');
  assert.equal(f.tables.liveSessionExercises[0]._id, 'entry');
  assert.equal(f.tables.liveSessionExercises[0].position, 1);
  assert.equal(f.tables.liveSessions[0].activeSessionExerciseId, 'entry');
  const audit = f.tables.reedSessionActions[0].audit as {
    actualRevision: number;
    resultingRevision: number;
    before: { exerciseCatalogId: string };
    after: { exerciseCatalogId: string };
  };
  assert.equal(audit.actualRevision, 3);
  assert.equal(audit.resultingRevision, 4);
  assert.equal(audit.before.exerciseCatalogId, 'old');
  assert.equal(audit.after.exerciseCatalogId, 'new');
  assert.equal(f.tables.activityLogs?.length ?? 0, 0);
});
test('stale, logged, timed, ended, unavailable and expired proposals preserve exercises/activity/timers', async () => {
  for (const kind of ['stale', 'logged', 'rest', 'cardio', 'ended', 'missing', 'expired']) {
    const f = swapFixture();
    if (kind === 'stale') f.tables.liveSessions[0].structureRevision = 4;
    if (kind === 'logged')
      f.tables.activityLogs = [
        { _id: 'performed', sessionExerciseId: 'entry', metrics: { load: 20 }, setNumber: 1 },
      ];
    if (kind === 'rest' || kind === 'cardio')
      f.tables.liveSessions[0].activeProcess = {
        kind: kind === 'rest' ? 'rest' : 'live_cardio',
        sessionExerciseId: 'entry',
        startedAt: 100,
      };
    if (kind === 'ended') f.tables.liveSessions[0].status = 'ended';
    if (kind === 'missing')
      f.tables.exerciseCatalog = f.tables.exerciseCatalog.filter((x) => x._id !== 'new');
    if (kind === 'expired') f.tables.reedSessionActions[0].expiresAt = Date.now() - 1;
    const before = JSON.stringify([
      f.tables.liveSessions,
      f.tables.liveSessionExercises,
      f.tables.activityLogs,
    ]);
    const result = await handler(confirmSessionAction)(f.ctx, { actionId });
    assert.equal(result.status, kind === 'expired' ? 'expired' : 'rejected');
    assert.equal(
      JSON.stringify([f.tables.liveSessions, f.tables.liveSessionExercises, f.tables.activityLogs]),
      before,
    );
    assert.equal(f.tables.reedSessionActions[0].audit, undefined);
    assert.deepEqual(await handler(confirmSessionAction)(f.ctx, { actionId }), result);
  }
});
test('auth, ownership and server Actor permission are enforced; rejection and read expiry never change sessions', async () => {
  const f = swapFixture();
  process.env.REED_SESSION_ACTOR_PROFILE_IDS = '';
  await assert.rejects(() => handler(confirmSessionAction)(f.ctx, { actionId }), /not enabled/);
  assert.equal((await handler(getSessionAction)(f.ctx, { actionId }))?.canConfirm, false);
  process.env.REED_SESSION_ACTOR_PROFILE_IDS = 'profile';
  f.tables.reedSessionActions[0].profileId = 'foreign';
  await assert.rejects(() => handler(confirmSessionAction)(f.ctx, { actionId }), /not found/);
  assert.equal(await handler(getSessionAction)(f.ctx, { actionId }), null);
  f.tables.reedSessionActions[0].profileId = 'profile';
  const before = JSON.stringify(f.tables.liveSessions);
  assert.equal((await handler(rejectSessionAction)(f.ctx, { actionId })).status, 'rejected');
  assert.equal((await handler(confirmSessionAction)(f.ctx, { actionId })).status, 'rejected');
  assert.equal(JSON.stringify(f.tables.liveSessions), before);
  f.signOut();
  await assert.rejects(() => handler(confirmSessionAction)(f.ctx, { actionId }));
  const e = swapFixture();
  e.tables.reedSessionActions[0].expiresAt = Date.now() - 1;
  assert.equal((await handler(getSessionAction)(e.ctx, { actionId }))?.status, 'expired');
  assert.equal(e.writes.length, 0);
});
test('session_change references are owned, and generic yes/background messages cannot propose or apply swaps', async () => {
  const f = swapFixture();
  const facts = {
    profileId: 'profile',
    session: null,
    enabledPresetKeys: [],
    action: { _id: 'action', profileId: 'profile' },
  };
  assert.deepEqual(sanitizeReedWidget({ kind: 'session_change', actionId: 'action' }, facts), {
    kind: 'session_change',
    actionId: 'action',
  });
  assert.equal(
    sanitizeReedWidget(
      { kind: 'session_change', actionId: 'action' },
      { ...facts, action: { _id: 'action', profileId: 'foreign' } },
    ),
    undefined,
  );
  const user = {
    _id: 'user',
    profileId: 'profile',
    threadId: 'thread',
    role: 'user',
    content: 'yes',
  } as Doc<'reedMessages'>;
  const assistant = {
    _id: 'assistant',
    threadId: 'thread',
    source: 'typed',
  } as Doc<'reedMessages'>;
  const raw = {
    operation: 'swap',
    sessionId: 'session',
    sessionExerciseId: 'entry',
    replacementCatalogId: 'new',
    expectedRevision: 3,
    setCount: 1,
    restSeconds: 60,
    rationale: 'test',
  };
  assert.equal(
    await prepareSessionAction(f.ctx, 'profile' as Id<'profiles'>, raw, user, assistant),
    null,
  );
  assert.equal(
    await prepareSessionAction(
      f.ctx,
      'profile' as Id<'profiles'>,
      raw,
      { ...user, content: 'swap bench' },
      { ...assistant, source: 'background_coach' },
    ),
    null,
  );
  assert.equal(f.writes.length, 0);
});
test('direct selection, reorder, add and timer controls increment the revision and invalidate old proposals', async () => {
  const selected = swapFixture();
  await handler(selectExercise)(selected.ctx, {
    sessionExerciseId: 'entry' as Id<'liveSessionExercises'>,
  });
  assert.equal(selected.tables.liveSessions[0].structureRevision, 4);
  assert.equal(
    (await handler(confirmSessionAction)(selected.ctx, { actionId })).reason,
    'session_changed',
  );
  const reordered = swapFixture();
  await handler(reorderExercises)(reordered.ctx, {
    orderedSessionExerciseIds: ['entry' as Id<'liveSessionExercises'>],
  });
  assert.equal(reordered.tables.liveSessions[0].structureRevision, 4);
  const added = swapFixture();
  await handler(addExercise)(added.ctx, { exerciseCatalogId: 'new' as Id<'exerciseCatalog'> });
  assert.equal(added.tables.liveSessions[0].structureRevision, 4);
  for (const operation of ['end', 'duration', 'pause', 'resume', 'metric']) {
    const f = swapFixture();
    f.tables.liveSessions[0].activeProcess =
      operation === 'end' || operation === 'duration'
        ? {
            kind: 'rest',
            sessionExerciseId: 'entry',
            durationSeconds: 90,
            remainingSeconds: 90,
            isRunning: false,
            startedAt: null,
            nextSetNumber: 1,
          }
        : {
            kind: 'live_cardio',
            sessionExerciseId: 'entry',
            recipeKey: 'cardio_live_duration_distance',
            elapsedSeconds: 10,
            isRunning: operation === 'pause',
            lastResumedAt: operation === 'pause' ? Date.now() : null,
            startedAt: Date.now(),
            trackedMetrics: { distance: 1 },
          };
    if (operation === 'end') await handler(endRest)(f.ctx, {});
    if (operation === 'duration')
      await handler(updateRestProcess)(f.ctx, { mode: 'setDuration', durationSeconds: 60 });
    if (operation === 'pause') await handler(pauseLiveCardio)(f.ctx, {});
    if (operation === 'resume') await handler(resumeLiveCardio)(f.ctx, {});
    if (operation === 'metric')
      await handler(adjustLiveCardioMetric)(f.ctx, { key: 'distance', delta: 1 });
    assert.equal(f.tables.liveSessions[0].structureRevision, 4);
  }
});

test('logging, editing and deleting a set all invalidate a proposal even after the exercise is unlogged again', async () => {
  const f = swapFixture();
  await handler(logSet)(f.ctx, {
    sessionExerciseId: 'entry' as Id<'liveSessionExercises'>,
    metrics: { load: 20, reps: 8, rpe: 8 },
    warmup: false,
  });
  assert.equal(f.tables.liveSessions[0].structureRevision, 4);
  const setLogId = f.tables.activityLogs[0]._id as Id<'activityLogs'>;
  await handler(updateSet)(f.ctx, {
    setLogId,
    metrics: { load: 22, reps: 8, rpe: 8 },
    warmup: false,
  });
  assert.equal(f.tables.liveSessions[0].structureRevision, 5);
  await handler(deleteSet)(f.ctx, { setLogId });
  assert.equal(f.tables.liveSessions[0].structureRevision, 6);
  assert.equal(f.tables.activityLogs.length, 0);
  assert.equal(
    (await handler(confirmSessionAction)(f.ctx, { actionId })).reason,
    'session_changed',
  );
});

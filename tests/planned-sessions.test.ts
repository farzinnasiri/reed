import { onboardingAnswers } from './helpers/onboarding-fixture';
import { completeAssistantMessage } from '../convex/reed';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Doc, Id } from '../convex/_generated/dataModel';
import {
  startPlannedSession,
  dismissPlannedSession,
  getPlannedSession,
  prepareChatPlan,
  saveChatPlan,
} from '../convex/plannedSessions';
import { finishSession, selectExercise, startLiveCardio } from '../convex/workout/sessions';
import { buildCurrentLiveSessionState } from '../convex/workout/sessionState';
import { sanitizeReedWidget } from '../convex/reedWidgets';
import { fixture, handler } from './helpers/session-fixture';

const targets = [
  { metrics: { load: 20, reps: 8, rpe: 8 }, restSeconds: 60 },
  { metrics: { load: 20, reps: 6, rpe: 8 }, restSeconds: 60 },
];
function planningFixture() {
  return fixture({
    trainingProfiles: [
      {
        _id: 'training',
        profileId: 'profile',
        onboarding: onboardingAnswers(),
      },
    ],
    exerciseCatalog: [
      {
        _id: 'exercise',
        name: 'Weighted push-up',
        isSupportedInLiveSession: true,
        recipeKey: 'standard_load',
        rawMetricRecipe: '',
        supportsLiveTracking: false,
        exerciseClass: 'strength',
        equipment: ['bodyweight'],
        jointsEmphasized: ['shoulder'],
        mainMuscleGroups: ['chest'],
        movementPatterns: ['push'],
        isCardio: false,
        isHold: false,
      },
    ],
    plannedSessions: [
      {
        _id: 'plan',
        profileId: 'profile',
        status: 'ready',
        title: 'Upper body',
        revision: 1,
        exercises: [{ exerciseCatalogId: 'exercise', targets }],
        createdAt: 0,
        updatedAt: 0,
      },
    ],
  });
}
test('a plan starts once, has guidance but zero performed work, and repeated starts are idempotent', async () => {
  const f = planningFixture();
  const args = { plannedSessionId: 'plan' as Id<'plannedSessions'>, expectedRevision: 1 };
  const first = await handler(startPlannedSession)(f.ctx, args);
  const again = await handler(startPlannedSession)(f.ctx, args);
  assert.deepEqual(first, again);
  assert.equal(f.tables.liveSessions.length, 1);
  assert.equal(f.tables.liveSessionExercises.length, 1);
  assert.equal(f.tables.activityLogs?.length ?? 0, 0);
  assert.deepEqual(f.tables.liveSessionExercises[0].targetDefaults, targets);
  const state = buildCurrentLiveSessionState({
    session: f.tables.liveSessions[0] as unknown as Doc<'liveSessions'> & { status: 'active' },
    sessionExercises: f.tables.liveSessionExercises as unknown as (Doc<'liveSessionExercises'> & {
      recipeKey: 'standard_load';
    })[],
    logsByExercise: new Map(),
  });
  assert.deepEqual(state.activeCard.capture?.initialMetrics, targets[0].metrics);
  assert.equal(state.activeCard.capture?.previousMetrics, null);
  const log = {
    _id: 'log',
    metrics: { load: 25, reps: 10, rpe: 8 },
    recipeKey: 'standard_load',
  } as unknown as Doc<'activityLogs'>;
  const next = buildCurrentLiveSessionState({
    session: f.tables.liveSessions[0] as unknown as Doc<'liveSessions'> & { status: 'active' },
    sessionExercises: f.tables.liveSessionExercises as unknown as (Doc<'liveSessionExercises'> & {
      recipeKey: 'standard_load';
    })[],
    logsByExercise: new Map([
      [f.tables.liveSessionExercises[0]._id as Id<'liveSessionExercises'>, [log]],
    ]),
  });
  assert.deepEqual(next.activeCard.capture?.initialMetrics, targets[1].metrics);
  assert.deepEqual(next.activeCard.capture?.previousMetrics, log.metrics);
});
test('stale revision, foreign ownership and unavailable catalog fail before any start writes', async () => {
  for (const kind of [
    'stale',
    'foreign',
    'missing',
    'unsupported',
    'constraint',
    'equipment',
    'invalid_targets',
  ]) {
    const f = planningFixture();
    if (kind === 'foreign') f.tables.plannedSessions[0].profileId = 'foreign';
    if (kind === 'missing') f.tables.exerciseCatalog = [];
    if (kind === 'unsupported') f.tables.exerciseCatalog[0].isSupportedInLiveSession = false;
    if (kind === 'constraint')
      (f.tables.trainingProfiles[0].onboarding as ReturnType<typeof onboardingAnswers>).discomfort = [{ regionId: 'left_shoulder', intensity: 2 }];
    if (kind === 'equipment') f.tables.exerciseCatalog[0].equipment = ['barbell'];
    if (kind === 'invalid_targets')
      f.tables.plannedSessions[0].exercises = [
        {
          exerciseCatalogId: 'exercise',
          targets: [{ metrics: { load: Infinity, reps: 8, rpe: 8 }, restSeconds: 60 }],
        },
      ];
    await assert.rejects(() =>
      handler(startPlannedSession)(f.ctx, {
        plannedSessionId: 'plan' as Id<'plannedSessions'>,
        expectedRevision: kind === 'stale' ? 2 : 1,
      }),
    );
    assert.equal(f.writes.length, 0);
    assert.equal(f.tables.plannedSessions[0].status, 'ready');
  }
});
test('active session conflict returns Continue current session without changing either session', async () => {
  const f = planningFixture();
  f.tables.liveSessions = [
    { _id: 'current', profileId: 'profile', status: 'active', activeProcess: null },
  ];
  assert.deepEqual(
    await handler(startPlannedSession)(f.ctx, {
      plannedSessionId: 'plan' as Id<'plannedSessions'>,
      expectedRevision: 1,
    }),
    { state: 'continue_current', sessionId: 'current' },
  );
  assert.equal(f.writes.length, 0);
});
test('finishing an untouched planned session deletes the live session and returns the plan to ready', async () => {
  const f = planningFixture();
  await handler(startPlannedSession)(f.ctx, {
    plannedSessionId: 'plan' as Id<'plannedSessions'>,
    expectedRevision: 1,
  });
  assert.deepEqual(await handler(finishSession)(f.ctx, {}), { deletedEmptySession: true });
  assert.equal(f.tables.liveSessions.length, 0);
  assert.equal(f.tables.liveSessionExercises.length, 0);
  assert.equal(f.tables.plannedSessions[0].status, 'ready');
  assert.equal(f.tables.plannedSessions[0].liveSessionId, undefined);
});
test('owned plan read, dismissal and widget sanitation reject unknown/foreign/dismissed references', async () => {
  const f = planningFixture();
  assert.equal(
    (await handler(getPlannedSession)(f.ctx, { plannedSessionId: 'plan' as Id<'plannedSessions'> }))
      ?.estimatedDurationMinutes,
    2,
  );
  const facts = {
    profileId: 'profile',
    session: null,
    enabledPresetKeys: [],
    plan: { _id: 'plan', profileId: 'profile', status: 'ready' },
  };
  assert.deepEqual(sanitizeReedWidget({ kind: 'plan', plannedSessionId: 'plan' }, facts), {
    kind: 'plan',
    plannedSessionId: 'plan',
  });
  for (const plan of [
    null,
    { ...facts.plan, profileId: 'foreign' },
    { ...facts.plan, status: 'dismissed' },
  ])
    assert.equal(
      sanitizeReedWidget({ kind: 'plan', plannedSessionId: 'plan' }, { ...facts, plan }),
      undefined,
    );
  await handler(dismissPlannedSession)(f.ctx, {
    plannedSessionId: 'plan' as Id<'plannedSessions'>,
  });
  assert.equal(
    await handler(getPlannedSession)(f.ctx, { plannedSessionId: 'plan' as Id<'plannedSessions'> }),
    null,
  );
  f.signOut();
  await assert.rejects(() =>
    handler(startPlannedSession)(f.ctx, {
      plannedSessionId: 'plan' as Id<'plannedSessions'>,
      expectedRevision: 1,
    }),
  );
});
test('chat creates or revises only valid requested plans and derives targets from prior performance', async () => {
  const f = planningFixture();
  f.tables.activityLogs = [
    {
      _id: 'prior',
      profileId: 'profile',
      exerciseCatalogId: 'exercise',
      loggedAt: 1,
      recipeKey: 'standard_load',
      metrics: { load: 30, reps: 10, rpe: 7 },
      warmup: false,
    },
  ];
  const user = {
    _id: 'user',
    role: 'user',
    profileId: 'profile',
    threadId: 'thread',
    content: 'Make my plan shorter',
  } as Doc<'reedMessages'>;
  const assistant = {
    _id: 'assistant',
    role: 'assistant',
    profileId: 'profile',
    threadId: 'thread',
    source: 'typed',
  } as Doc<'reedMessages'>;
  const raw = {
    title: 'Short session',
    plannedSessionId: 'plan',
    expectedRevision: 1,
    exercises: [{ exerciseCatalogId: 'exercise', setCount: 1, restSeconds: 60 }],
  };
  const prepared = await prepareChatPlan(f.ctx, 'profile' as Id<'profiles'>, raw, user, assistant);
  assert.ok(prepared);
  const id = await saveChatPlan(f.ctx, 'profile' as Id<'profiles'>, assistant._id, prepared);
  assert.equal(id, 'plan');
  assert.equal(f.tables.plannedSessions[0].revision, 2);
  assert.deepEqual(prepared.exercises[0].targets[0].metrics, { load: 30, reps: 10, rpe: 7 });
  assert.equal(
    await prepareChatPlan(f.ctx, 'profile' as Id<'profiles'>, raw, user, assistant),
    null,
  );
  assert.equal(
    await prepareChatPlan(
      f.ctx,
      'profile' as Id<'profiles'>,
      { ...raw, expectedRevision: 2 },
      { ...user, content: 'hello' },
      assistant,
    ),
    null,
  );
  assert.equal(
    await prepareChatPlan(
      f.ctx,
      'profile' as Id<'profiles'>,
      {
        ...raw,
        expectedRevision: 2,
        exercises: [{ exerciseCatalogId: 'missing', setCount: 1, restSeconds: 60 }],
      },
      user,
      assistant,
    ),
    null,
  );
});

test('strength, hold and cardio targets prefill the existing capture path without logging or seeding elapsed time', async () => {
  const f = planningFixture();
  const entries = [
    {
      id: 'hold',
      recipeKey: 'hold',
      exerciseClass: 'hold',
      isHold: true,
      isCardio: false,
      metrics: { duration: 60, rpe: 7 },
    },
    {
      id: 'cardio',
      recipeKey: 'cardio_live_duration_distance',
      exerciseClass: 'cardio-live',
      isHold: false,
      isCardio: true,
      metrics: { duration: 300, distance: 1 },
    },
  ];
  for (const e of entries)
    f.tables.exerciseCatalog.push({
      ...f.tables.exerciseCatalog[0],
      _id: e.id,
      name: e.id,
      recipeKey: e.recipeKey,
      exerciseClass: e.exerciseClass,
      isHold: e.isHold,
      isCardio: e.isCardio,
      supportsLiveTracking: e.isCardio,
    });
  const plan = f.tables.plannedSessions[0];
  plan.exercises = [
    ...(plan.exercises as unknown[]),
    ...entries.map((e) => ({
      exerciseCatalogId: e.id,
      targets: [{ metrics: e.metrics, restSeconds: 60 }],
    })),
  ];
  await handler(startPlannedSession)(f.ctx, {
    plannedSessionId: 'plan' as Id<'plannedSessions'>,
    expectedRevision: 1,
  });
  for (const [index, e] of entries.entries()) {
    const id = f.tables.liveSessionExercises[index + 1]._id as Id<'liveSessionExercises'>;
    await handler(selectExercise)(f.ctx, { sessionExerciseId: id });
    const state = buildCurrentLiveSessionState({
      session: f.tables.liveSessions[0] as unknown as Doc<'liveSessions'> & { status: 'active' },
      sessionExercises: f.tables.liveSessionExercises as unknown as (Doc<'liveSessionExercises'> & {
        recipeKey: 'standard_load';
      })[],
      logsByExercise: new Map(),
    });
    assert.deepEqual(state.activeCard.capture?.initialMetrics, e.metrics);
    if (e.isCardio) {
      await handler(startLiveCardio)(f.ctx, { sessionExerciseId: id });
      const process = f.tables.liveSessions[0].activeProcess as {
        elapsedSeconds: number;
        trackedMetrics: Record<string, number>;
      };
      assert.equal(process.elapsedSeconds, 0);
      assert.equal(process.trackedMetrics.distance, 1);
      assert.equal(process.trackedMetrics.duration, undefined);
    }
  }
  assert.equal(f.tables.activityLogs?.length ?? 0, 0);
});
test('accepting an actual planning offer is allowed; unrelated yes and unsolicited historical questions are not', async () => {
  const f = planningFixture();
  const user = {
    _id: 'user',
    profileId: 'profile',
    threadId: 'thread',
    role: 'user',
    content: 'yes',
    createdAt: 100,
  } as Doc<'reedMessages'>;
  const assistant = {
    _id: 'assistant',
    profileId: 'profile',
    threadId: 'thread',
    role: 'assistant',
    source: 'typed',
  } as Doc<'reedMessages'>;
  const raw = {
    title: 'Short session',
    exercises: [{ exerciseCatalogId: 'exercise', setCount: 1, restSeconds: 60 }],
  };
  assert.equal(
    await prepareChatPlan(f.ctx, 'profile' as Id<'profiles'>, raw, user, assistant),
    null,
  );
  f.tables.reedMessages = [
    {
      _id: 'offer',
      threadId: 'thread',
      profileId: 'profile',
      role: 'assistant',
      status: 'sent',
      createdAt: 90,
      content: 'Would you like me to create a workout plan?',
    },
  ];
  assert.ok(await prepareChatPlan(f.ctx, 'profile' as Id<'profiles'>, raw, user, assistant));
  assert.equal(
    await prepareChatPlan(
      f.ctx,
      'profile' as Id<'profiles'>,
      raw,
      { ...user, content: 'How was my last session?' },
      assistant,
    ),
    null,
  );
  assert.equal(
    await prepareChatPlan(
      f.ctx,
      'profile' as Id<'profiles'>,
      raw,
      { ...user, content: 'Make my plan shorter' },
      assistant,
    ),
    null,
  );
});

test('invalid model operations complete with honest text only and no plan/action/session writes', async () => {
  for (const operation of ['plan', 'sessionAction'] as const) {
    const f = planningFixture();
    f.tables.reedThreads = [{ _id: 'thread', profileId: 'profile' }];
    f.tables.reedMessages = [
      {
        _id: 'user',
        threadId: 'thread',
        profileId: 'profile',
        role: 'user',
        content: 'Please create my workout plan',
        createdAt: 1,
        status: 'sent',
      },
      {
        _id: 'assistant',
        threadId: 'thread',
        profileId: 'profile',
        role: 'assistant',
        source: 'typed',
        content: '',
        createdAt: 2,
        status: 'pending',
      },
    ];
    const result = await handler(completeAssistantMessage)(f.ctx, {
      threadId: 'thread' as Id<'reedThreads'>,
      assistantMessageId: 'assistant' as Id<'reedMessages'>,
      userMessageId: 'user' as Id<'reedMessages'>,
      content: 'Saved!',
      completedAt: 3,
      reentryState: 'hot',
      [operation]: { invalid: 'model output' },
    });
    assert.equal(result.widgetKind, null);
    assert.match(String(f.tables.reedMessages[1].content), /could not save/);
    assert.equal(f.tables.reedMessages[1].widget, undefined);
    assert.equal(f.tables.plannedSessions.length, 1);
    assert.equal(f.tables.reedSessionActions?.length ?? 0, 0);
    assert.equal(f.tables.liveSessions?.length ?? 0, 0);
    assert.equal(f.tables.activityLogs?.length ?? 0, 0);
  }
});
test('a later unavailable exercise prevents all writes in a mixed plan start', async () => {
  const f = planningFixture();
  f.tables.plannedSessions[0].exercises = [
    { exerciseCatalogId: 'exercise', targets },
    { exerciseCatalogId: 'missing', targets },
  ];
  await assert.rejects(() =>
    handler(startPlannedSession)(f.ctx, {
      plannedSessionId: 'plan' as Id<'plannedSessions'>,
      expectedRevision: 1,
    }),
  );
  assert.equal(f.writes.length, 0);
  assert.equal(f.tables.liveSessions?.length ?? 0, 0);
  assert.equal(f.tables.liveSessionExercises?.length ?? 0, 0);
});

test('a missing revision operation cannot claim that the plan was updated', async () => {
  const f = planningFixture();
  f.tables.reedThreads = [{ _id: 'thread', profileId: 'profile' }];
  f.tables.reedMessages = [
    {
      _id: 'user',
      threadId: 'thread',
      profileId: 'profile',
      role: 'user',
      content: 'Make that planned session shorter',
      createdAt: 1,
      status: 'sent',
    },
    {
      _id: 'assistant',
      threadId: 'thread',
      profileId: 'profile',
      role: 'assistant',
      source: 'typed',
      content: '',
      createdAt: 2,
      status: 'pending',
    },
  ];
  const result = await handler(completeAssistantMessage)(f.ctx, {
    threadId: 'thread' as Id<'reedThreads'>,
    assistantMessageId: 'assistant' as Id<'reedMessages'>,
    userMessageId: 'user' as Id<'reedMessages'>,
    content: 'Revised. One set each now.',
    completedAt: 3,
    reentryState: 'hot',
  });
  assert.equal(result.planDecision, 'missing_operation_text_only');
  assert.match(String(f.tables.reedMessages[1].content), /could not save/);
  assert.equal(f.tables.plannedSessions[0].revision, 1);
});

test('requested target edits validate recipe metrics, refuse load progression and preserve an omitted schedule', async () => {
  const f = planningFixture();
  f.tables.plannedSessions[0].scheduledForAt = 1900000000000;
  f.tables.activityLogs = [
    {
      _id: 'previous',
      profileId: 'profile',
      exerciseCatalogId: 'exercise',
      loggedAt: 1,
      recipeKey: 'standard_load',
      metrics: { load: 30, reps: 10, rpe: 7 },
      warmup: false,
    },
  ];
  const user = {
    _id: 'user',
    profileId: 'profile',
    threadId: 'thread',
    role: 'user',
    content: 'Make my plan lighter: load 20 and reps 6',
  } as Doc<'reedMessages'>;
  const assistant = {
    _id: 'assistant',
    profileId: 'profile',
    threadId: 'thread',
    role: 'assistant',
    source: 'typed',
  } as Doc<'reedMessages'>;
  const raw = {
    title: 'Lighter session',
    plannedSessionId: 'plan',
    expectedRevision: 1,
    exercises: [
      {
        exerciseCatalogId: 'exercise',
        setCount: 1,
        restSeconds: 60,
        targetMetrics: [{ load: 20, reps: 6, rpe: 7 }],
      },
    ],
  };
  const prepared = await prepareChatPlan(f.ctx, 'profile' as Id<'profiles'>, raw, user, assistant);
  assert.ok(prepared);
  assert.deepEqual(prepared.exercises[0].targets[0].metrics, { load: 20, reps: 6, rpe: 7 });
  assert.equal(prepared.scheduledForAt, 1900000000000);
  for (const metrics of [
    { load: 35, reps: 6, rpe: 7 },
    { load: 20, reps: 6, rpe: 99 },
    { load: 20, reps: 6 },
  ])
    assert.equal(
      await prepareChatPlan(
        f.ctx,
        'profile' as Id<'profiles'>,
        { ...raw, exercises: [{ ...raw.exercises[0], targetMetrics: [metrics] }] },
        user,
        assistant,
      ),
      null,
    );
});

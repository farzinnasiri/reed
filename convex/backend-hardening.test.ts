/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import type { OnboardingAnswers } from '../domains/profile/onboarding';

const modules = import.meta.glob('./**/*.ts');
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const answers: OnboardingAnswers = {
  practices: [{ id: 'snow:Snowboarding', label: 'Snowboarding', world: 'snow', level: 2 }],
  values: ['feel-good'],
  consent: true,
  sex: 'female',
  birthYear: 1995,
  heightCm: 170,
  weightKg: 65,
  shape: 'average_lean',
  bodyMapDone: true,
  discomfort: [],
  sleep: 2,
  sleepQuality: 3,
  dayLoad: 'sitting',
  days: ['fixed', 'fixed', 'fixed', 'fixed', 'fixed', 'off', 'off'],
  rhythm: 'rotate',
  blockWeeks: 2,
  push: 1,
  notes: null,
};

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

test('home, consistency, live status, thread reads, quick actions, and timezone sync reject signed-out users', async () => {
  const t = convexTest(schema, modules);
  const calls = [
    () => t.query(api.home.getPulse, { now: 0 }),
    () => t.query(api.home.getTodayCards, { now: 0 }),
    () => t.query(api.trainingKnowledge.getConsistency, {}),
    () => t.query(api.liveSessions.getActiveStatus, {}),
    () => t.query(api.reed.listQuickActions, {}),
    () => t.query(api.reed.listMessages, {}),
    () => t.query(api.reed.listMessagesPaginated, { paginationOpts: { cursor: null, numItems: 20 } }),
    () => t.mutation(api.profiles.updateTimeZone, { timeZone: 'Europe/Rome' }),
  ];
  for (const call of calls) await expect(call()).rejects.toThrow(/Not authenticated/);
});

test('live status counts the owned selected exercise and hides an oversized or foreign count', async () => {
  const { t, viewer, profileId } = await owner();
  const otherProfileId = await t.run(ctx => ctx.db.insert('profiles', {
    authUserId: 'test|other',
    email: 'other@example.test',
    updatedAt: 1,
  }));
  const status = await t.run(async ctx => {
    const exerciseCatalogId = await ctx.db.insert('exerciseCatalog', catalog('Bench press', ['dumbbell']));
    const sessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null,
      profileId,
      startedAt: 1,
      status: 'active',
    });
    const foreignSessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null,
      profileId: otherProfileId,
      startedAt: 1,
      status: 'active',
    });
    const firstId = await ctx.db.insert('liveSessionExercises', {
      addedAt: 1,
      exerciseCatalogId,
      exerciseClass: 'strength',
      exerciseName: 'First',
      position: 0,
      profileId,
      recipeKey: 'standard_load',
      sessionId,
    });
    const selectedId = await ctx.db.insert('liveSessionExercises', {
      addedAt: 2,
      exerciseCatalogId,
      exerciseClass: 'strength',
      exerciseName: 'Selected',
      position: 1,
      profileId,
      recipeKey: 'standard_load',
      sessionId,
    });
    const foreignExerciseId = await ctx.db.insert('liveSessionExercises', {
      addedAt: 1,
      exerciseCatalogId,
      exerciseClass: 'strength',
      exerciseName: 'Private',
      position: 0,
      profileId: otherProfileId,
      recipeKey: 'standard_load',
      sessionId: foreignSessionId,
    });
    for (let index = 0; index < 3; index += 1) {
      await ctx.db.insert('activityLogs', {
        exerciseCatalogId,
        loggedAt: index + 1,
        metrics: { reps: 5 },
        profileId,
        recipeKey: 'standard_load',
        sessionExerciseId: selectedId,
        sessionId,
        setNumber: index + 1,
        source: 'live_session',
        warmup: false,
      });
    }
    await ctx.db.patch(sessionId, { activeSessionExerciseId: selectedId });
    return { exerciseCatalogId, foreignExerciseId, selectedId, sessionId };
  });

  expect((await viewer.query(api.liveSessions.getActiveStatus, {}))?.currentSetNumber).toBe(4);

  await t.run(async ctx => {
    for (let index = 0; index < 1998; index += 1) {
      await ctx.db.insert('activityLogs', {
        exerciseCatalogId: status.exerciseCatalogId,
        loggedAt: index + 10,
        metrics: { reps: 5 },
        profileId,
        recipeKey: 'standard_load',
        sessionExerciseId: status.selectedId,
        sessionId: status.sessionId,
        setNumber: index + 4,
        source: 'live_session',
        warmup: false,
      });
    }
  });
  expect((await viewer.query(api.liveSessions.getActiveStatus, {}))?.currentSetNumber).toBeNull();

  await t.run(ctx => ctx.db.patch(status.sessionId, { activeSessionExerciseId: status.foreignExerciseId }));
  expect((await viewer.query(api.liveSessions.getActiveStatus, {}))?.currentExerciseName).toBe('First');

  await t.run(ctx => ctx.db.patch(status.sessionId, { profileId: otherProfileId }));
  expect(await viewer.query(api.liveSessions.getActiveStatus, {})).toBeNull();
});

test('message pages cap at 50, keep five images on the newest message, and hide foreign sessions', async () => {
  const { t, viewer, profileId } = await owner();
  const otherProfileId = await t.run(ctx => ctx.db.insert('profiles', {
    authUserId: 'test|other',
    email: 'other@example.test',
    updatedAt: 1,
  }));
  await t.run(async ctx => {
    const foreignSessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null,
      endedAt: 2,
      profileId: otherProfileId,
      startedAt: 1,
      status: 'ended',
    });
    const threadId = await ctx.db.insert('reedThreads', {
      createdAt: 1,
      profileId,
      status: 'active',
      updatedAt: 1,
    });
    const storageId = await ctx.storage.store(new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/jpeg' }));
    let newestMessageId: Id<'reedMessages'> | null = null;
    for (let index = 0; index < 80; index += 1) {
      newestMessageId = await ctx.db.insert('reedMessages', {
        content: 'A reply',
        createdAt: index + 1,
        profileId,
        relatedSessionId: foreignSessionId,
        role: 'assistant',
        source: 'typed',
        status: 'sent',
        threadId,
      });
    }
    for (let index = 0; index < 30; index += 1) {
      await ctx.db.insert('reedMessageAttachments', {
        createdAt: 1,
        kind: 'image',
        mediaType: 'image/jpeg',
        messageId: newestMessageId!,
        profileId,
        sortOrder: index,
        status: 'analyzed',
        storageId,
        threadId,
        updatedAt: 1,
      });
    }
  });

  const page = await viewer.query(api.reed.listMessagesPaginated, {
    paginationOpts: { cursor: null, numItems: 5000 },
  });
  expect(page.page).toHaveLength(50);
  expect(page.isDone).toBe(false);
  expect(page.continueCursor).toBeTruthy();
  expect(page.continueCursor).not.toBe('next');
  expect(page.page[0]?.attachments).toHaveLength(5);
  expect(page.page.every(message => message.relatedSession === null)).toBe(true);
  expect((await viewer.query(api.reed.listMessages, { limit: Number.NaN })).messages).toHaveLength(40);
});

test('assistant completion strips a foreign widget, dedupes replies, and failure does not rewrite a user message', async () => {
  const { t, profileId } = await owner();
  const otherProfileId = await t.run(ctx => ctx.db.insert('profiles', {
    authUserId: 'test|other',
    email: 'other@example.test',
    updatedAt: 1,
  }));
  const ids = await t.run(async ctx => {
    const foreignSessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null,
      endedAt: 2,
      profileId: otherProfileId,
      startedAt: 1,
      status: 'ended',
    });
    const threadId = await ctx.db.insert('reedThreads', {
      createdAt: 1,
      profileId,
      status: 'active',
      updatedAt: 1,
    });
    const assistantMessageId = await ctx.db.insert('reedMessages', {
      content: '',
      createdAt: 1,
      profileId,
      role: 'assistant',
      source: 'typed',
      status: 'pending',
      threadId,
    });
    return { assistantMessageId, foreignSessionId, threadId };
  });
  const args = {
    assistantMessageId: ids.assistantMessageId,
    completedAt: 2,
    content: 'Ready?',
    reentryState: 'hot' as const,
    replies: [' Yes ', 'YES', 'No', 'Later', 'Never'],
    threadId: ids.threadId,
    widget: { kind: 'session_summary' as const, sessionId: ids.foreignSessionId },
  };

  expect(await t.mutation(internal.reed.completeAssistantMessage, args)).toEqual({
    actionDecision: 'none',
    planDecision: 'none',
    replyCount: 3,
    widgetKind: null,
  });
  const saved = await t.run(ctx => ctx.db.get(ids.assistantMessageId));
  expect(saved?.content).toBe('Ready?');
  expect(saved?.widget).toBeUndefined();
  expect(saved?.replies).toEqual(['Yes', 'No', 'Later']);

  await t.run(ctx => ctx.db.patch(ids.assistantMessageId, { role: 'user' }));
  await expect(t.mutation(internal.reed.completeAssistantMessage, args)).rejects.toThrow(/Assistant message/);
  await expect(t.mutation(internal.reed.failAssistantMessage, {
    assistantMessageId: ids.assistantMessageId,
    error: 'failure',
    failedAt: 3,
  })).rejects.toThrow(/Assistant message/);
  expect((await t.run(ctx => ctx.db.get(ids.assistantMessageId)))?.content).toBe('Ready?');

  await t.run(ctx => ctx.db.patch(ids.assistantMessageId, { profileId: otherProfileId, role: 'assistant' }));
  await expect(t.mutation(internal.reed.completeAssistantMessage, args)).rejects.toThrow(/Assistant message/);

  const ownedSessionId = await t.run(async ctx => {
    const sessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null,
      endedAt: 4,
      profileId,
      startedAt: 3,
      status: 'ended',
    });
    await ctx.db.patch(ids.assistantMessageId, { profileId, role: 'assistant', status: 'pending' });
    return sessionId;
  });
  expect(await t.mutation(internal.reed.completeAssistantMessage, {
    ...args,
    widget: { kind: 'session_summary', sessionId: ownedSessionId },
  })).toMatchObject({ replyCount: 3, widgetKind: 'session_summary' });

  await t.mutation(internal.reed.failAssistantMessage, {
    assistantMessageId: ids.assistantMessageId,
    error: 'failure',
    failedAt: 5,
  });
  const failed = await t.run(ctx => ctx.db.get(ids.assistantMessageId));
  expect(failed?.status).toBe('failed');
  expect(failed?.replies).toBeUndefined();
  expect(failed?.widget).toBeUndefined();
});

test('journey rebuild bounds evidence and keeps the weekly target', async () => {
  const now = Date.parse('2026-10-01T12:00:00Z');
  const day = 24 * 60 * 60 * 1000;
  // Logs and measurements before the profile exists are outside the journey window.
  vi.setSystemTime(now - 2 * day);
  const { t, profileId } = await owner();
  vi.setSystemTime(now);
  await t.run(async ctx => {
    await ctx.db.insert('trainingProfiles', {
      onboarding: answers,
      profileId,
      profilingConsent: true,
      source: 'onboarding',
      updatedAt: now,
      version: 2,
    });
    const exerciseCatalogId = await ctx.db.insert('exerciseCatalog', catalog('Exercise', ['dumbbell']));
    for (let index = 0; index < 1001; index += 1) {
      await ctx.db.insert('activityLogs', {
        exerciseCatalogId,
        loggedAt: now - index * 1000,
        metrics: { load: 20, reps: 8 },
        profileId,
        recipeKey: 'standard_load',
        setNumber: index + 1,
        source: 'live_session',
        warmup: false,
      });
    }
  });

  await t.mutation(internal.reedJourney.rebuildLatest, { profileId, trigger: 'onboarding_updated' });
  const snapshot = await t.query(internal.reedJourney.latestForProfile, { profileId });
  expect(snapshot?.baseline.weeklyTarget).toBe('5 active days per week');
  expect(snapshot?.renderedContext).toMatch(/Evidence limit reached/);
  expect(snapshot?.renderedContext).not.toMatch(/\/100/);

  vi.setSystemTime(now - 2 * day);
  const bounded = await owner();
  vi.setSystemTime(now);
  await bounded.t.run(async ctx => {
    await ctx.db.insert('trainingProfiles', {
      onboarding: answers,
      profileId: bounded.profileId,
      profilingConsent: true,
      source: 'onboarding',
      updatedAt: now,
      version: 2,
    });
    for (let index = 0; index < 200; index += 1) {
      await ctx.db.insert('bodyMeasurements', {
        metricKey: 'body_weight',
        observedAt: now - index * 1000,
        profileId: bounded.profileId,
        source: 'manual',
        unit: 'kg',
        value: 80,
      });
    }
  });
  await bounded.t.mutation(internal.reedJourney.rebuildLatest, { profileId: bounded.profileId, trigger: 'session_ended' });
  expect((await bounded.t.query(internal.reedJourney.latestForProfile, { profileId: bounded.profileId }))?.renderedContext).not.toMatch(/Evidence limit reached/);

  await bounded.t.run(ctx => ctx.db.insert('bodyMeasurements', {
    metricKey: 'body_weight',
    observedAt: now - 200_000,
    profileId: bounded.profileId,
    source: 'manual',
    unit: 'kg',
    value: 80,
  }));
  expect(await bounded.t.mutation(internal.reedJourney.rebuildLatest, { profileId: bounded.profileId, trigger: 'session_ended' })).toMatchObject({ created: true });
  expect((await bounded.t.query(internal.reedJourney.latestForProfile, { profileId: bounded.profileId }))?.renderedContext).toMatch(/Evidence limit reached/);
});

test('an equipment filter keeps the picker cursor when the page has no matches', async () => {
  const { t, viewer } = await owner();
  await t.run(async ctx => {
    await ctx.db.insert('exerciseCatalog', catalog('Bench press', ['dumbbell']));
    await ctx.db.insert('exerciseCatalog', catalog('Incline press', ['dumbbell']));
  });
  const page = await viewer.query(api.exerciseCatalog.searchForPicker, {
    equipment: ['cable'],
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(page.page).toEqual([]);
  expect(page.isDone).toBe(false);
  expect(page.continueCursor).toBeTruthy();
});

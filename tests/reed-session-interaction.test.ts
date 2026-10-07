import assert from 'node:assert/strict';
import test from 'node:test';
import type { Doc, Id } from '../convex/_generated/dataModel';
import { validateReedMessageContext, reedMessageContextLine } from '../convex/reedSessionContext';
import { getSessionWhisper, saveSessionWhisper } from '../convex/reedSessionWhispers';
import { fixture, handler } from './helpers/session-fixture';
const session = { _id: 'session', profileId: 'profile', status: 'active', startedAt: 0 };
const exercise = { _id: 'exercise', sessionId: 'session', profileId: 'profile', exerciseCatalogId: 'catalog', exerciseName: 'Bench press', recipeKey: 'standard_load', targetDefaults: [{}, {}, {}] };
const log = { _id: 'new', profileId: 'profile', sessionId: 'session', sessionExerciseId: 'exercise', exerciseCatalogId: 'catalog', setNumber: 1, loggedAt: 1000, recipeKey: 'standard_load', metrics: { load: 40, reps: 8, rpe: 8 }, warmup: false };

test('message context must belong to the live workout and use a valid current or previous set', async () => {
  const f = fixture({ liveSessions: [{ ...session }], liveSessionExercises: [exercise] });
  const context = { sessionId: 'session' as Id<'liveSessions'>, exerciseId: 'exercise' as Id<'liveSessionExercises'>, setIndex: 0 };
  await validateReedMessageContext(f.ctx, 'profile' as Id<'profiles'>, context);
  for (const invalid of [-1, 0.5, 1, Infinity, 2001]) await assert.rejects(() => validateReedMessageContext(f.ctx, 'profile' as Id<'profiles'>, { ...context, setIndex: invalid }));
  await assert.rejects(() => validateReedMessageContext(f.ctx, 'other' as Id<'profiles'>, context), /no longer active/);
  assert.match((await reedMessageContextLine(f.ctx, 'profile' as Id<'profiles'>, context))!, /Bench press, set 1/);
  f.tables.liveSessions[0].status = 'ended';
  await assert.rejects(() => validateReedMessageContext(f.ctx, 'profile' as Id<'profiles'>, context), /no longer active/);
});

test('whispers use committed owned data, prioritize caution, and respect their short read window', async () => {
  const f = fixture({ liveSessions: [{ ...session }], liveSessionExercises: [exercise], activityLogs: [{ ...log, metrics: { ...log.metrics, rpe: 10 } }] });
  await saveSessionWhisper(f.ctx, f.tables.activityLogs[0] as unknown as Doc<'activityLogs'>, exercise as unknown as Doc<'liveSessionExercises'>, session as unknown as Doc<'liveSessions'>, []);
  const args = { sessionId: 'session' as Id<'liveSessions'>, exerciseId: 'exercise' as Id<'liveSessionExercises'>, now: 1001 };
  const whisper = await handler(getSessionWhisper)(f.ctx, args);
  assert.equal(whisper?.kind, 'caution');
  assert.ok(whisper!.text.length <= 80);
  assert.equal(await handler(getSessionWhisper)(f.ctx, { ...args, now: 11001 }), null);
  f.tables.liveSessions[0].profileId = 'other';
  assert.equal(await handler(getSessionWhisper)(f.ctx, args), null);
  f.signOut();
  await assert.rejects(() => handler(getSessionWhisper)(f.ctx, args), /sign|auth/i);
});

test('info is limited to one per exercise and records are never inferred from truncated history', async () => {
  const previous = { ...log, _id: 'old', sessionId: 'older', sessionExerciseId: 'olderExercise', loggedAt: 1, metrics: { load: 45, reps: 8, rpe: 8 } };
  const f = fixture({ activityLogs: [previous, log] });
  assert.equal((await saveSessionWhisper(f.ctx, log as unknown as Doc<'activityLogs'>, exercise as unknown as Doc<'liveSessionExercises'>, session as unknown as Doc<'liveSessions'>, []))?.kind, 'info');
  f.tables.activityLogs[1].reedWhisper = { kind: 'info', text: 'Last time: 45 kg.', retired: true };
  const next = { ...log, _id: 'next', setNumber: 2, loggedAt: 2000 };
  f.tables.activityLogs.push(next);
  assert.equal(await saveSessionWhisper(f.ctx, next as unknown as Doc<'activityLogs'>, exercise as unknown as Doc<'liveSessionExercises'>, session as unknown as Doc<'liveSessions'>, [f.tables.activityLogs[1] as unknown as Doc<'activityLogs'>]), null);
  const history = Array.from({ length: 201 }, (_, i) => ({ ...previous, _id: `history-${i}`, loggedAt: i }));
  const g = fixture({ activityLogs: [...history, { ...log, metrics: { load: 100, reps: 8, rpe: 8 } }] });
  assert.notEqual((await saveSessionWhisper(g.ctx, g.tables.activityLogs.at(-1) as unknown as Doc<'activityLogs'>, exercise as unknown as Doc<'liveSessionExercises'>, session as unknown as Doc<'liveSessions'>, []))?.kind, 'pr');
  assert.ok(g.bounds.some(bound => bound.table === 'activityLogs' && bound.limit === 201));
});

test('matching a previous best never becomes a PR because it was logged later', async () => {
  const previous = { ...log, _id: 'old', sessionId: 'older', sessionExerciseId: 'olderExercise', loggedAt: 1 };
  const f = fixture({ activityLogs: [previous, { ...log }] });
  assert.notEqual((await saveSessionWhisper(f.ctx, log as unknown as Doc<'activityLogs'>, exercise as unknown as Doc<'liveSessionExercises'>, session as unknown as Doc<'liveSessions'>, []))?.kind, 'pr');
  const improved = { ...log, _id: 'better', loggedAt: 2000, metrics: { ...log.metrics, load: 50 } };
  f.tables.activityLogs.push(improved);
  assert.equal((await saveSessionWhisper(f.ctx, improved as unknown as Doc<'activityLogs'>, exercise as unknown as Doc<'liveSessionExercises'>, session as unknown as Doc<'liveSessions'>, [f.tables.activityLogs[1] as unknown as Doc<'activityLogs'>]))?.kind, 'pr');
});

test('edited observations retire from display and question context while preserving the info limit', async () => {
  const observed = { ...log, reedWhisper: { kind: 'info', text: 'Last time: 45 kg.', retired: true } };
  const f = fixture({ liveSessions: [{ ...session }], liveSessionExercises: [exercise], activityLogs: [observed] });
  const context = { sessionId: 'session' as Id<'liveSessions'>, exerciseId: 'exercise' as Id<'liveSessionExercises'>, setIndex: 0 };
  assert.doesNotMatch((await reedMessageContextLine(f.ctx, 'profile' as Id<'profiles'>, context))!, /Last time/);
  assert.equal(await handler(getSessionWhisper)(f.ctx, { sessionId: context.sessionId, exerciseId: context.exerciseId, now: 1001 }), null);
  f.tables.activityLogs[0].reedWhisper = { kind: 'info', text: 'Last time: 45 kg.', retired: false };
  assert.match((await reedMessageContextLine(f.ctx, 'profile' as Id<'profiles'>, context))!, /Last time: 45 kg/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Doc, Id } from '../convex/_generated/dataModel';
import { assignMessageChapter, backfillMessageChapter, chapterGapMinutes, closeChapterForSession, startsNewChapter } from '../convex/reedChapters';
import { getChapterHeader, getPresence, listChapterMessages, sendMessage } from '../convex/reed';
import { fixture, handler } from './helpers/session-fixture';

test('the configurable gap is strict, and a session boundary starts a chapter even with recent messages', () => {
  assert.equal(startsNewChapter(null, 0, 60), true);
  assert.equal(startsNewChapter(0, 3_600_000, 60), false);
  assert.equal(startsNewChapter(0, 3_600_001, 60), true);
  assert.equal(startsNewChapter(0, 30_001, 0.5), true);
  assert.equal(startsNewChapter(10, 20, 60, 15), true);
  assert.equal(startsNewChapter(10, 20, 60, 21), false);
  process.env.REED_CHAPTER_GAP_MINUTES = '90';
  assert.equal(chapterGapMinutes(), 90);
  process.env.REED_CHAPTER_GAP_MINUTES = 'invalid';
  assert.equal(chapterGapMinutes(), 60);
  delete process.env.REED_CHAPTER_GAP_MINUTES;
});

test('message assignment keeps the AI thread, and session closure survives deleted sessions', async () => {
  const f = fixture({ reedThreads: [{ _id: 'thread', profileId: 'profile', status: 'active', lastMessageAt: 100 }] });
  const thread = f.tables.reedThreads[0] as unknown as Doc<'reedThreads'>;
  const first = await assignMessageChapter(f.ctx, thread, 100);
  assert.equal(await assignMessageChapter(f.ctx, thread, 200), first);
  await closeChapterForSession(f.ctx, 'profile' as Id<'profiles'>, 'deleted-session' as Id<'liveSessions'>, 250, 'session_ended');
  const second = await assignMessageChapter(f.ctx, thread, 300);
  assert.notEqual(first, second);
  assert.equal(f.tables.reedChapters[1].previousChapterId, first);
  assert.equal(f.tables.reedChapters[1].boundary, 'session_ended');
  assert.equal(f.tables.reedThreads.length, 1);
  assert.equal(f.tables.reedChapters[0].boundary, undefined);
});

test('a turn writes all rows to one chapter and nonce retry never duplicates it', async () => {
  const f = fixture();
  const args = { content: 'Hello', source: 'typed' as const, clientNonce: 'one' };
  const first = await handler(sendMessage)(f.ctx, args);
  const writes = f.writes.length;
  const second = await handler(sendMessage)(f.ctx, args);
  assert.equal(first.userMessageId, second.userMessageId);
  assert.equal(f.writes.length, writes);
  assert.equal(new Set(f.tables.reedMessages.map(row => row.chapterId)).size, 1);
  assert.ok(f.tables.reedMessages.every(row => row.chapterId));
});

test('chapter reads are owned, bounded and the home clock uses the same boundary', async () => {
  const f = fixture({
    reedThreads: [{ _id: 'thread', profileId: 'profile', status: 'active', currentChapterId: 'chapter', lastMessageAt: 100 }],
    reedChapters: [{ _id: 'chapter', profileId: 'profile', threadId: 'thread', startedAt: 100 }, { _id: 'foreign', profileId: 'another', threadId: 'elsewhere', startedAt: 0 }],
    reedMessages: [{ _id: 'message', profileId: 'profile', threadId: 'thread', chapterId: 'chapter', createdAt: 100, role: 'user', status: 'sent', content: 'Hello', source: 'typed' }],
  });
  assert.equal((await handler(getPresence)(f.ctx, { now: 3_600_100 })).wouldStartNewChapter, false);
  assert.equal((await handler(getPresence)(f.ctx, { now: 3_600_101 })).wouldStartNewChapter, true);
  await assert.rejects(() => handler(getChapterHeader)(f.ctx, { chapterId: 'foreign' as Id<'reedChapters'> }), /not found/);
  await assert.rejects(() => handler(listChapterMessages)(f.ctx, { chapterId: 'foreign' as Id<'reedChapters'>, paginationOpts: { numItems: 30, cursor: null } }), /not found/);
  const result = await handler(listChapterMessages)(f.ctx, { chapterId: 'chapter' as Id<'reedChapters'>, paginationOpts: { numItems: 999, cursor: null } });
  assert.equal(result.page.length, 1);
  assert.ok(f.bounds.some(bound => bound.table === 'reedMessages' && bound.limit === 50));
  f.signOut();
  await assert.rejects(() => handler(getPresence)(f.ctx, { now: 100 }), /sign|auth/i);
});

test('historical backfill is idempotent and splits at both gaps and workout boundaries', async () => {
  const f = fixture({
    reedThreads: [{ _id: 'thread', profileId: 'profile', status: 'active', lastMessageAt: 4_000_200 }],
    liveSessions: [{ _id: 'session', profileId: 'profile', startedAt: 4_000_050, endedAt: 4_000_150, status: 'ended' }],
    reedMessages: [
      { _id: 'm1', threadId: 'thread', profileId: 'profile', createdAt: 100, role: 'user', source: 'typed' },
      { _id: 'm2', threadId: 'thread', profileId: 'profile', createdAt: 101, role: 'assistant', source: 'system' },
      { _id: 'm3', threadId: 'thread', profileId: 'profile', createdAt: 4_000_000, role: 'user', source: 'typed' },
      { _id: 'm4', threadId: 'thread', profileId: 'profile', createdAt: 4_000_100, role: 'user', source: 'typed' },
      { _id: 'm5', threadId: 'thread', profileId: 'profile', createdAt: 4_000_200, role: 'assistant', source: 'background_coach' },
    ],
  });
  for (const row of f.tables.reedMessages) await backfillMessageChapter(f.ctx, row as unknown as Doc<'reedMessages'>);
  const count = f.writes.length;
  for (const row of f.tables.reedMessages) await backfillMessageChapter(f.ctx, row as unknown as Doc<'reedMessages'>);
  assert.equal(f.writes.length, count);
  assert.equal(f.tables.reedChapters.length, 4);
  assert.equal(f.tables.reedMessages[0].chapterId, f.tables.reedMessages[1].chapterId);
  assert.equal(f.tables.reedChapters[2].boundary, 'session_started');
  assert.equal(f.tables.reedChapters[3].boundary, 'session_ended');
  assert.equal(f.tables.reedThreads[0].currentChapterId, f.tables.reedChapters[3]._id);
});

test('starting the first workout creates an empty chapter and keeps its first message there', async () => {
  const f = fixture();
  await closeChapterForSession(f.ctx, 'profile' as Id<'profiles'>, 'session' as Id<'liveSessions'>, 100, 'session_started');
  assert.equal(f.tables.reedThreads.length, 1);
  assert.equal(f.tables.reedChapters.length, 1);
  const chapter = f.tables.reedChapters[0];
  assert.equal(chapter.boundary, 'session_started');
  assert.equal(await assignMessageChapter(f.ctx, f.tables.reedThreads[0] as unknown as Doc<'reedThreads'>, 200), chapter._id);
  await closeChapterForSession(f.ctx, 'profile' as Id<'profiles'>, 'session' as Id<'liveSessions'>, 300, 'session_ended');
  assert.equal(chapter.closedAt, 300);
  assert.notEqual(await assignMessageChapter(f.ctx, f.tables.reedThreads[0] as unknown as Doc<'reedThreads'>, 301), chapter._id);
});

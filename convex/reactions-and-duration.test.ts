/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import schema from './schema';
import { api, internal } from './_generated/api';
const modules = import.meta.glob('./**/*.ts');
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const profileId = await ctx.db.insert('profiles', {
      authUserId: 'test|viewer',
      email: 'viewer@example.test',
      updatedAt: 1,
      timeZone: 'UTC',
    });
    const otherProfileId = await ctx.db.insert('profiles', {
      authUserId: 'test|other',
      email: 'other@example.test',
      updatedAt: 1,
    });
    const threadId = await ctx.db.insert('reedThreads', {
      profileId,
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
    });
    const chapterId = await ctx.db.insert('reedChapters', {
      threadId,
      profileId,
      startedAt: 1,
    });
    await ctx.db.patch(threadId, { currentChapterId: chapterId });
    const responseId = await ctx.db.insert('reedMessages', {
      threadId,
      chapterId,
      profileId,
      role: 'assistant',
      source: 'typed',
      content: 'Try the shorter session.',
      status: 'sent',
      createdAt: 10,
    });
    const userId = await ctx.db.insert('reedMessages', {
      threadId,
      chapterId,
      profileId,
      role: 'user',
      source: 'typed',
      content: 'That works for me.',
      status: 'sent',
      createdAt: 20,
    });
    const pendingId = await ctx.db.insert('reedMessages', {
      threadId,
      chapterId,
      profileId,
      role: 'assistant',
      source: 'system',
      content: '',
      status: 'pending',
      createdAt: 21,
    });
    const sessionId = await ctx.db.insert('liveSessions', {
      profileId,
      status: 'ended',
      startedAt: 1000,
      endedAt: 3601000,
      activeProcess: null,
    });
    return {
      profileId,
      otherProfileId,
      threadId,
      chapterId,
      responseId,
      userId,
      pendingId,
      sessionId,
    };
  });
  const viewer = t.withIdentity({
    subject: 'viewer',
    issuer: 'test',
    tokenIdentifier: 'test|viewer',
    email: 'viewer@example.test',
  });
  const other = t.withIdentity({
    subject: 'other',
    issuer: 'test',
    tokenIdentifier: 'test|other',
    email: 'other@example.test',
  });
  return { t, viewer, other, ...ids };
}

test('user can add, replace and remove a reaction; ownership, role, status and emoji are enforced', async () => {
  const f = await fixture();
  await f.viewer.mutation(api.reed.setMessageReaction, {
    messageId: f.responseId,
    reaction: '❤️',
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.responseId)))?.reaction).toBe(
    '❤️',
  );
  await f.viewer.mutation(api.reed.setMessageReaction, {
    messageId: f.responseId,
    reaction: '👎',
  });
  expect(
    (
      await f.viewer.query(api.reed.listChapterMessages, {
        chapterId: f.chapterId,
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).page.find((row) => row._id === f.responseId)?.reaction,
  ).toBe('👎');
  await expect(
    f.other.mutation(api.reed.setMessageReaction, {
      messageId: f.responseId,
      reaction: '👍',
    }),
  ).rejects.toThrow();
  await expect(
    f.viewer.mutation(api.reed.setMessageReaction, {
      messageId: f.userId,
      reaction: '👍',
    }),
  ).rejects.toThrow();
  await expect(
    f.viewer.mutation(api.reed.setMessageReaction, {
      messageId: f.pendingId,
      reaction: '👍',
    }),
  ).rejects.toThrow();
  await expect(
    f.t.mutation(api.reed.setMessageReaction, {
      messageId: f.responseId,
      reaction: '👍',
    }),
  ).rejects.toThrow();
  await f.viewer.mutation(api.reed.setMessageReaction, {
    messageId: f.responseId,
    reaction: null,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(f.responseId)))?.reaction,
  ).toBeUndefined();
});

test('fresh feedback on a compacted response enters the next assistant context', async () => {
  const f = await fixture();
  await f.viewer.mutation(api.reed.setMessageReaction, {
    messageId: f.responseId,
    reaction: '👍',
  });
  const context = await f.t.query(internal.reed.loadAssistantContext, {
    assistantMessageId: f.pendingId,
    userMessageId: f.userId,
    threadId: f.threadId,
    clientNow: Date.now(),
    priorLastMessageAt: 10,
    recentTurnCount: 0,
    reentryState: 'cold',
  });
  expect(context.recentMessages).toHaveLength(0);
  expect(
    context.recentReactionSignals.map((row) => ({
      content: row.content,
      reaction: row.reaction,
    })),
  ).toEqual([{ content: 'Try the shorter session.', reaction: '👍' }]);
});

test('Reed reaction is persisted atomically with the reply and obeys the two-turn cooldown', async () => {
  const f = await fixture();
  const complete = {
    assistantMessageId: f.pendingId,
    userMessageId: f.userId,
    threadId: f.threadId,
    content: 'Keep it simple.',
    reaction: '👍' as const,
    completedAt: Date.now(),
    reentryState: 'hot' as const,
  };
  await f.t.mutation(internal.reed.completeAssistantMessage, complete);
  expect((await f.t.run((ctx) => ctx.db.get(f.userId)))?.reaction).toBe('👍');
  const next = await f.t.run(async (ctx) => ({
    user: await ctx.db.insert('reedMessages', {
      profileId: f.profileId,
      threadId: f.threadId,
      chapterId: f.chapterId,
      role: 'user',
      source: 'typed',
      status: 'sent',
      content: 'Next question.',
      createdAt: 30,
    }),
    assistant: await ctx.db.insert('reedMessages', {
      profileId: f.profileId,
      threadId: f.threadId,
      chapterId: f.chapterId,
      role: 'assistant',
      source: 'system',
      status: 'pending',
      content: '',
      createdAt: 31,
    }),
  }));
  await f.t.mutation(internal.reed.completeAssistantMessage, {
    ...complete,
    userMessageId: next.user,
    assistantMessageId: next.assistant,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.get(next.user)))?.reaction,
  ).toBeUndefined();
  // Duplicate completion cannot alter an already sent reply or its original reaction.
  await f.t.mutation(internal.reed.completeAssistantMessage, {
    ...complete,
    reaction: '👎',
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.userId)))?.reaction).toBe('👍');
});

test('manual workout duration preserves chronology, drives insights, validates input and restores automatic duration', async () => {
  const f = await fixture();
  await f.viewer.mutation(api.liveSessions.setSessionDuration, {
    sessionId: f.sessionId,
    durationSeconds: 1500,
  });
  const saved = await f.t.run((ctx) => ctx.db.get(f.sessionId));
  expect(saved).toMatchObject({
    startedAt: 1000,
    endedAt: 3601000,
    manualDurationSeconds: 1500,
  });
  const insights = await f.viewer.query(api.liveSessionInsights.getForSession, {
    sessionId: f.sessionId,
  });
  expect(insights?.statusStrip.durationLabel).toBe('25m');
  expect(
    (
      await f.viewer.query(api.liveSessions.getEndedTimeline, {
        sessionId: f.sessionId,
      })
    )?.manualDurationSeconds,
  ).toBe(1500);
  await f.t.run((ctx) => ctx.db.patch(f.sessionId, { status: 'active' }));
  expect(
    (await f.viewer.query(api.liveSessions.getActiveStatus, {}))
      ?.manualDurationSeconds,
  ).toBe(1500);
  await f.t.run((ctx) => ctx.db.patch(f.sessionId, { status: 'ended' }));
  await expect(
    f.other.mutation(api.liveSessions.setSessionDuration, {
      sessionId: f.sessionId,
      durationSeconds: 100,
    }),
  ).rejects.toThrow();
  for (const durationSeconds of [0, -1, 1.5, 86401, Infinity, NaN]) {
    await expect(
      f.viewer.mutation(api.liveSessions.setSessionDuration, {
        sessionId: f.sessionId,
        durationSeconds,
      }),
    ).rejects.toThrow();
  }
  await f.viewer.mutation(api.liveSessions.setSessionDuration, {
    sessionId: f.sessionId,
    durationSeconds: null,
  });
  expect(
    (
      await f.viewer.query(api.liveSessionInsights.getForSession, {
        sessionId: f.sessionId,
      })
    )?.statusStrip.durationLabel,
  ).toBe('1h');
});


test('thread pagination includes prior chapters and all added facial reactions validate end to end', async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const chapterId = await ctx.db.insert('reedChapters', { threadId: f.threadId, profileId: f.profileId, startedAt: 100, previousChapterId: f.chapterId });
    await ctx.db.patch(f.threadId, { currentChapterId: chapterId });
    await ctx.db.insert('reedMessages', { threadId: f.threadId, chapterId, profileId: f.profileId, role: 'user', source: 'typed', status: 'sent', content: 'New moment', createdAt: 100 });
  });
  for (const reaction of ['😐', '😠', '😞', '😊', '🙄'] as const) {
    await f.viewer.mutation(api.reed.setMessageReaction, { messageId: f.responseId, reaction });
    const page = await f.viewer.query(api.reed.listMessagesPaginated, { paginationOpts: { cursor: null, numItems: 30 } });
    expect(page.page.some(row => row.content === 'New moment')).toBe(true);
    expect(page.page.find(row => row._id === f.responseId)?.reaction).toBe(reaction);
  }
});

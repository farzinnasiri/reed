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
  const ids = await t.run(async ctx => {
    const profileId = await ctx.db.insert('profiles', { authUserId: 'test|viewer', email: 'viewer@example.test', updatedAt: 1 });
    const threadId = await ctx.db.insert('reedThreads', { profileId, status: 'active', createdAt: 1, updatedAt: 1 });
    const otherThreadId = await ctx.db.insert('reedThreads', { profileId, status: 'archived', createdAt: 2, updatedAt: 2 });
    const userMessageId = await ctx.db.insert('reedMessages', { profileId, threadId, role: 'user', source: 'typed', content: 'Synthetic question.', status: 'sent', createdAt: 3 });
    const assistantMessageId = await ctx.db.insert('reedMessages', { profileId, threadId, role: 'assistant', source: 'system', content: '', status: 'pending', createdAt: 4 });
    return { profileId, threadId, otherThreadId, userMessageId, assistantMessageId };
  });
  const viewer = t.withIdentity({ subject: 'viewer', issuer: 'test', tokenIdentifier: 'test|viewer', email: 'viewer@example.test' });
  return { t, viewer, ...ids };
}

test('recovery is pushed through the existing authenticated message query and cleared on completion', async () => {
  const f = await fixture();
  await expect(f.t.query(api.reed.listMessagesPaginated, { paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow('Not authenticated');
  await expect(f.t.mutation(internal.reed.markAssistantRecovery, { assistantMessageId: f.assistantMessageId, threadId: f.otherThreadId, phase: 'retrying' })).rejects.toThrow('not found in thread');
  await f.t.mutation(internal.reed.markAssistantRecovery, { assistantMessageId: f.assistantMessageId, threadId: f.threadId, phase: 'retrying' });
  const page = await f.viewer.query(api.reed.listMessagesPaginated, { paginationOpts: { numItems: 10, cursor: null } });
  expect(page.page.find(row => row._id === f.assistantMessageId)).toMatchObject({ content: '', status: 'pending', replyRecovery: 'retrying' });
  await f.t.mutation(internal.reed.markAssistantRecovery, { assistantMessageId: f.assistantMessageId, threadId: f.threadId, phase: 'backup' });
  await f.t.mutation(internal.reed.completeAssistantMessage, { assistantMessageId: f.assistantMessageId, threadId: f.threadId, userMessageId: f.userMessageId, content: 'Recovered reply.', completedAt: 5, reentryState: 'hot' });
  const row = await f.t.run(ctx => ctx.db.get(f.assistantMessageId));
  expect(row).toMatchObject({ content: 'Recovered reply.', status: 'sent' });
  expect(row?.replyRecovery).toBeUndefined();
  await f.t.mutation(internal.reed.markAssistantRecovery, { assistantMessageId: f.assistantMessageId, threadId: f.threadId, phase: 'retrying' });
  expect((await f.t.run(ctx => ctx.db.get(f.assistantMessageId)))?.replyRecovery).toBeUndefined();
  expect(await f.t.run(ctx => ctx.db.query('reedMessages').take(10))).toHaveLength(2);
});

test('exhaustion shows the chat error and a manual retry clears recovery while reusing the same row', async () => {
  const f = await fixture();
  await f.t.mutation(internal.reed.markAssistantRecovery, { assistantMessageId: f.assistantMessageId, threadId: f.threadId, phase: 'backup' });
  await f.t.mutation(internal.reed.failAssistantMessage, { assistantMessageId: f.assistantMessageId, failedAt: 5, error: 'Synthetic failure.' });
  const failed = await f.t.run(ctx => ctx.db.get(f.assistantMessageId));
  expect(failed).toMatchObject({ status: 'failed', content: 'I hit a system issue while thinking. Try again in a moment.' });
  expect(failed?.replyRecovery).toBeUndefined();
  const retry = await f.viewer.mutation(api.reed.retryAssistantMessage, { assistantMessageId: f.assistantMessageId, clientNow: 6 });
  expect(retry).toEqual({ assistantMessageId: f.assistantMessageId, status: 'pending' });
  const pending = await f.t.run(ctx => ctx.db.get(f.assistantMessageId));
  expect(pending).toMatchObject({ status: 'pending', content: '' });
  expect(pending?.replyRecovery).toBeUndefined();
  expect(pending?.error).toBeUndefined();
  expect(await f.t.run(ctx => ctx.db.query('reedMessages').take(10))).toHaveLength(2);
});

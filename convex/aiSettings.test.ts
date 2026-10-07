/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema from './schema';
import { api, internal } from './_generated/api';
const modules = import.meta.glob('./**/*.ts');

test('settings remain auth gated and updates atomically replace one global record', async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.aiSettings.get, {})).rejects.toThrow('Not authenticated');
  await t.run(ctx => ctx.db.insert('profiles', { authUserId: 'test|viewer', email: 'viewer@example.test', updatedAt: 1 }));
  const viewer = t.withIdentity({ subject: 'viewer', issuer: 'test', tokenIdentifier: 'test|viewer', email: 'viewer@example.test' });
  expect((await viewer.query(api.aiSettings.get, {})).coachReply.model).toBe('z-ai/glm-5.3-flash');
  expect((await viewer.query(api.aiSettings.get, {})).coachReplyBackup.model).toBe('deepseek/deepseek-v4.1-flash');
  await t.mutation(internal.aiSettings.setCoachReply, { model: 'deepseek/deepseek-v4.1-flash', expectedRevision: 0 });
  await expect(t.mutation(internal.aiSettings.setCoachReply, { model: 'minimax/minimax-m3', expectedRevision: 0 })).rejects.toThrow('Settings changed');
  const next = await t.mutation(internal.aiSettings.setCoachReply, { model: 'minimax/minimax-m3', expectedRevision: 1 });
  expect(next.revision).toBe(2);
  expect(next.coachReply.reasoning).toEqual({ mode: 'native' });
  expect(next.coachReplyBackup.model).toBe('z-ai/glm-5.3-flash');
  await expect(t.mutation(internal.aiSettings.setCoachReply, { model: 'minimax/minimax-m3', backupModel: 'minimax/minimax-m3' })).rejects.toThrow('different coach model');
  expect(await viewer.query(api.aiSettings.get, {})).toEqual(next);
  expect(await t.run(ctx => ctx.db.query('globalSettings').take(2))).toHaveLength(1);
});

test('existing settings resolve a backup without migration and explicit backups retain their reasoning contract', async () => {
  const t = convexTest(schema, modules);
  const { coachReplyPreset } = await import('./aiSettingsValues');
  await t.run(ctx => ctx.db.insert('globalSettings', { key: 'global', coachReply: coachReplyPreset('z-ai/glm-5.3-flash'), revision: 3, updatedAt: 1 }));
  expect((await t.query(internal.aiSettings.load, {})).coachReplyBackup.model).toBe('deepseek/deepseek-v4.1-flash');
  const next = await t.mutation(internal.aiSettings.setCoachReply, { model: 'z-ai/glm-5.3-flash', backupModel: 'minimax/minimax-m3', expectedRevision: 3 });
  expect(next.coachReplyBackup.reasoning).toEqual({ mode: 'native' });
  const changed = await t.mutation(internal.aiSettings.setCoachReply, { model: 'deepseek/deepseek-v4.1-flash', expectedRevision: 4 });
  expect(changed.coachReplyBackup).toEqual(next.coachReplyBackup);
  await expect(t.mutation(internal.aiSettings.setCoachReply, { model: 'deepseek/deepseek-v4.1-flash', backupModel: 'minimax/minimax-m3', backupSettings: coachReplyPreset('z-ai/glm-5.3-flash') })).rejects.toThrow('must agree');
});

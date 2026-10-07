import assert from 'node:assert/strict';
import test from 'node:test';
import type { RegisteredQuery, RegisteredMutation } from 'convex/server';
import type { Doc, Id } from '../convex/_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../convex/_generated/server';
import { loadProfileTimeZone, resolveProfileTimeZone, validProfileTimeZone } from '../convex/profileTimeZone';
import { updateTimeZone } from '../convex/profiles';
import { backfillProfileTimeZone } from '../convex/profileTimeZoneMigrations';
import { getOrCreateNotificationPreferences, isInsideNotificationQuietHours, updatePreferences, viewerPreferences } from '../convex/notificationPreferences';
import { claimDueIntents } from '../convex/notificationIntents';
import { runContextTools } from '../convex/reedContextTools';
import { create as createTarget } from '../convex/trainingTargets';

function handler<Visibility extends 'public' | 'internal', Args extends Record<string, unknown>, Result>(
  fn: RegisteredQuery<Visibility, Args, Result> | RegisteredMutation<Visibility, Args, Result>,
) {
  return (fn as unknown as { _handler: (ctx: QueryCtx | MutationCtx, args: Args) => Result })._handler;
}

const profileId = 'profile' as Id<'profiles'>;
function profile(id = profileId, timeZone?: string): Doc<'profiles'> {
  return { _id: id, _creationTime: 1, authUserId: `issuer|${id}`, email: 'test@example.com', updatedAt: 1, timeZone };
}

function fixture(profiles: Doc<'profiles'>[], preferences: Array<Record<string, unknown>> = []) {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = { profiles, notificationPreferences: preferences };
  const patches: Array<{ id: string; values: Row }> = [];
  const scheduled: unknown[] = [];
  const rangeStarts: number[] = [];
  let preferenceReads = 0;
  const ctx = {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: 'issuer|profile', email: 'test@example.com' }) },
    scheduler: { runAfter: async (...args: unknown[]) => { scheduled.push(args); } },
    db: {
      get: async (id: string) => Object.values(tables).flat().find(row => row._id === id) ?? null,
      patch: async (id: string, values: Row) => {
        const row = Object.values(tables).flat().find(row => row._id === id);
        assert.ok(row);
        patches.push({ id, values });
        for (const [key, value] of Object.entries(values)) {
          if (value === undefined) delete row[key];
          else row[key] = value;
        }
      },
      insert: async (table: string, values: Row) => {
        const id = `${table}-new`;
        (tables[table] ??= []).push({ ...values, _id: id });
        return id;
      },
      query(table: string) {
        if (table === 'notificationPreferences') preferenceReads++;
        let rows = tables[table] ?? [];
        const index = {
          eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return index; },
          gte(key: string, value: number) { rangeStarts.push(value); rows = rows.filter(row => Number(row[key]) >= value); return index; },
          lte(key: string, value: number) { rows = rows.filter(row => Number(row[key]) <= value); return index; },
        };
        const query = {
          withIndex(_name: string, range: (builder: typeof index) => unknown) { range(index); return query; },
          order(_direction: string) { return query; },
          unique: async () => rows[0] ?? null,
          first: async () => rows[0] ?? null,
          collect: async () => rows,
          take: async (limit: number) => rows.slice(0, limit),
          paginate: async (opts: { cursor: string | null; numItems: number }) => {
            assert.equal(opts.numItems, 100);
            const offset = opts.cursor === null ? 0 : Number(opts.cursor);
            return { page: rows.slice(offset, offset + 100), continueCursor: String(offset + 100), isDone: offset + 100 >= rows.length };
          },
        };
        return query;
      },
    },
  } as unknown as MutationCtx;
  return { ctx, tables, patches, scheduled, rangeStarts, preferenceReads: () => preferenceReads };
}

function preference(timeZone?: string) {
  return { _id: 'prefs', profileId, timeZone, updatedAt: 1, enabled: true,
    coachCatchups: true, digests: true, reminders: true, rewards: true,
    maxPerDay: 3, minGapMinutes: 120, quietHoursStart: '21:00', quietHoursEnd: '07:00' };
}

test('timezone resolution prefers valid profile data, then legacy preferences, then UTC', async () => {
  assert.equal(resolveProfileTimeZone('Europe/Rome', 'America/Los_Angeles'), 'Europe/Rome');
  assert.equal(resolveProfileTimeZone('UTC', 'Europe/Rome'), 'UTC');
  assert.equal(resolveProfileTimeZone(undefined, 'Europe/Rome'), 'Europe/Rome');
  assert.equal(resolveProfileTimeZone('Invalid/Zone', 'Europe/Rome'), 'Europe/Rome');
  assert.equal(resolveProfileTimeZone(undefined, 'Invalid/Zone'), 'UTC');
  assert.equal(resolveProfileTimeZone(), 'UTC');
  assert.equal(validProfileTimeZone('US/Pacific'), 'America/Los_Angeles');
  for (const invalid of ['', ' ', '+05:30', 'Invalid/Zone', 'a'.repeat(81)]) assert.equal(validProfileTimeZone(invalid), undefined);
  const f = fixture([profile(profileId, 'Europe/Rome')], [preference('America/Los_Angeles')]);
  assert.equal(await loadProfileTimeZone(f.ctx, profileId), 'Europe/Rome');
  assert.equal(f.preferenceReads(), 0);
  delete f.tables.profiles[0].timeZone;
  assert.equal(await loadProfileTimeZone(f.ctx, profileId), 'America/Los_Angeles');
});

test('authenticated timezone sync writes only a changed owned profile and leaves settings untouched', async t => {
  t.mock.method(Date, 'now', () => 100);
  const owner = { ...profile(), onboardingCompletedAt: 1, onboardingVersion: 2 as const };
  const victim = profile('other' as Id<'profiles'>, 'Pacific/Auckland');
  const f = fixture([owner, victim], [preference('UTC')]);
  assert.equal(await handler(updateTimeZone)(f.ctx, { timeZone: 'Europe/Rome' }), null);
  assert.equal(owner.timeZone, 'Europe/Rome');
  assert.equal(owner.updatedAt, 100);
  assert.equal(f.patches.length, 1);
  assert.equal(f.scheduled.length, 2);
  assert.equal(f.tables.notificationPreferences[0].timeZone, 'UTC');
  assert.equal(victim.timeZone, 'Pacific/Auckland');
  await handler(updateTimeZone)(f.ctx, { timeZone: 'Europe/Rome' });
  assert.equal(f.patches.length, 1);
  assert.equal(f.scheduled.length, 2);
  for (const timeZone of ['', 'Invalid/Zone', '+05:30']) {
    await assert.rejects(async () => handler(updateTimeZone)(f.ctx, { timeZone }), /valid IANA/);
  }
  assert.equal(f.patches.length, 1);
});

test('UTC is stored on first sync; equivalent IANA aliases are no-ops; onboarding is not required', async () => {
  const owner = profile();
  const f = fixture([owner]);
  await handler(updateTimeZone)(f.ctx, { timeZone: 'UTC' });
  assert.equal(owner.timeZone, 'UTC');
  assert.equal(f.patches.length, 1);
  assert.equal(f.scheduled.length, 0);
  assert.equal(f.tables.notificationPreferences.length, 0);
  await handler(updateTimeZone)(f.ctx, { timeZone: 'Etc/UTC' });
  assert.equal(f.patches.length, 1);
  await handler(updateTimeZone)(f.ctx, { timeZone: 'US/Pacific' });
  assert.equal(owner.timeZone, 'America/Los_Angeles');
  await handler(updateTimeZone)(f.ctx, { timeZone: 'America/Los_Angeles' });
  assert.equal(f.patches.length, 2);
});

test('notification quiet hours and viewer settings use the profile, not a stale legacy copy', async () => {
  const f = fixture([profile(profileId, 'Europe/Rome')], [preference('America/Los_Angeles')]);
  const now = Date.parse('2026-10-01T00:30:00Z');
  const preferences = await getOrCreateNotificationPreferences(f.ctx, profileId, now);
  assert.ok(preferences);
  assert.equal(preferences.timeZone, 'Europe/Rome');
  assert.equal(isInsideNotificationQuietHours(now, preferences), true);
  assert.equal((await handler(viewerPreferences)(f.ctx, {}))?.timeZone, 'Europe/Rome');
  f.tables.notificationIntents = [{ _id: 'intent', profileId, status: 'pending', scheduledFor: now, kind: 'coach_catchup' }];
  assert.deepEqual(await handler(claimDueIntents)(f.ctx, { now }), []);
  assert.equal(f.tables.notificationIntents[0].status, 'pending');
  assert.equal(f.tables.notificationIntents[0].scheduledFor, now + 30 * 60_000);
  assert.equal(f.tables.notificationPreferences[0].timeZone, 'America/Los_Angeles');
  assert.equal(isInsideNotificationQuietHours(Date.parse('2026-10-01T22:30:00Z'), {
    timeZone: 'Europe/Rome', quietHoursStart: '00:00', quietHoursEnd: '01:00',
  }), true);
});

test('legacy preference writes route timezone to the profile; a legacy clear cannot erase it', async () => {
  const owner = profile(profileId, 'Europe/Rome');
  const f = fixture([owner], [preference('UTC')]);
  await handler(updatePreferences)(f.ctx, { timeZone: 'America/Los_Angeles' });
  assert.equal(owner.timeZone, 'America/Los_Angeles');
  assert.equal(f.tables.notificationPreferences[0].timeZone, 'UTC');
  await handler(updatePreferences)(f.ctx, { timeZone: null });
  assert.equal(owner.timeZone, 'America/Los_Angeles');
  assert.equal('timeZone' in f.tables.notificationPreferences[0], false);
  assert.equal((await handler(viewerPreferences)(f.ctx, {}))?.timeZone, 'America/Los_Angeles');
});

test('profile timezone backfill is paged, preserves existing zones and other fields, and is idempotent', async () => {
  const rows = Array.from({ length: 101 }, (_, i) => profile(`p${i}` as Id<'profiles'>));
  rows[0].timeZone = 'Pacific/Auckland';
  const preferences = rows.map((row, i) => ({ ...preference(), _id: `prefs${i}`, profileId: row._id, timeZone: i === 1 ? 'Invalid/Zone' : 'Europe/Rome' }));
  const f = fixture(rows, preferences);
  const first = await handler(backfillProfileTimeZone)(f.ctx, { cursor: null });
  assert.deepEqual(first, { cursor: '100', isDone: false, scanned: 100, updated: 98 });
  assert.deepEqual(await handler(backfillProfileTimeZone)(f.ctx, { cursor: first.cursor }),
    { cursor: '200', isDone: true, scanned: 1, updated: 1 });
  assert.equal(rows[0].timeZone, 'Pacific/Auckland');
  assert.equal(rows[1].timeZone, undefined);
  assert.equal(rows[100].timeZone, 'Europe/Rome');
  assert.ok(rows.every(row => row.updatedAt === 1));
  assert.ok(f.patches.every(patch => Object.keys(patch.values).join() === 'timeZone'));
  assert.equal((await handler(backfillProfileTimeZone)(f.ctx, { cursor: null })).updated, 0);
  assert.equal((await handler(backfillProfileTimeZone)(f.ctx, { cursor: first.cursor })).updated, 0);
  assert.equal(f.scheduled.length, 0);
});

test('Reed context ranges use the profile calendar even when the old client timezone differs', async () => {
  const f = fixture([profile(profileId, 'Europe/Rome')], [preference('America/Los_Angeles')]);
  const blocks = await handler(runContextTools)(f.ctx, {
    profileId, clientNow: Date.parse('2026-10-04T23:30:00Z'), clientTimeZone: 'America/Los_Angeles',
    calls: [{ name: 'summarize_training_window', args: { range: { preset: 'this_week' } } }],
  });
  assert.equal(blocks.length, 1);
  assert.deepEqual(f.rangeStarts, [Date.parse('2026-10-04T22:00:00Z'), Date.parse('2026-10-04T22:00:00Z')]);
});

test('new goals default to the profile calendar and preserve an explicitly chosen goal calendar', async () => {
  const args = {
    endsAt: Date.now() + 7 * 24 * 60 * 60_000,
    title: 'Train twice', previewText: 'Two sessions',
    rule: { cadence: 'total' as const, metricKind: 'sessionCount' as const,
      exerciseCatalogId: null, threshold: 2, thresholdUnit: 'sessions' },
  };
  const f = fixture([profile(profileId, 'Europe/Rome')], [preference('America/Los_Angeles')]);
  assert.equal((await handler(createTarget)(f.ctx, args))?.timeZone, 'Europe/Rome');
  // Each fixture represents an independent creation, so IDs cannot collide.
  const other = fixture([profile(profileId, 'Europe/Rome')]);
  assert.equal((await handler(createTarget)(other.ctx, { ...args, timeZone: 'Pacific/Auckland' }))?.timeZone, 'Pacific/Auckland');
});

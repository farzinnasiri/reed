import { onboardingAnswers } from './helpers/onboarding-fixture';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { RegisteredQuery, RegisteredMutation } from 'convex/server';
import type { QueryCtx } from '../convex/_generated/server';
import type { MutationCtx } from '../convex/_generated/server';
import { getPulse } from '../convex/home';
import { getConsistency } from '../convex/trainingKnowledge';
import { localDayBounds, localDayNumber, localWeekDayNumbers } from '../convex/homeTime';
import { formatReedTimelineTime, resolveReedTimeRange } from '../convex/reedContextTime';
import { getConsistencyWindow, summarizeConsistency } from '../domains/trainingKnowledge/consistency';
import { resolveWeeklyActiveDaysTarget } from '../convex/weeklyTrainingTarget';

// Convex exposes _handler at runtime but omits it from the installed public
// type declarations. Keep this test-only bridge typed to each function's args.
function handler<Args extends Record<string, unknown>, Result>(
  fn: RegisteredQuery<'public', Args, Result> | RegisteredMutation<'internal', Args, Result>,
) {
  return (fn as unknown as { _handler: (ctx: QueryCtx | MutationCtx, args: Args) => Result })._handler;
}

const at = Date.parse;
const DAY_MS = 86_400_000;

// An indexed in-memory reader exercises the registered handlers together,
// including ownership, timezone source and the per-day volume bound.
function reader(timeZone: string, loggedAts: number[], weeklyActiveDaysTarget?: number) {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {
    profiles: [{ _id: 'profile', authUserId: 'issuer|subject', email: 'test@example.com' }],
    trainingProfiles: [{ profileId: 'profile', onboarding: onboardingAnswers(weeklyActiveDaysTarget === undefined ? {} : { days: Array.from({ length: 7 }, (_, i) => i < weeklyActiveDaysTarget ? 'fixed' : 'off') }) }],
    notificationPreferences: [{ profileId: 'profile', timeZone }],
    activityLogs: loggedAts.map(loggedAt => ({ profileId: 'profile', loggedAt })),
  };
  const requestedLimits: number[] = [];
  const ctx = {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: 'issuer|subject', email: 'test@example.com' }) },
    db: {
      get: async (id: string) => tables.profiles.find(row => row._id === id) ?? null,
      query(table: string) {
        let rows = tables[table] ?? [];
        const indexed = {
          eq(field: string, value: unknown) { rows = rows.filter(row => row[field] === value); return indexed; },
          gte(field: string, value: number) { rows = rows.filter(row => Number(row[field]) >= value); return indexed; },
          lt(field: string, value: number) { rows = rows.filter(row => Number(row[field]) < value); return indexed; },
        };
        const query = {
          withIndex(_name: string, range: (index: typeof indexed) => unknown) { range(indexed); return query; },
          order(_direction: string) { return query; },
          async unique() { return rows[0] ?? null; },
          async first() { return rows[0] ?? null; },
          async take(limit: number) { requestedLimits.push(limit); return rows.slice(0, limit); },
        };
        return query;
      },
    },
  } as unknown as QueryCtx;
  return { ctx, requestedLimits };
}

test('Pulse, Consistency and Reed agree at local week boundaries and DST', async t => {
  for (const [timeZone, instant] of [
    ['Europe/Rome', '2026-10-04T23:30:00Z'],
    ['America/Los_Angeles', '2026-10-05T00:30:00Z'],
    ['Europe/Rome', '2026-03-29T20:30:00Z'],
    ['Europe/Rome', '2026-10-25T21:30:00Z'],
    ['Pacific/Auckland', '2026-12-31T23:30:00Z'],
    ['America/Sao_Paulo', '2018-11-04T12:00:00Z'],
    ['Africa/Cairo', '2026-04-24T12:00:00Z'],
  ]) {
    const now = at(instant);
    t.mock.method(Date, 'now', () => now);
    const days = localWeekDayNumbers(now, timeZone);
    const firstDay = localDayBounds(days[0], timeZone);
    const loggedAts = [firstDay.startAt - 1, firstDay.startAt, firstDay.startAt + 1000,
      localDayBounds(days[1], timeZone).startAt, now, now + 1];
    const { ctx } = reader(timeZone, loggedAts, 5);
    const [pulse, consistency] = await Promise.all([
      handler(getPulse)(ctx, { now }), handler(getConsistency)(ctx, { now }),
    ]);
    assert.equal(consistency.currentWeek.weekStartAt, firstDay.startAt);
    assert.equal(consistency.currentWeek.activeDays, pulse.week.count);
    assert.equal(consistency.currentWeek.targetActiveDays, pulse.week.target);
    assert.deepEqual(consistency.weekGrid.at(-1)?.days.map(day => day.active), pulse.week.days.map(day => day === 'done'));
    assert.equal(consistency.weekGrid.length, 12);
    assert.ok(consistency.weekGrid.every(week => week.days.length === 7));
    const reedWeek = resolveReedTimeRange({ now, timeZone, range: { preset: 'this_week' } });
    assert.equal(reedWeek.startAt, consistency.currentWeek.weekStartAt);
    assert.equal(reedWeek.endAt + 1, consistency.currentWeek.weekEndAt);
    t.mock.restoreAll();
  }
});

test('day bounds select the first instant across midnight gaps, folds and skipped dates', () => {
  for (const [zone, date, expectedStart, expectedHours] of [
    ['America/Sao_Paulo', '2018-11-04', '2018-11-04T03:00:00Z', 23],
    ['Africa/Cairo', '2026-04-24', '2026-04-23T22:00:00Z', 23],
    ['America/Havana', '2026-11-01', '2026-11-01T04:00:00Z', 25],
    ['Pacific/Apia', '2011-12-30', '2011-12-30T10:00:00Z', 0],
  ] as const) {
    const day = at(`${date}T00:00:00Z`) / DAY_MS;
    const bounds = localDayBounds(day, zone);
    assert.equal(bounds.startAt, at(expectedStart));
    assert.equal((bounds.endAt - bounds.startAt) / 3600000, expectedHours);
    assert.ok(localDayNumber(bounds.startAt - 1, zone) < day);
    assert.ok(localDayNumber(bounds.startAt, zone) >= day);
    assert.equal(bounds.endAt, localDayBounds(day + 1, zone).startAt);
  }
});

test('a dense activity day cannot hide another active day; capped counts are explicit', async t => {
  const now = at('2026-10-01T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const monday = localDayBounds(localWeekDayNumbers(now, 'UTC')[0], 'UTC').startAt;
  const { ctx, requestedLimits } = reader('UTC', [...Array.from({ length: 2000 }, (_, i) => monday + i), monday + DAY_MS]);
  const consistency = await handler(getConsistency)(ctx, { now });
  const pulse = await handler(getPulse)(ctx, { now });
  assert.equal(consistency.currentWeek.activeDays, 2);
  assert.equal(pulse.week.count, 2);
  assert.equal(pulse.week.target, 3);
  assert.equal(consistency.currentWeek.isOnTarget, false);
  assert.equal(consistency.currentWeek.remainingActiveDays, 1);
  assert.equal(consistency.weekGrid.at(-1)?.days[0].activityCount, 128);
  assert.equal(consistency.weekGrid.at(-1)?.days[0].activityCountIsCapped, true);
  assert.ok(requestedLimits.every(limit => limit <= 129));
});

test('invalid timezone falls back to UTC and optional old arguments remain compatible', async t => {
  const now = at('2026-10-01T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const { ctx } = reader('Invalid/Zone', [now]);
  const current = await handler(getConsistency)(ctx, { now });
  assert.deepEqual(await handler(getConsistency)(ctx, {}), current);
  assert.deepEqual(await handler(getConsistency)(ctx, { now: now - 37 * 60 * 60 * 1000 }), current);
  assert.deepEqual(await handler(getConsistency)(ctx, { now: NaN }), current);
  assert.equal(current.currentWeek.weekStartAt, at('2026-09-28T00:00:00Z'));
});

test('calendar grid has contiguous dates across 23-hour and 25-hour days', () => {
  for (const [date, expectedHours] of [['2026-03-29T12:00:00Z', 23], ['2026-10-25T12:00:00Z', 25]] as const) {
    const now = at(date);
    const timeZone = 'Europe/Rome';
    const grid = summarizeConsistency({ now, timeZone, loggedAts: [now, now + 1], }).weekGrid;
    const days = grid.flatMap(week => week.days);
    assert.equal(days.length, 84);
    assert.equal(new Set(days.map(day => day.date)).size, 84);
    const day = days.find(day => day.date === date.slice(0, 10))!;
    const bounds = localDayBounds(localDayNumber(now, timeZone), timeZone);
    assert.equal((bounds.endAt - bounds.startAt) / 3_600_000, expectedHours);
    assert.equal(day.activityCount, 1);
    assert.equal(getConsistencyWindow(now, timeZone).gridEndAt, bounds.endAt);
  }
});

test('weekly goals use valid exact active days and no lower-bound tolerance', () => {
  for (let goal = 1; goal <= 7; goal++) assert.equal(resolveWeeklyActiveDaysTarget({ weeklyActiveDaysTarget: goal }), goal);
  for (const invalid of [0, 8, 2.5, NaN, Infinity]) assert.equal(resolveWeeklyActiveDaysTarget({ weeklyActiveDaysTarget: invalid }), null);
  assert.equal(resolveWeeklyActiveDaysTarget({}), null);
  const now = at('2026-10-01T12:00:00Z');
  const result = summarizeConsistency({ now, timeZone: 'UTC', weeklyActiveDaysTarget: 4,
    loggedAts: [at('2026-09-28T12:00:00Z'), at('2026-09-29T12:00:00Z'), at('2026-09-30T12:00:00Z')] });
  assert.equal(result.currentWeek.isOnTarget, false);
  assert.equal(result.currentWeek.remainingActiveDays, 1);
  assert.equal(result.target?.label, '4 days/week');
});

test('Reed ranges and yesterday labels use calendar days across DST', () => {
  const now = at('2026-03-29T21:30:00Z'); // Sunday 23:30 after the clock change.
  const timeZone = 'Europe/Rome';
  const today = resolveReedTimeRange({ now, timeZone, range: { preset: 'today' } });
  assert.equal(today.startAt, at('2026-03-28T23:00:00Z'));
  assert.equal(today.endAt + 1, at('2026-03-29T22:00:00Z'));
  const yesterday = resolveReedTimeRange({ now, timeZone, range: { preset: 'yesterday' } });
  assert.equal(yesterday.endAt + 1, today.startAt);
  assert.match(formatReedTimelineTime({ now, timeZone, timestamp: at('2026-03-28T22:45:00Z') }), /^Yesterday /);
  const lastWeek = resolveReedTimeRange({ now: at('2026-03-30T12:00:00Z'), timeZone, range: { preset: 'last_week' } });
  assert.equal(lastWeek.startAt, at('2026-03-22T23:00:00Z'));
  assert.equal(lastWeek.endAt + 1, at('2026-03-29T22:00:00Z'));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveTodayCards, selectTodayPresetKeys } from '../convex/homeTodayCards';
import { HOME_CLOCK_MAX_SKEW_MS, localDayBounds, localDayNumber, localWeekDayNumbers, resolveHomeNow } from '../convex/homeTime';

const at = (date: string) => Date.parse(date);
const base = {
  now: at('2026-10-01T11:59:00Z'),
  timeZone: 'UTC',
  bodyweight: { latestKg: 80, loggedAt: at('2026-09-28T23:59:00Z') },
  activityCounts: [0, 0, 0],
  presetKeys: ['walk'],
};

test('home accepts client time through 36 hours of skew and falls back beyond it', () => {
  for (const offset of [-HOME_CLOCK_MAX_SKEW_MS, -300_000, 0, 300_000, HOME_CLOCK_MAX_SKEW_MS]) {
    assert.equal(resolveHomeNow(base.now + offset, base.now), base.now + offset);
  }
  for (const requested of [base.now - HOME_CLOCK_MAX_SKEW_MS - 1, base.now + HOME_CLOCK_MAX_SKEW_MS + 1, NaN, Infinity]) {
    assert.equal(resolveHomeNow(requested, base.now), base.now);
  }
});

test('five-minute client-time changes move the day marker and expire weigh-in at noon', () => {
  const serverNow = at('2026-10-01T11:50:00Z');
  const beforeNoon = resolveHomeNow(at('2026-10-01T11:55:00Z'), serverNow);
  const noon = resolveHomeNow(at('2026-10-01T12:00:00Z'), serverNow);
  assert.equal(deriveTodayCards({ ...base, now: beforeNoon }).length, 1);
  assert.equal(deriveTodayCards({ ...base, now: noon }).length, 0);
  const beforeMidnight = resolveHomeNow(at('2026-10-01T23:55:00Z'), serverNow);
  const midnight = resolveHomeNow(at('2026-10-02T00:00:00Z'), serverNow);
  assert.equal(localDayNumber(midnight), localDayNumber(beforeMidnight) + 1);
});

test('weigh-in ends exactly at local noon', () => {
  assert.deepEqual(deriveTodayCards(base), [{
    kind: 'weigh_in', lastKg: 80, lastLoggedAt: base.bodyweight.loggedAt,
    reason: 'Weigh-ins are best before breakfast',
  }]);
  assert.deepEqual(deriveTodayCards({ ...base, now: at('2026-10-01T12:00:00Z') }), []);
});

test('weigh-in uses calendar days, with the boundary at three days', () => {
  assert.equal(deriveTodayCards({ ...base, bodyweight: { latestKg: 80, loggedAt: at('2026-09-29T00:00:00Z') } }).length, 0);
  assert.equal(deriveTodayCards(base).length, 1);
  assert.equal(deriveTodayCards({ ...base, bodyweight: { latestKg: 80, loggedAt: base.now } }).length, 0);
});

test('never logged offers a weigh-in only before noon', () => {
  assert.deepEqual(deriveTodayCards({ ...base, bodyweight: null }), [{
    kind: 'weigh_in', lastKg: null, lastLoggedAt: null, reason: 'Weigh-ins are best before breakfast',
  }]);
  assert.deepEqual(deriveTodayCards({ ...base, bodyweight: null, now: at('2026-10-01T12:00:00Z') }), []);
});

test('timezone near midnight changes log age and the local morning window', () => {
  const input = { ...base, now: at('2026-10-01T00:30:00Z'), bodyweight: { latestKg: 80, loggedAt: at('2026-09-28T01:00:00Z') } };
  assert.equal(deriveTodayCards({ ...input, timeZone: 'Europe/Rome' }).length, 1);
  assert.equal(deriveTodayCards({ ...input, timeZone: 'America/Los_Angeles' }).length, 0);
  assert.equal(deriveTodayCards({ ...input, timeZone: 'Pacific/Auckland', bodyweight: null }).length, 0);
});

test('quick-log requires two consecutive preceding training days and an empty today', () => {
  const input = { ...base, now: at('2026-10-01T13:00:00Z'), activityCounts: [0, 1, 20] };
  assert.deepEqual(deriveTodayCards(input), [{ kind: 'quick_log', presetKeys: ['walk'], reason: 'Logs straight to today' }]);
  for (const activityCounts of [[1, 1, 1], [0, 1, 0], [0, 0, 1], [0, 1]]) {
    assert.deepEqual(deriveTodayCards({ ...input, activityCounts }), []);
  }
});

test('cards remain ordered and preset payloads stay bounded', () => {
  const cards = deriveTodayCards({ ...base, activityCounts: [0, 1, 1], presetKeys: ['a', 'b', 'c', 'd', 'e', 'f'] });
  assert.deepEqual(cards.map(card => card.kind), ['weigh_in', 'quick_log']);
  assert.equal(cards[1].kind === 'quick_log' && cards[1].presetKeys.length, 5);
});

test('preset selection ranks used cardio/recovery presets and pads with enabled defaults', () => {
  const presets = [
    { key: 'walk', group: 'cardio' as const, count: 3, sortOrder: 100 },
    { key: 'run', group: 'cardio' as const, count: 10, sortOrder: 110 },
    { key: 'cycle', group: 'cardio' as const, count: 0, sortOrder: 120 },
    { key: 'mobility', group: 'recovery' as const, count: 10, sortOrder: 200 },
    { key: 'stretching', group: 'recovery' as const, count: 0, sortOrder: 210 },
    { key: 'pull_ups', group: 'strength' as const, count: 500, sortOrder: 20 },
  ];
  assert.deepEqual(selectTodayPresetKeys(presets), ['run', 'mobility', 'walk', 'stretching', 'cycle']);
  assert.deepEqual(selectTodayPresetKeys(presets.map(preset => ({ ...preset, count: 0 }))), ['walk', 'mobility', 'stretching', 'cycle', 'pull_ups']);
  assert.deepEqual(selectTodayPresetKeys(presets.filter(preset => preset.key === 'walk')), ['walk']);
  assert.deepEqual(selectTodayPresetKeys([]), []);
});

test('local weeks begin Monday and local midnight is exact near UTC midnight', () => {
  const now = at('2026-10-04T23:30:00Z');
  const days = localWeekDayNumbers(now, 'Europe/Rome');
  assert.equal(days.length, 7);
  assert.equal(localDayNumber(now, 'Europe/Rome'), days[0]);
  assert.deepEqual(localDayBounds(days[0], 'Europe/Rome'), { startAt: at('2026-10-04T22:00:00Z'), endAt: at('2026-10-05T22:00:00Z') });
});

test('local-day bounds handle both daylight-saving transitions', () => {
  const spring = localDayNumber(at('2026-03-29T12:00:00Z'), 'Europe/Rome');
  const fall = localDayNumber(at('2026-10-25T12:00:00Z'), 'Europe/Rome');
  assert.deepEqual(localDayBounds(spring, 'Europe/Rome'), { startAt: at('2026-03-28T23:00:00Z'), endAt: at('2026-03-29T22:00:00Z') });
  assert.deepEqual(localDayBounds(fall, 'Europe/Rome'), { startAt: at('2026-10-24T22:00:00Z'), endAt: at('2026-10-25T23:00:00Z') });
  assert.equal(deriveTodayCards({ ...base, now: at('2026-03-30T09:00:00Z'), timeZone: 'Europe/Rome',
    bodyweight: { latestKg: 80, loggedAt: at('2026-03-27T22:30:00Z') } }).length, 1);
});

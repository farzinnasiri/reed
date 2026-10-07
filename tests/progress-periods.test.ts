import assert from 'node:assert/strict';
import test from 'node:test';
import { getProfilePeriodRange } from '../domains/trainingKnowledge/progress-periods';
import { getLocalParts } from '../domains/time/local-calendar';

for (const date of ['2026-10-29T12:00:00Z', '2026-04-02T12:00:00Z']) {
  test(`previous week stays at local midnight after DST: ${date}`, () => {
    const range = getProfilePeriodRange('week', Date.parse(date), 'Europe/Rome');
    for (const boundary of [
      range.current.startAt,
      range.current.endAt,
      range.previous.startAt,
      range.previous.endAt,
    ]) {
      const local = getLocalParts(boundary, 'Europe/Rome');
      assert.equal(local.hour, 0);
      assert.equal(local.minute, 0);
    }
    assert.equal(range.previous.endAt, range.current.startAt);
  });
}

test('a new clock bucket advances rolling ranges and crossing Monday advances the week', () => {
  const a = Date.parse('2026-10-04T21:55:00Z');
  const b = a + 5 * 60 * 1000;
  assert.equal(
    getProfilePeriodRange('30d', b, 'Europe/Rome').current.endAt -
      getProfilePeriodRange('30d', a, 'Europe/Rome').current.endAt,
    300000,
  );
  assert.notEqual(
    getProfilePeriodRange('week', a, 'Europe/Rome').current.startAt,
    getProfilePeriodRange('week', b, 'Europe/Rome').current.startAt,
  );
});

test('rolling Progress ranges include new records within the current bucket', () => {
  const bucket = Date.parse('2026-10-04T10:00:00Z');
  const range = getProfilePeriodRange('30d', bucket, 'UTC', 300_000);
  const newlyLoggedAt = bucket + 180_000;
  assert.ok(newlyLoggedAt >= range.current.startAt && newlyLoggedAt < range.current.endAt);
  assert.equal(range.current.startAt, range.previous.endAt);
  assert.equal(range.current.endAt - range.current.startAt, range.previous.endAt - range.previous.startAt);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestSessionDuration } from '../domains/workout/session-duration';

const MIN = 60_000;
const HOUR = 60 * MIN;

test('a session left open for hours is suggested the time its sets took', () => {
  const startedAt = 0;
  const session = { startedAt, lastSetAt: 50 * MIN };
  // 17 hours on the clock, last set after 50 minutes: 50 min plus the 2 minute tail.
  assert.equal(suggestSessionDuration(session, 17 * HOUR), 52 * 60);
  assert.equal(suggestSessionDuration({ ...session, endedAt: 17 * HOUR }, 99 * HOUR), 52 * 60);
});

test('a normal session, a chosen duration and a session without sets are left alone', () => {
  assert.equal(suggestSessionDuration({ startedAt: 0, lastSetAt: 50 * MIN }, 70 * MIN), null);
  assert.equal(suggestSessionDuration({ startedAt: 0, lastSetAt: 50 * MIN }, 90 * MIN), null, 'under the 45 minute margin');
  assert.equal(suggestSessionDuration({ startedAt: 0, lastSetAt: 50 * MIN, manualDurationSeconds: 3600 }, 17 * HOUR), null);
  assert.equal(suggestSessionDuration({ startedAt: 0, lastSetAt: null }, 17 * HOUR), null);
});

test('the suggestion is never under a minute', () => {
  assert.equal(suggestSessionDuration({ startedAt: 0, lastSetAt: 0 }, 5 * HOUR), 120);
  assert.equal(suggestSessionDuration({ startedAt: 10, lastSetAt: 0 }, 5 * HOUR), 120);
});

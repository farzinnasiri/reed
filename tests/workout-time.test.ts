import { effortLabel } from '../domains/workout/effort';
import assert from 'node:assert/strict';
import test from 'node:test';
import { getLiveCardioElapsedSeconds } from '../domains/workout/liveCardio';
import { getRestSnapshot } from '../domains/workout/rest';
import { formatElapsedCompact } from '../components/workout/workout-surface.utils';

test('compact elapsed labels retain second precision for the first minute', () => {
  assert.equal(formatElapsedCompact(0, 59_000), '59s');
  assert.equal(formatElapsedCompact(0, 60_000), '1m');
  assert.equal(formatElapsedCompact(0, 3_660_000), '1h 1m');
});

test('rest snapshots derive current remaining time from the persisted timestamp', () => {
  assert.deepEqual(
    getRestSnapshot({ durationSeconds: 90, isRunning: true, remainingSeconds: 90, startedAt: 1_000 }, 31_000),
    { durationSeconds: 90, isComplete: false, isRunning: true, remainingSeconds: 60, startedAt: 1_000 },
  );
});

test('live cardio derives elapsed time without a React root ticker', () => {
  assert.equal(
    getLiveCardioElapsedSeconds({ elapsedSeconds: 30, isRunning: true, lastResumedAt: 10_000 }, 25_000),
    45,
  );
});

// Timed work must never imply a measurable number of repetitions remaining.
test('effort describes repetition estimates separately from timed and cardio work', () => {
  assert.equal(effortLabel(8, 'strength'), '2 reps left');
  assert.equal(effortLabel(8.5, 'strength'), '1–2 reps left');
  assert.equal(effortLabel(10, 'strength'), '0 reps left');
  assert.equal(effortLabel(8, 'hold'), 'Hard');
  assert.equal(effortLabel(10, 'cardio'), 'Max effort');
});

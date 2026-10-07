import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePersonalRecords,
  detectSessionRecords,
  type ActivityRecordInput,
} from '../domains/trainingKnowledge/personalRecords';

function activity(patch: Partial<ActivityRecordInput> & Pick<ActivityRecordInput, 'metrics'>): ActivityRecordInput {
  return {
    activityLogId: 'log',
    derivedEffectiveLoadKg: null,
    exerciseCatalogId: 'exercise',
    exerciseName: 'Run',
    loggedAt: 1_000,
    profileId: 'profile',
    recipeKey: 'cardio_manual_distance_time_rpe',
    sessionId: 'session',
    warmup: false,
    ...patch,
  };
}

test('fastest distance accepts only a small overshoot past the target distance', () => {
  const exact = calculatePersonalRecords({
    activities: [activity({ metrics: { distance: 1, time: 300 } })],
  });
  assert.equal(exact.find(record => record.kind === 'fastest_1k')?.value, 300);

  const band = calculatePersonalRecords({
    activities: [activity({ metrics: { distance: 1.04, time: 312 } })],
  });
  const scaled = band.find(record => record.kind === 'fastest_1k');
  assert.ok(scaled);
  assert.ok(Math.abs((scaled?.value ?? 0) - 300) < 0.2);

  const longJog = calculatePersonalRecords({
    activities: [activity({ metrics: { distance: 10, time: 3600 } })],
  });
  assert.equal(longJog.find(record => record.kind === 'fastest_1k'), undefined);
  assert.equal(longJog.find(record => record.kind === 'fastest_5k'), undefined);
  assert.equal(longJog.find(record => record.kind === 'distance')?.value, 10);
});

test('rep best is only for unassisted bodyweight reps', () => {
  const pullUp = activity({
    exerciseName: 'Pull-up',
    recipeKey: 'bodyweight_reps',
    derivedEffectiveLoadKg: 70,
    metrics: { reps: 8 },
  });
  const loaded = activity({
    exerciseName: 'Bench press',
    recipeKey: 'standard_load',
    metrics: { load: 40, reps: 12 },
  });
  const assisted = activity({
    exerciseName: 'Assisted pull-up',
    recipeKey: 'assist_bodyweight',
    metrics: { assistLoad: 20, reps: 15 },
  });
  const unilateral = activity({
    exerciseName: 'Single-arm row',
    recipeKey: 'unilateral_load_pair',
    metrics: { leftLoad: 16, rightLoad: 16, leftReps: 10, rightReps: 10 },
  });

  assert.equal(calculatePersonalRecords({ activities: [pullUp] }).some(record => record.kind === 'rep_best'), true);
  assert.equal(calculatePersonalRecords({ activities: [loaded] }).some(record => record.kind === 'rep_best'), false);
  assert.ok(calculatePersonalRecords({ activities: [loaded] }).some(record => record.kind === 'heaviest_load'));
  assert.equal(calculatePersonalRecords({ activities: [assisted] }).some(record => record.kind === 'rep_best'), false);
  assert.equal(calculatePersonalRecords({ activities: [unilateral] }).some(record => record.kind === 'rep_best'), false);
});

test('an equal personal record is not a new session record', () => {
  const previous = activity({ activityLogId: 'old', loggedAt: 1, metrics: { reps: 8 }, recipeKey: 'bodyweight_reps', exerciseName: 'Pull-up' });
  const same = activity({ activityLogId: 'new', loggedAt: 2, metrics: { reps: 8 }, recipeKey: 'bodyweight_reps', exerciseName: 'Pull-up' });
  const better = activity({ activityLogId: 'better', loggedAt: 3, metrics: { reps: 9 }, recipeKey: 'bodyweight_reps', exerciseName: 'Pull-up' });

  assert.equal(detectSessionRecords({ historicalActivities: [previous], sessionActivities: [same] }).records.length, 0);
  assert.equal(detectSessionRecords({ historicalActivities: [previous], sessionActivities: [better] }).records[0]?.value, 9);
});

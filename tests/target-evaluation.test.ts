import assert from 'node:assert/strict';
import test from 'node:test';
import {
  displayedGoalUnit,
  evaluateTargetProgress,
  type TargetEvidenceLog,
  type TargetRule,
} from '../domains/goals/target-evaluation';

const day = 24 * 60 * 60 * 1000;
const monday = Date.UTC(2026, 0, 5, 12);

function log(id: string, loggedAt: number, metrics: Record<string, number>): TargetEvidenceLog {
  return { _id: id, loggedAt, metrics, warmup: false };
}

function rule(patch: Partial<TargetRule> & Pick<TargetRule, 'metricKind'>): TargetRule {
  return {
    cadence: 'total',
    exerciseCatalogId: patch.metricKind === 'sessionCount' || patch.metricKind === 'trainingDays' ? null : 'exercise',
    threshold: 1,
    thresholdUnit: 'units',
    ...patch,
  };
}

function evaluate(metricRule: TargetRule, logs: TargetEvidenceLog[], now = monday) {
  return evaluateTargetProgress({
    endsAt: now + 14 * day,
    rule: metricRule,
    startsAt: now - day,
    timeZone: 'UTC',
  }, logs, now);
}

test('cardio and exercise duration use manual time without adding it to side durations', () => {
  const manual = evaluate(rule({ metricKind: 'cardioDurationSeconds', threshold: 600, thresholdUnit: 'sec' }), [
    log('manual', monday, { time: 600, distance: 5 }),
  ]);
  assert.equal(manual.progressSummary.current, 600);
  assert.equal(manual.completed, true);

  const sides = evaluate(rule({ metricKind: 'exerciseTotalDurationSeconds', threshold: 90, thresholdUnit: 'sec' }), [
    log('sides', monday, { duration: 100, leftDuration: 40, rightDuration: 50, time: 999 }),
  ]);
  assert.equal(sides.progressSummary.current, 90);

  const shared = evaluate(rule({ metricKind: 'cardioDurationSeconds', threshold: 20, thresholdUnit: 'sec' }), [
    log('shared', monday, { duration: 20, time: 100 }),
  ]);
  assert.equal(shared.progressSummary.current, 20);

  const hold = evaluate(rule({ metricKind: 'exerciseBestHoldSeconds', threshold: 10, thresholdUnit: 'sec' }), [
    log('hold', monday, { time: 99 }),
  ]);
  assert.equal(hold.progressSummary.current, 0);
});

test('a distance-within-duration goal uses the same duration as a cardio-time goal', () => {
  const counted = evaluate(rule({
    metricKind: 'cardioDistanceWithinDuration',
    minDurationSeconds: 100,
    threshold: 1000,
    thresholdUnit: 'm',
  }), [log('short', monday, { time: 90, distance: 2 })]);
  assert.equal(counted.progressSummary.current, 2000);

  const excluded = evaluate(rule({
    metricKind: 'cardioDistanceWithinDuration',
    minDurationSeconds: 100,
    threshold: 1000,
    thresholdUnit: 'm',
  }), [log('long', monday, { duration: 50, leftDuration: 80, rightDuration: 40, distance: 1 })]);
  assert.equal(excluded.progressSummary.current, 0);
});

test('sessionCount and trainingDays both count local days and display days', () => {
  const logs = [
    log('a', monday, {}),
    log('b', monday + 60 * 60 * 1000, {}),
    log('c', monday + day, {}),
  ];
  for (const metricKind of ['sessionCount', 'trainingDays'] as const) {
    const result = evaluate(rule({
      cadence: 'total',
      metricKind,
      threshold: 2,
      thresholdUnit: 'sessions',
    }), logs);
    assert.equal(result.progressSummary.current, 2);
    assert.equal(result.progressSummary.requiredLabel, '2 days');
    assert.equal(displayedGoalUnit(rule({ metricKind, thresholdUnit: 'sessions' })), 'days');
  }

  const weekly = evaluate(rule({
    cadence: 'weekly',
    metricKind: 'trainingDays',
    periodCount: 2,
    threshold: 1,
    thresholdUnit: 'sessions',
  }), logs, monday);
  assert.equal(weekly.progressSummary.currentLabel, '2 / 1 days this week');
  assert.match(weekly.progressSummary.overall?.valueLabel ?? '', /weeks hit/);
});

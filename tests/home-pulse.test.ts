import assert from 'node:assert/strict';
import test from 'node:test';
import type { Doc, Id } from '../convex/_generated/dataModel';
import { selectNearestGoal } from '../convex/homePulse';

function target(id: string, current: number, required: number, patch: Partial<Doc<'trainingTargets'>> = {}): Doc<'trainingTargets'> {
  return {
    _id: id as Id<'trainingTargets'>, _creationTime: 0, profileId: 'profile' as Id<'profiles'>,
    createdAt: 0, endsAt: 100, startsAt: 0, status: 'active', title: id, previewText: id, updatedAt: 0,
    rule: { cadence: 'total', metricKind: 'exerciseTotalReps', exerciseCatalogId: 'exercise' as Id<'exerciseCatalog'>, threshold: required, thresholdUnit: 'reps' },
    progressSummary: { current, required, currentLabel: `${current} reps`, requiredLabel: `${required} reps` },
    ...patch,
  };
}

test('Pulse selects the active measurable goal with the highest displayed ratio', () => {
  assert.deepEqual(selectNearestGoal([
    target('zero', 0, 1), target('invalid', 1, 0), target('far', 20, 100),
    target('completed', 10, 10, { status: 'completed' }), target('nearest', 7, 10),
  ]), { targetId: 'nearest', label: 'nearest', current: 7, goal: 10, unit: 'reps' });
  assert.equal(selectNearestGoal([target('zero', 0, 1)]), null);
  assert.equal(selectNearestGoal([]), null);
});

test('period goals use overall progress rather than the current-period ratio', () => {
  const period = target('weekly goal', 10, 10, {
    rule: { cadence: 'weekly', metricKind: 'sessionCount', exerciseCatalogId: null, threshold: 10, thresholdUnit: 'sessions' },
    progressSummary: {
      current: 10, required: 10, currentLabel: '10 sessions', requiredLabel: '10 sessions',
      satisfiedPeriods: 1, totalPeriods: 4,
      overall: { current: 1, required: 4, label: 'Goal', valueLabel: '1 / 4 weeks hit' },
    },
  });
  assert.equal(selectNearestGoal([period, target('total', 5, 10)])?.targetId, 'total');
  assert.deepEqual(selectNearestGoal([period]), { targetId: 'weekly goal', label: 'weekly goal', current: 1, goal: 4, unit: 'weeks hit' });
  const legacy = { ...period, progressSummary: { ...period.progressSummary, overall: undefined } };
  assert.deepEqual(selectNearestGoal([legacy]), selectNearestGoal([period]));
});

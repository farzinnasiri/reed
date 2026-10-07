import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLiveSessionInsights, buildLiveSessionStatusStrip } from '../domains/workout/session-insights';

test('current-only insight data produces the live strength status strip', () => {
  const result = buildLiveSessionInsights({
    historicalEntries: [],
    logs: [{
      derivedEffectiveLoadKg: null,
      loggedAt: 10_000,
      metrics: { load: 100, reps: 5, rpe: 8 },
      recipeKey: 'standard_load',
      restSeconds: 90,
      sessionExerciseId: 'session-exercise',
      setLogId: 'set',
      setNumber: 1,
      setOutcome: null,
      warmup: false,
    }],
    now: 70_000,
    sessionExercises: [{
      exerciseCatalogId: 'exercise',
      exerciseClass: 'strength',
      exerciseName: 'Bench Press',
      isCardio: false,
      isHold: false,
      mainMuscleGroups: ['chest'],
      movementPatterns: ['push'],
      recipeKey: 'standard_load',
      sessionExerciseId: 'session-exercise',
      setup: null,
    }],
    sessionStartedAt: 10_000,
  });

  assert.equal(result.statusStrip.completedSetsLabel, '1 set');
  assert.equal(result.statusStrip.workSlotKind, 'load');
  assert.equal(result.statusStrip.workSlotLabel, '500 kg');
  assert.deepEqual(buildLiveSessionStatusStrip({
    logs: [{
      derivedEffectiveLoadKg: null,
      loggedAt: 10_000,
      metrics: { load: 100, reps: 5, rpe: 8 },
      recipeKey: 'standard_load',
      restSeconds: 90,
      sessionExerciseId: 'session-exercise',
      setLogId: 'set',
      setNumber: 1,
      setOutcome: null,
      warmup: false,
    }],
    now: 70_000,
    sessionExercises: [{
      exerciseCatalogId: 'exercise',
      exerciseClass: 'strength',
      exerciseName: 'Bench Press',
      isCardio: false,
      isHold: false,
      mainMuscleGroups: ['chest'],
      movementPatterns: ['push'],
      recipeKey: 'standard_load',
      sessionExerciseId: 'session-exercise',
      setup: null,
    }],
    sessionStartedAt: 10_000,
  }), result.statusStrip);
});

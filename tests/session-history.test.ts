import assert from 'node:assert/strict';
import test from 'node:test';
import { presentSession } from '../domains/workout/session-presentation';

const exercise = {
  exerciseName: 'Bench press',
  setCount: 3,
  isCardio: false,
  mainMuscleGroups: ['Pectoralis major', 'Triceps'],
};

test('history names performed work and never presents unlogged exercises as training', () => {
  assert.equal(
    presentSession([{ ...exercise, setCount: 0 }]).title,
    'Unlogged session',
  );
  assert.deepEqual(presentSession([{ ...exercise, setCount: 0 }]).areas, []);
  assert.equal(presentSession([exercise]).title, 'Bench press');
  assert.equal(
    presentSession([
      exercise,
      { ...exercise, exerciseName: 'Curl', mainMuscleGroups: ['Biceps'] },
    ]).category,
    'upper-body',
  );
  assert.equal(
    presentSession([exercise], 'Friday strength').title,
    'Friday strength',
  );
  assert.equal(
    presentSession([exercise, { ...exercise, isCardio: true }]).category,
    'mixed',
  );
  assert.equal(
    presentSession([{ ...exercise, isCardio: true }]).category,
    'cardio',
  );
});

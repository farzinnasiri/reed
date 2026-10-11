import assert from 'node:assert/strict';
import test from 'node:test';
import type { Id } from '../convex/_generated/dataModel';
import { deriveNextAction, type NextActionInput } from '../components/workout/session-next-action';

const id = (value: string) => value as Id<'liveSessionExercises'>;
const empty: NextActionInput = { capture: null, liveCardio: null, rest: null, timeline: [] };

test('an open rest, then cardio, then a set to log decide the next action', () => {
  const timeline = [{ exerciseName: 'Bench press', sessionExerciseId: id('a'), setCount: 1 }];
  const capture = { exerciseName: 'Bench press', currentSetNumber: 2 };
  assert.deepEqual(deriveNextAction({ ...empty, timeline, capture }), { kind: 'open', title: 'Bench press', detail: 'Set 2' });
  assert.deepEqual(
    deriveNextAction({ ...empty, timeline, capture, rest: { exerciseName: 'Bench press', nextSetNumber: 2 } }),
    { kind: 'open', title: 'Bench press', detail: 'Resting · set 2 next' },
  );
  assert.deepEqual(
    deriveNextAction({ ...empty, timeline, liveCardio: { exerciseName: 'Stair climber' } }),
    { kind: 'open', title: 'Stair climber', detail: 'In progress' },
  );
});

test('with nothing open it starts the first untouched exercise, else offers to add one', () => {
  const timeline = [
    { exerciseName: 'Squat', sessionExerciseId: id('a'), setCount: 3 },
    { exerciseName: 'Lunge', sessionExerciseId: id('b'), setCount: 0 },
  ];
  assert.deepEqual(deriveNextAction({ ...empty, timeline }), { kind: 'start', title: 'Lunge', detail: 'Start', exerciseId: 'b' });
  assert.deepEqual(deriveNextAction({ ...empty, timeline: [timeline[0]] }), { kind: 'add' });
  assert.deepEqual(deriveNextAction(empty), { kind: 'add' });
});

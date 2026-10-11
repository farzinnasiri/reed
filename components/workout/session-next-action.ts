import type { Id } from '@/convex/_generated/dataModel';

type ExerciseId = Id<'liveSessionExercises'>;

/** The slice of a live session the dock needs to say what comes next. */
export type NextActionInput = {
  capture: { exerciseName: string; currentSetNumber: number } | null;
  liveCardio: { exerciseName: string } | null;
  rest: { exerciseName: string; nextSetNumber: number } | null;
  timeline: { exerciseName: string; sessionExerciseId: ExerciseId; setCount: number }[];
};

/**
 * What the dock's one primary button does. `open` goes to the exercise Reed already has open (a set
 * to log, a rest to run, a cardio session); `start` opens the first exercise nothing was logged in;
 * `add` is for a session with nothing left to open.
 */
export type NextAction =
  | { kind: 'open'; detail: string; title: string }
  | { kind: 'start'; detail: string; exerciseId: ExerciseId; title: string }
  | { kind: 'add' };

export function deriveNextAction({ capture, liveCardio, rest, timeline }: NextActionInput): NextAction {
  if (rest) return { kind: 'open', title: rest.exerciseName, detail: `Resting · set ${rest.nextSetNumber} next` };
  if (liveCardio) return { kind: 'open', title: liveCardio.exerciseName, detail: 'In progress' };
  if (capture) return { kind: 'open', title: capture.exerciseName, detail: `Set ${capture.currentSetNumber}` };
  const untouched = timeline.find(row => row.setCount === 0);
  if (untouched) return { kind: 'start', title: untouched.exerciseName, detail: 'Start', exerciseId: untouched.sessionExerciseId };
  return { kind: 'add' };
}

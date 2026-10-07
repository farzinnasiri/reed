import type { Draft, Practice, StepId } from './draft';

export type StepProps = {
  editing?: boolean;
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  practices: Practice[];
  /** Move on from the current step (the keyboard's return key uses this). */
  next: () => void;
  /** Jump to an earlier step to change an answer; Continue then returns to the summary. */
  edit: (step: StepId) => void;
};

/** A step toggles an entry in a list answer. */
export function toggle<T>(list: T[], item: T, max = 0): T[] {
  if (list.includes(item)) return list.filter(entry => entry !== item);
  const next = [...list, item];
  return max > 0 && next.length > max ? next.slice(next.length - max) : next;
}

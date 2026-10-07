// The weight stepper's numbers, shared by the home widget and the Log weight sheet.
export const STEP_KG = 0.1;
// Where the stepper starts when there is no previous weigh-in. The server accepts 25-300 kg.
export const DEFAULT_KG = 70;
export const MIN_KG = 25;
export const MAX_KG = 300;

/** Holding a step button repeats it; after this many repeats it moves five tenths at a time. */
export const HOLD_REPEAT_MS = 70;
export const HOLD_DELAY_MS = 350;
export const HOLD_ACCELERATE_AFTER = 14;
export const HOLD_ACCELERATED_STEPS = 5;

function roundKg(value: number) {
  return Math.round(value * 10) / 10;
}

/** One step up or down, kept to a tenth and inside what the server accepts. */
export function stepWeight(current: number, direction: -1 | 1, steps = 1) {
  return Math.min(MAX_KG, Math.max(MIN_KG, roundKg(current + direction * steps * STEP_KG)));
}

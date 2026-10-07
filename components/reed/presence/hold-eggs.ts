// What Reed does when you press and hold it on home. Each egg is a little scene: a timeline that
// plays while the finger is down and an outro for letting go. Just for fun; none of it carries state.
//
// Add one by appending to HOLD_EGGS: `at` is ms since the hold began, the first step is at 0, and
// the last step holds until release. Faces: see MASCOT_EXPRESSIONS. Feel: `speed` and `transition`.

import type { MascotExpression, MascotFeel, MascotStep } from '../mascot';

export type HoldHaptic = 'light' | 'medium' | 'selection' | 'soft';

export type HoldEggStep = { at: number; expression: MascotExpression; haptic?: HoldHaptic } & MascotFeel;

export type HoldEgg = {
  id: string;
  /** Plays while held. */
  during: HoldEggStep[];
  /** Plays on release, then Reed goes back to how it feels. */
  outro: MascotStep[];
};

/** The last scene of a hold lasts until the finger lifts; this only bounds a very long hold. */
export const HOLD_LAST_STEP_MS = 60_000;

export const HOLD_EGGS: HoldEgg[] = [
  // Reed lifts, with you doing the holding.
  {
    id: 'lift',
    during: [
      { at: 0, expression: 'focused' },
      { at: 700, expression: 'effort', speed: 1.5, transition: 'quick', haptic: 'light' },
      { at: 1700, expression: 'effort', speed: 2.4, transition: 'instant', haptic: 'medium' },
    ],
    outro: [{ expression: 'excited', ms: 700, transition: 'quick' }, { expression: 'relieved', ms: 1500 }],
  },
  // Pet it long enough and it dozes off.
  {
    id: 'nap',
    during: [
      { at: 0, expression: 'happy' },
      { at: 900, expression: 'sleepy', speed: 0.7, transition: 'slow', haptic: 'soft' },
    ],
    outro: [{ expression: 'surprised', ms: 600, transition: 'quick' }, { expression: 'happy', ms: 1300 }],
  },
  {
    id: 'wink',
    during: [
      { at: 0, expression: 'happy' },
      { at: 800, expression: 'wink', transition: 'quick', haptic: 'selection' },
    ],
    outro: [{ expression: 'wink', ms: 1000 }, { expression: 'happy', ms: 900 }],
  },
  // Squeeze too long and it complains, then spins.
  {
    id: 'squeeze',
    during: [
      { at: 0, expression: 'surprised', transition: 'quick' },
      { at: 900, expression: 'concerned', haptic: 'light' },
      { at: 2200, expression: 'dizzy', transition: 'quick', haptic: 'medium' },
    ],
    outro: [{ expression: 'relieved', ms: 1600 }],
  },
  {
    id: 'inspect',
    during: [
      { at: 0, expression: 'curious' },
      { at: 1100, expression: 'surprised', transition: 'quick', haptic: 'selection' },
      { at: 2000, expression: 'curious' },
    ],
    outro: [{ expression: 'happy', ms: 1500 }],
  },
  {
    id: 'flex',
    during: [
      { at: 0, expression: 'ready' },
      { at: 900, expression: 'proud', haptic: 'soft' },
      { at: 2200, expression: 'excited', transition: 'quick', haptic: 'medium' },
    ],
    outro: [{ expression: 'proud', ms: 1600 }],
  },
];

/** A random egg other than the one just played, so holding twice never gives the same show. */
export function pickHoldEgg(random: () => number, previousId?: string): HoldEgg {
  const choices = HOLD_EGGS.filter(egg => egg.id !== previousId);
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

/** The egg's timeline as mascot steps, plus the haptic taps to fire along the way. */
export function holdPlayback(egg: HoldEgg): { steps: MascotStep[]; taps: { at: number; kind: HoldHaptic }[] } {
  const steps = egg.during.map(({ at: _at, haptic: _haptic, expression, speed, transition }, index): MascotStep => ({
    expression,
    ms: (egg.during[index + 1]?.at ?? egg.during[index].at + HOLD_LAST_STEP_MS) - egg.during[index].at,
    speed,
    transition,
  }));
  const taps = egg.during.flatMap(step => step.haptic ? [{ at: step.at, kind: step.haptic }] : []);
  return { steps, taps };
}

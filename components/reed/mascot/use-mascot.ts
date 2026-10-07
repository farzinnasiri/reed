import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { reedSprings } from '@/design/motion';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { MASCOT_TRANSITION_MS, type MascotExpression } from './mascot-engine';

/** How long a reaction or sequence step holds when the caller does not say. */
export const MASCOT_REACTION_MS = 1600;

/**
 * How the face moves into an expression: a named feel or a duration in ms.
 * `instant` snaps (actions such as hops still play), `quick` is for fast reactions, `smooth` is the
 * designed default, `slow` is for drifting off or settling.
 */
export type MascotTransition = 'instant' | 'quick' | 'smooth' | 'slow' | number;
const TRANSITION_MS = { instant: 0, quick: 220, smooth: MASCOT_TRANSITION_MS, slow: 900 } as const;

export function resolveMascotTransition(transition: MascotTransition) {
  return typeof transition === 'number' ? Math.max(0, transition) : TRANSITION_MS[transition];
}

/** The pace of an expression: 1 is as designed, 2 is twice as fast, 0.5 is half. */
export type MascotFeel = { speed?: number; transition?: MascotTransition };

/** A bare expression uses the defaults; an object sets its own hold, transition and speed for that step. */
export type MascotStep = MascotExpression | ({ expression: MascotExpression; ms?: number } & MascotFeel);
export type MascotGaze = { x: number; y: number };
export type MascotGazeTarget = 'center' | 'composer' | 'message' | 'suggestions' | 'pulse' | 'left' | 'right';
export type MascotReaction = { kind: 'tick' | 'hop' | 'bounce' | 'wobble' | 'shake' | 'spring'; startedAt: number };

const GAZE_TARGETS: Record<MascotGazeTarget, MascotGaze> = {
  center: { x: 0, y: 0.1 },
  pulse: { x: 0.1, y: -1 },
  left: { x: -0.6, y: -0.6 },
  right: { x: 0.7, y: -0.2 },
  composer: { x: 0.7, y: 0.8 },
  message: { x: 0.4, y: -0.8 },
  suggestions: { x: 1, y: 0 },
};

export type MascotController = {
  /** What Reed shows right now: the reaction or sequence step in flight, else the resting expression. */
  expression: MascotExpression;
  /** Show `expression` for `ms` (default {@link MASCOT_REACTION_MS}), then return to resting. */
  react: (expression: MascotExpression, ms?: number) => void;
  /** Play the steps in order, then return to resting (or start over with `loop`). Replaces anything already playing. */
  play: (steps: MascotStep[], options?: { loop?: boolean }) => void;
  /** Pace and transition in effect right now; the mascot reads these on the UI thread. */
  speed: SharedValue<number>;
  transitionMs: SharedValue<number>;
  /** Return to resting now. */
  stop: () => void;
  gazeX: SharedValue<number>;
  gazeY: SharedValue<number>;
  reaction: SharedValue<MascotReaction | null>;
  lookAt: (target: MascotGazeTarget) => void;
  act: (kind: MascotReaction['kind']) => void;
};

/**
 * Drives one mascot. `resting` is declarative: derive it from real state on every render.
 * Reactions are imperative and temporary. Changing `resting` ends a reaction in flight, so a live
 * state (listening, thinking) always beats a leftover acknowledgement.
 *
 *   const reed = useMascot(isThinking ? 'thinking' : 'idle');
 *   reed.react('happy');                                   // default timing
 *   reed.play(['surprised', { expression: 'happy', ms: 2400 }]);
 *   reed.play([{ expression: 'effort', speed: 1.8, transition: 'quick' }, 'relieved']);  // per-step feel
 *   reed.play(['curious', 'wink', 'happy'], { loop: true });                             // until stop()
 *   <ReedMascot mascot={reed} size="lg" />
 *
 * `speed` and `transition` set the feel of everything this mascot does; a step can override both.
 */
export function useMascot(
  resting: MascotExpression = 'idle',
  { defaultMs = MASCOT_REACTION_MS, enabled = true, speed: baseSpeed = 1, transition: baseTransition = 'smooth' }: { defaultMs?: number; enabled?: boolean } & MascotFeel = {},
): MascotController {
  const [active, setActive] = useState<MascotExpression | null>(null);
  const reduceMotion = useReedReducedMotion();
  const gazeX = useSharedValue(0);
  const gazeY = useSharedValue(0);
  const reaction = useSharedValue<MascotReaction | null>(null);
  const speed = useSharedValue(baseSpeed);
  const transitionMs = useSharedValue(resolveMascotTransition(baseTransition));
  const baseFeelMs = resolveMascotTransition(baseTransition);
  const lookAt = useCallback((target: MascotGazeTarget) => {
    const gaze = GAZE_TARGETS[target];
    gazeX.set(reduceMotion ? gaze.x : withSpring(gaze.x, reedSprings.smooth));
    gazeY.set(reduceMotion ? gaze.y : withSpring(gaze.y, reedSprings.smooth));
  }, [gazeX, gazeY, reduceMotion]);
  const act = useCallback((kind: MascotReaction['kind']) => {
    if (!reduceMotion) reaction.set({ kind, startedAt: Date.now() });
  }, [reaction, reduceMotion]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaultMsRef = useRef(defaultMs);
  useEffect(() => { defaultMsRef.current = defaultMs; }, [defaultMs]);

  // The base feel applies whenever no step is overriding it.
  const baseFeel = useRef({ speed: baseSpeed, transitionMs: baseFeelMs });
  useEffect(() => {
    baseFeel.current = { speed: baseSpeed, transitionMs: baseFeelMs };
    speed.set(baseSpeed);
    transitionMs.set(baseFeelMs);
  }, [baseFeelMs, baseSpeed, speed, transitionMs]);
  const restoreFeel = useCallback(() => {
    speed.set(baseFeel.current.speed);
    transitionMs.set(baseFeel.current.transitionMs);
  }, [speed, transitionMs]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    restoreFeel();
    setActive(null);
  }, [clearTimer, restoreFeel]);

  const play = useCallback((steps: MascotStep[], { loop = false } = {}) => {
    clearTimer();
    const advance = (index: number) => {
      const step = steps[loop && steps.length > 0 ? index % steps.length : index];
      if (!step) {
        timerRef.current = null;
        restoreFeel();
        setActive(null);
        return;
      }
      const { expression, ms, speed: stepSpeed, transition } = typeof step === 'string' ? { expression: step } as Exclude<MascotStep, string> : step;
      // Set before the expression changes: the mascot reads both when it starts moving.
      speed.set(stepSpeed ?? baseFeel.current.speed);
      transitionMs.set(transition === undefined ? baseFeel.current.transitionMs : resolveMascotTransition(transition));
      setActive(expression);
      timerRef.current = setTimeout(() => advance(index + 1), ms ?? defaultMsRef.current);
    };
    advance(0);
  }, [clearTimer, restoreFeel, speed, transitionMs]);

  const react = useCallback((expression: MascotExpression, ms?: number) => {
    play([{ expression, ms }]);
  }, [play]);

  const [previousResting, setPreviousResting] = useState(`${resting}|${enabled}`);
  if (previousResting !== `${resting}|${enabled}`) { setPreviousResting(`${resting}|${enabled}`); setActive(null); }
  useEffect(() => { clearTimer(); restoreFeel(); }, [resting, enabled, clearTimer, restoreFeel]);

  useEffect(() => clearTimer, [clearTimer]);

  return useMemo(
    () => ({ act, expression: active ?? resting, gazeX, gazeY, lookAt, play, react, reaction, speed, stop, transitionMs }),
    [act, active, gazeX, gazeY, lookAt, play, react, reaction, resting, speed, stop, transitionMs],
  );
}

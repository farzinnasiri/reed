import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  Extrapolation,
  ReduceMotion,
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { reedMotion, reedSprings } from './motion';
import { useStageRecedeProgress } from './stage-recede';
import { useReedReducedMotion } from './use-reed-reduced-motion';

// Finger travel for a full open or close; the release snaps by velocity and position. Closing is
// shorter because the header the finger starts on sits near the top of the screen.
const OPEN_DRAG_RANGE = 320;
const CLOSE_DRAG_RANGE = 180;
const FLICK_VELOCITY = 600;
const RUBBER_BAND = 0.25;

// Past either end the finger still moves the strip, but at a fraction of the distance.
function rubberBand(value: number) {
  'worklet';
  if (value > 1) return 1 + (value - 1) * RUBBER_BAND;
  if (value < 0) return value * RUBBER_BAND;
  return value;
}

type Shape = { top: number; left: number; right: number; height: number; radius: number; color: string };

type StripMorphOptions = {
  collapsed: Shape;
  expanded: Shape;
  /** False keeps it a plain strip: no pull, and an open one closes at once. */
  enabled?: boolean;
};

/**
 * DESIGN.md → Choreography 2: a strip that grows, by one `progress` value (0 strip, 1 expanded),
 * into a panel over a scrim while the stage behind recedes. Tap or pull down opens it; pulling
 * the panel's header up closes it. The home Pulse and the session strip both use it, so they move
 * the same way.
 */
export function useStripMorph({ collapsed, expanded, enabled = true }: StripMorphOptions) {
  const reduceMotion = useReedReducedMotion();
  const stageRecede = useStageRecedeProgress();
  const progress = useSharedValue(0);
  const [isOpen, setIsOpen] = useState(false);
  // The panel's content can subscribe to a lot of data, so it only exists while open or settling.
  const [isContentMounted, setIsContentMounted] = useState(false);

  // Reduce Motion: the container jumps between its two shapes and the content crossfades.
  const geometry = useDerivedValue(() => (reduceMotion ? (progress.get() > 0 ? 1 : 0) : progress.get()));

  const animateTo = useCallback((target: number, velocity = 0, onFinished?: (finished?: boolean) => void) => {
    progress.set(reduceMotion
      ? withTiming(target, { duration: reedMotion.durations.standard, reduceMotion: ReduceMotion.Never }, onFinished)
      : withSpring(target, { ...reedSprings.morph, velocity }, onFinished));
  }, [progress, reduceMotion]);

  const settle = useCallback((open: boolean, velocity = 0) => {
    setIsOpen(open);
    if (open) {
      setIsContentMounted(true);
      
    }
    animateTo(open ? 1 : 0, velocity, finished => {
      'worklet';
      if (finished && !open) scheduleOnRN(setIsContentMounted, false);
    });
  }, [animateTo]);

  /** Close without the animation, for when the screen is about to change under it. */
  const collapseNow = useCallback(() => {
    progress.set(0);
    setIsOpen(false);
    setIsContentMounted(false);
  }, [progress]);

  const mountContent = useCallback(() => setIsContentMounted(true), []);

  const [previousEnabled, setPreviousEnabled] = useState(enabled);
  if (previousEnabled !== enabled) {
    setPreviousEnabled(enabled);
    if (!enabled) { setIsOpen(false); setIsContentMounted(false); }
  }
  useEffect(() => { if (!enabled) progress.set(0); }, [enabled, progress]);

  useEffect(() => {
    if (!isOpen || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      settle(false);
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, settle]);

  useAnimatedReaction(
    () => progress.get(),
    value => {
      if (stageRecede) stageRecede.set(Math.min(1, Math.max(0, value)));
    },
  );

  const openGesture = useMemo(() => Gesture.Pan()
    .enabled(!reduceMotion && enabled)
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .onStart(() => scheduleOnRN(mountContent))
    .onUpdate(event => {
      progress.set(rubberBand(event.translationY / OPEN_DRAG_RANGE));
    })
    .onEnd(event => {
      const open = event.velocityY > FLICK_VELOCITY || (event.velocityY > -FLICK_VELOCITY && progress.get() > 0.35);
      scheduleOnRN(settle, open, event.velocityY / OPEN_DRAG_RANGE);
    }), [enabled, mountContent, progress, reduceMotion, settle]);

  const closeGesture = useMemo(() => Gesture.Pan()
    .enabled(!reduceMotion)
    .activeOffsetY(-8)
    .failOffsetX([-24, 24])
    .onUpdate(event => {
      progress.set(rubberBand(1 + event.translationY / CLOSE_DRAG_RANGE));
    })
    .onEnd(event => {
      const open = !(event.velocityY < -FLICK_VELOCITY || (event.velocityY < FLICK_VELOCITY && progress.get() < 0.7));
      scheduleOnRN(settle, open, event.velocityY / CLOSE_DRAG_RANGE);
    }), [progress, reduceMotion, settle]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(geometry.get(), [0, 1], [collapsed.color, expanded.color]),
    borderRadius: interpolate(geometry.get(), [0, 1], [collapsed.radius, expanded.radius], Extrapolation.CLAMP),
    height: Math.max(
      collapsed.height,
      interpolate(geometry.get(), [0, 1], [collapsed.height, expanded.height], Extrapolation.EXTEND),
    ),
    left: interpolate(geometry.get(), [0, 1], [collapsed.left, expanded.left], Extrapolation.CLAMP),
    right: interpolate(geometry.get(), [0, 1], [collapsed.right, expanded.right], Extrapolation.CLAMP),
    top: interpolate(geometry.get(), [0, 1], [collapsed.top, expanded.top], Extrapolation.CLAMP),
  }));
  const fadeOutRange = reduceMotion ? [0, 1] : [0, 0.2];
  const fadeInRange = reduceMotion ? [0, 1] : [0.2, 0.55];
  const stripStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), fadeOutRange, [1, 0], Extrapolation.CLAMP),
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), fadeInRange, [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.get(), [0, 1], [-14, 0], Extrapolation.CLAMP) }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
  }));
  /** For chrome beside the strip that steps aside while it is open. */
  const besideStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.5], [1, 0], Extrapolation.CLAMP),
  }));

  return {
    animateTo,
    besideStyle,
    closeGesture,
    collapseNow,
    containerStyle,
    contentStyle,
    isContentMounted,
    isOpen,
    openGesture,
    progress,
    scrimStyle,
    settle,
    stripStyle,
  };
}

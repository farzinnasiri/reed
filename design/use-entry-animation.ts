import { useEffect, useState } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  ReduceMotion,
} from 'react-native-reanimated';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { reedMotion, reedSprings, reedReanimatedEasing } from '@/design/motion';

type UseEntryAnimationOptions = {
  /** Delay in ms before this element begins its entrance. Default: 0. */
  delay?: number;
  /** Timed entrance when supplied; otherwise use the selected spring. */
  duration?: number;
  /**
   * Whether to animate at all. Read once on mount: pass false for content that was already
   * on screen (for example loaded chat history) so it renders settled.
   */
  enabled?: boolean;
  /** Spring preset from `reedSprings`. Default: gentle. */
  spring?: keyof typeof reedSprings;
  /** Vertical distance to slide from (positive = from below). Default: 16. */
  translateY?: number;
  translateX?: number;
  fromScale?: number;
};

/**
 * One-shot spring entrance animation: fade + translate.
 *
 * Fires once on mount. Used for pushed views and for chat messages that arrive while the
 * thread is open. Prefer this over Reanimated `entering` layout animations inside lists: on web
 * those pin the element with absolute positioning, which collapses list rows.
 *
 * Returns an animated style to spread onto an Animated.View.
 */
export function useEntryAnimation(options: UseEntryAnimationOptions = {}) {
  const { delay = 0, enabled = true, spring = 'gentle', translateY = 16, translateX = 0, fromScale = 1, duration } = options;
  const [shouldAnimate] = useState(enabled);
  const reduceMotion = useReedReducedMotion();
  const progress = useSharedValue(shouldAnimate ? 0 : 1);

  useEffect(() => {
    if (!shouldAnimate) return;
    const animation = reduceMotion
      ? withTiming(1, { duration: reedMotion.durations.standard, reduceMotion: ReduceMotion.Never })
      : duration !== undefined ? withTiming(1, { duration, easing: reedReanimatedEasing.easeOut }) : withSpring(1, reedSprings[spring]);
    progress.value = !reduceMotion && delay > 0 ? withDelay(delay, animation) : animation;
  }, [delay, progress, reduceMotion, shouldAnimate, spring, duration]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * translateY }, { translateX: reduceMotion ? 0 : (1 - progress.value) * translateX }, { scale: reduceMotion ? 1 : fromScale + (1 - fromScale) * progress.value }],
  }));
}

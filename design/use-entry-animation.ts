import { useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { reedSprings } from '@/design/motion';

type UseEntryAnimationOptions = {
  /** Delay in ms before this element begins its entrance. Default: 0. */
  delay?: number;
  /** Vertical distance to slide from (positive = from below). Default: 16. */
  translateY?: number;
};

/**
 * One-shot spring entrance animation: fade + translate.
 *
 * Fires once on mount. Used to stage the "opening breath" when the
 * authenticated app shell appears after splash hide.
 *
 * Returns an animated style to spread onto an Animated.View.
 */
export function useEntryAnimation(options: UseEntryAnimationOptions = {}) {
  const { delay = 0, translateY = 16 } = options;

  const progress = useSharedValue(0);

  useEffect(() => {
    if (delay > 0) {
      progress.value = withDelay(delay, withSpring(1, reedSprings.gentle));
    } else {
      progress.value = withSpring(1, reedSprings.gentle);
    }
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * translateY }],
  }));

  return animatedStyle;
}

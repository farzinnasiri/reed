import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const LIVE_DOT_SIZE = 8;
const PULSE_HALF_CYCLE_MS = 800;

// "Something is open right now": the pulse (1 to 0.35 over 1.6s) is one of the few loops the motion system allows.
// Reduce Motion leaves it static.
export function LiveDot({ color }: { color: string }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }

    opacity.value = withRepeat(
      withTiming(0.35, { duration: PULSE_HALF_CYCLE_MS, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ backgroundColor: color, borderRadius: LIVE_DOT_SIZE / 2, height: LIVE_DOT_SIZE, width: LIVE_DOT_SIZE }, style]}
    />
  );
}

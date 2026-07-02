import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { reedMotion, reedSprings } from '@/design/motion';

type UsePressAnimationOptions = {
  /**
   * When true, fire haptic feedback on press-in.
   * Default: false — opt-in to avoid haptic fatigue on every button.
   */
  haptic?: boolean;
  /** Override the resting scale (default: 1). */
  restScale?: number;
  /** Override the pressed scale (default: reedMotion.scale.tap = 0.97). */
  pressedScale?: number;
};

/**
 * Drop-in replacement for the old `getTapScaleStyle` pattern.
 *
 * Instead of snapping scale instantly on press state change, this hook
 * drives scale through a Reanimated spring on the UI thread — giving
 * every tappable element a physical, responsive feel.
 *
 * Usage:
 * ```tsx
 * const { onPressIn, onPressOut, animatedStyle } = usePressAnimation();
 *
 * <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
 *   <Animated.View style={[styles.foo, animatedStyle]}>
 *     ...
 *   </Animated.View>
 * </Pressable>
 * ```
 */
export function usePressAnimation(options: UsePressAnimationOptions = {}) {
  const {
    haptic = false,
    restScale = 1,
    pressedScale = reedMotion.scale.tap,
  } = options;

  const scale = useSharedValue(restScale);

  // Lazy-load expo-haptics to avoid import cost on Android / web
  // where haptics may not be available.
  const hapticsRef = useRef<typeof import('expo-haptics') | null>(null);

  const onPressIn = useCallback(() => {
    'worklet';
    scale.value = withSpring(pressedScale, reedSprings.snappy);

    if (haptic && Platform.OS === 'ios') {
      // Haptics must run on JS thread — use runOnJS if called from worklet,
      // but since Pressable callbacks run on JS thread, this is fine.
      void (async () => {
        try {
          if (!hapticsRef.current) {
            hapticsRef.current = await import('expo-haptics');
          }
          void hapticsRef.current.selectionAsync();
        } catch {
          // Haptics not available — swallow silently.
        }
      })();
    }
  }, [haptic, pressedScale, scale]);

  const onPressOut = useCallback(() => {
    'worklet';
    scale.value = withSpring(restScale, reedSprings.snappy);
  }, [restScale, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, onPressIn, onPressOut } as const;
}

/**
 * Returns a static disabled-opacity style. Separated from the spring animation
 * because opacity for disabled state doesn't need to animate — it's a
 * declarative state, not a user interaction.
 */
export function getDisabledOpacity(disabled: boolean | null | undefined) {
  return disabled ? reedMotion.opacity.disabled : 1;
}

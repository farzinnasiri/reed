import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { ReduceMotion, interpolate, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';

const TOGGLE_WIDTH = 46;
const TOGGLE_HEIGHT = 28;
const THUMB_SIZE = 22;
const THUMB_INSET = 3;

type ReedToggleProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  value: boolean;
};

// The toggle: 46 x 28, `accent` when on, `surface-high` when off, white thumb.
export function ReedToggle({ accessibilityLabel, disabled = false, onValueChange, value }: ReedToggleProps) {
  const { theme } = useReedTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {
      duration: reduceMotion ? 0 : reedMotion.durations.standard,
      reduceMotion: ReduceMotion.Never,
    });
  }, [progress, reduceMotion, value]);

  const offColor = String(theme.colors.surfaceHigh);
  const onColor = String(theme.colors.accent);
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [offColor, onColor]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, TOGGLE_WIDTH - THUMB_SIZE - THUMB_INSET * 2]) }],
  }));

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={{ opacity: disabled ? reedMotion.opacity.disabled : 1 }}
    >
      <Animated.View style={[{ borderRadius: TOGGLE_HEIGHT / 2, height: TOGGLE_HEIGHT, width: TOGGLE_WIDTH }, trackStyle]}>
        <Animated.View
          style={[
            {
              backgroundColor: theme.colors.accentText,
              borderRadius: THUMB_SIZE / 2,
              height: THUMB_SIZE,
              left: THUMB_INSET,
              position: 'absolute',
              top: THUMB_INSET,
              width: THUMB_SIZE,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

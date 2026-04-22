import { Animated, Easing, LayoutAnimation, Platform, UIManager, type ViewStyle } from 'react-native';

export const reedMotion = {
  durations: {
    micro: 100,
    standard: 180,
    mode: 240,
  },
  distances: {
    expandContentY: 8,
    listInsertY: 12,
    modeEnterY: 24,
    screenShiftX: 8,
    setTickY: -4,
    tabSlideX: 16,
  },
  opacity: {
    disabled: 0.45,
    flash: 0.06,
    screenShift: 0.95,
    tabEnter: 0.92,
    workoutEnter: 0.96,
  },
  scale: {
    activeTab: 1.06,
    backgroundSheet: 0.98,
    tap: 0.97,
  },
} as const;

export const reedEasing = {
  easeInOut: Easing.inOut(Easing.quad),
  easeOut: Easing.out(Easing.quad),
} as const;

export const shouldUseNativeDriver = Platform.OS !== 'web';

export function enableReedLayoutAnimations() {
  if (Platform.OS === 'android') {
    UIManager.setLayoutAnimationEnabledExperimental?.(true);
  }
}

export function runReedLayoutAnimation(duration: number = reedMotion.durations.standard) {
  LayoutAnimation.configureNext({
    duration,
    create: {
      duration,
      property: LayoutAnimation.Properties.opacity,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      duration,
      property: LayoutAnimation.Properties.opacity,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    update: {
      duration,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
  });
}

export function getTapScaleStyle(pressed: boolean, disabled: boolean | null | undefined = false): ViewStyle {
  return {
    opacity: disabled ? reedMotion.opacity.disabled : 1,
    transform: [{ scale: pressed && !disabled ? reedMotion.scale.tap : 1 }],
  };
}

export function createTiming(
  value: Animated.Value | Animated.ValueXY,
  toValue: number,
  duration: number = reedMotion.durations.standard,
  easing = reedEasing.easeOut,
  useNativeDriver = shouldUseNativeDriver,
) {
  return Animated.timing(value, {
    duration,
    easing,
    toValue,
    useNativeDriver,
  });
}

enableReedLayoutAnimations();

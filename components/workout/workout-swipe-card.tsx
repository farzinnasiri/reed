import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { createTiming, reedEasing, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type SwipeCardProps = {
  children: React.ReactNode;
  disabled?: boolean;
  hint: string;
  leftIcon?: IconName;
  leftLabel: string;
  leftTone?: 'neutral' | 'danger';
  onSwipeLeft?: () => void | Promise<void>;
  onSwipeRight?: () => void | Promise<void>;
  rightIcon?: IconName;
  rightLabel: string;
};

const SWIPE_THRESHOLD = 96;
const SHOULD_USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function WorkoutSwipeCard({
  children,
  disabled = false,
  hint,
  leftIcon = 'arrow-back',
  leftLabel,
  leftTone = 'neutral',
  onSwipeLeft,
  onSwipeRight,
  rightIcon = 'checkmark',
  rightLabel,
}: SwipeCardProps) {
  const { theme } = useReedTheme();
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;
  const entryScale = useRef(new Animated.Value(1)).current;
  const entryTranslateY = useRef(new Animated.Value(0)).current;
  const isHandlingSwipe = useRef(false);
  const dragXRef = useRef(0);
  const flyoutDistance = Math.max(width * 1.05, 360);

  const rotation = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-flyoutDistance, 0, flyoutDistance],
        outputRange: ['-20deg', '0deg', '20deg'],
        extrapolate: 'clamp',
      }),
    [flyoutDistance, translateX],
  );

  const dragScale = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-220, 0, 220],
        outputRange: [0.96, 1, 0.96],
        extrapolate: 'clamp',
      }),
    [translateX],
  );

  const scale = useMemo(() => Animated.multiply(dragScale, entryScale), [dragScale, entryScale]);
  const leftGradientColors = useMemo(
    () =>
      leftTone === 'danger'
        ? ([String(theme.colors.dangerFill), 'transparent'] as const)
        : ([String(theme.colors.controlFill), 'transparent'] as const),
    [leftTone, theme.colors.controlFill, theme.colors.dangerFill],
  );
  const leftForegroundColor = leftTone === 'danger' ? theme.colors.dangerText : theme.colors.textPrimary;
  const rightUnderlayStrongGreen = useMemo(
    () => (theme.mode === 'dark' ? 'rgba(22, 163, 74, 0.52)' : 'rgba(22, 163, 74, 0.42)'),
    [theme.mode],
  );
  const rightGradientColors = useMemo(
    () => [rightUnderlayStrongGreen, 'transparent'] as const,
    [rightUnderlayStrongGreen],
  );
  const rightForegroundColor = theme.colors.accentPrimaryText;

  const leftOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-140, -24, 0],
        outputRange: [1, 0.28, 0],
        extrapolate: 'clamp',
      }),
    [translateX],
  );

  const rightOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, 24, 140],
        outputRange: [0, 0.28, 1],
        extrapolate: 'clamp',
      }),
    [translateX],
  );

  const leftCopyX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-140, 0],
        outputRange: [0, -16],
        extrapolate: 'clamp',
      }),
    [translateX],
  );

  const rightCopyX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, 140],
        outputRange: [16, 0],
        extrapolate: 'clamp',
      }),
    [translateX],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !disabled &&
          !isHandlingSwipe.current &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 8,
        onPanResponderGrant: () => {
          translateX.stopAnimation();
          dragXRef.current = 0;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextX = gestureState.dx;
          dragXRef.current = nextX;
          translateX.setValue(nextX);
        },
        onPanResponderRelease: (_, gestureState) => {
          void handleSwipeEnd(gestureState.dx);
        },
        onPanResponderTerminate: () => {
          resetSwipePosition();
        },
      }),
    [disabled, onSwipeLeft, onSwipeRight, translateX, width],
  );

  function resetSwipePosition() {
    dragXRef.current = 0;
    createTiming(translateX, 0, reedMotion.durations.standard, reedEasing.easeOut, SHOULD_USE_NATIVE_DRIVER).start();
  }

  async function handleSwipeEnd(deltaX: number) {
    if (isHandlingSwipe.current) {
      return;
    }

    const completedRight = deltaX > SWIPE_THRESHOLD && onSwipeRight;
    const completedLeft = deltaX < -SWIPE_THRESHOLD && onSwipeLeft;

    if (!completedRight && !completedLeft) {
      resetSwipePosition();
      return;
    }

    isHandlingSwipe.current = true;
    dragXRef.current = 0;
    const target = completedRight ? flyoutDistance : -flyoutDistance;

    await new Promise<void>(resolve => {
      createTiming(
        translateX,
        target,
        reedMotion.durations.standard,
        reedEasing.easeOut,
        SHOULD_USE_NATIVE_DRIVER,
      ).start(() => resolve());
    });

    try {
      if (completedRight) {
        await onSwipeRight?.();
      } else {
        await onSwipeLeft?.();
      }
    } finally {
      translateX.setValue(0);
      entryScale.setValue(0.98);
      entryTranslateY.setValue(8);
      Animated.parallel([
        createTiming(entryScale, 1, reedMotion.durations.standard, reedEasing.easeOut, SHOULD_USE_NATIVE_DRIVER),
        createTiming(entryTranslateY, 0, reedMotion.durations.standard, reedEasing.easeOut, SHOULD_USE_NATIVE_DRIVER),
      ]).start();
      isHandlingSwipe.current = false;
    }
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.underlay,
          styles.leftUnderlay,
          { pointerEvents: 'none' },
          {
            opacity: leftOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={leftGradientColors}
          end={{ x: 1, y: 0.5 }}
          start={{ x: 0, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.underlayCopy, { transform: [{ translateX: leftCopyX }] }]}>
          <Ionicons color={String(leftForegroundColor)} name={leftIcon} size={32} />
          <ReedText style={[styles.underlayText, { color: leftForegroundColor }]} variant="label">
            {leftLabel}
          </ReedText>
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[
          styles.underlay,
          styles.rightUnderlay,
          { pointerEvents: 'none' },
          {
            opacity: rightOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={rightGradientColors}
          end={{ x: 0, y: 0.5 }}
          start={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.underlayCopy, { transform: [{ translateX: rightCopyX }] }]}>
          <Ionicons color={String(rightForegroundColor)} name={rightIcon} size={32} />
          <ReedText style={[styles.underlayText, { color: rightForegroundColor }]} variant="label">
            {rightLabel}
          </ReedText>
        </Animated.View>
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.glassFallback,
            borderColor: theme.colors.glassHighlight,
            transform: [{ translateX }, { translateY: entryTranslateY }, { rotate: rotation }, { scale }],
          },
        ]}
      >
        <View style={styles.cardContent}>{children}</View>
        <View style={styles.foot}>
          <ReedText tone="muted" variant="caption">
            {hint}
          </ReedText>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  underlay: {
    alignItems: 'center',
    borderRadius: reedRadii.xl,
    bottom: 0,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  leftUnderlay: {
    alignItems: 'flex-end',
    paddingRight: 28,
  },
  rightUnderlay: {
    alignItems: 'flex-start',
    paddingLeft: 28,
  },
  underlayCopy: {
    alignItems: 'center',
    gap: 8,
  },
  underlayText: {
    letterSpacing: 1.6,
  },
  card: {
    borderRadius: reedRadii.xl,
    borderWidth: 1.5,
    flex: 1,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    paddingBottom: 10,
    paddingHorizontal: 22,
    paddingTop: 24,
  },
  foot: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
});

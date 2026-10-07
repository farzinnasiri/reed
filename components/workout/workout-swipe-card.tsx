import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ReedText } from '@/components/ui/reed-text';
import { ReedButton } from '@/components/ui/reed-button';
import { reedMotion, reedReanimatedEasing } from '@/design/motion';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

const RIGHT_GRADIENT_COLORS = ['rgba(22, 163, 74, 0.52)', 'transparent'] as const;

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
  const reducedMotion = useReedReducedMotion();
  const cardSurface = { backgroundColor: theme.colors.surface } as const;
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const entryScale = useSharedValue(1);
  const entryTranslateY = useSharedValue(0);
  const isHandlingSwipe = useSharedValue(false);
  const flyoutDistance = Math.max(width * 1.05, 360);
  const leftGradientColors = useMemo(
    () =>
      leftTone === 'danger'
        ? ([String(theme.colors.dangerFill), 'transparent'] as const)
        : ([String(theme.colors.surface), 'transparent'] as const),
    [leftTone, theme.colors.surface, theme.colors.dangerFill],
  );
  const leftForegroundColor = leftTone === 'danger' ? theme.colors.dangerInk : theme.colors.ink;
  const rightForegroundColor = theme.colors.accentText;

  const handleCompletedSwipe = useCallback(
    async (direction: 'left' | 'right') => {
      try {
        if (direction === 'right') {
          await onSwipeRight?.();
        } else {
          await onSwipeLeft?.();
        }
      } finally {
        translateX.value = 0;
        entryScale.value = reducedMotion ? 1 : 0.98;
        entryTranslateY.value = reducedMotion ? 0 : 8;
        entryScale.value = withTiming(1, {
          duration: reducedMotion ? 0 : reedMotion.durations.standard,
          easing: reedReanimatedEasing.easeOut,
        });
        entryTranslateY.value = withTiming(0, {
          duration: reducedMotion ? 0 : reedMotion.durations.standard,
          easing: reedReanimatedEasing.easeOut,
        });
        isHandlingSwipe.value = false;
      }
    },
    [entryScale, entryTranslateY, isHandlingSwipe, onSwipeLeft, onSwipeRight, reducedMotion, translateX],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .activeOffsetX([-8, 8])
        .failOffsetY([-8, 8])
        .onBegin(() => cancelAnimation(translateX))
        .onUpdate((event) => {
          if (!isHandlingSwipe.value) translateX.value = event.translationX;
        })
        .onEnd((event) => {
          const direction =
            event.translationX > SWIPE_THRESHOLD && onSwipeRight
              ? 'right'
              : event.translationX < -SWIPE_THRESHOLD && onSwipeLeft
                ? 'left'
                : null;
          if (!direction) {
            translateX.value = withTiming(0, {
              duration: reedMotion.durations.standard,
              easing: reedReanimatedEasing.easeOut,
            });
            return;
          }
          isHandlingSwipe.value = true;
          if (reducedMotion) {
            scheduleOnRN(handleCompletedSwipe, direction);
            return;
          }
          translateX.value = withTiming(
            direction === 'right' ? flyoutDistance : -flyoutDistance,
            { duration: reedMotion.durations.standard, easing: reedReanimatedEasing.easeOut },
            (finished) => {
              if (finished) scheduleOnRN(handleCompletedSwipe, direction);
            },
          );
        })
        .onFinalize(() => {
          if (!isHandlingSwipe.value && Math.abs(translateX.value) < flyoutDistance) {
            translateX.value = withTiming(0, {
              duration: reedMotion.durations.standard,
              easing: reedReanimatedEasing.easeOut,
            });
          }
        }),
    [
      disabled,
      flyoutDistance,
      handleCompletedSwipe,
      isHandlingSwipe,
      onSwipeLeft,
      onSwipeRight,
      reducedMotion,
      translateX,
    ],
  );

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: entryTranslateY.value },
      {
        rotate: `${interpolate(translateX.value, [-flyoutDistance, 0, flyoutDistance], [-20, 0, 20], Extrapolation.CLAMP)}deg`,
      },
      { scale: interpolate(translateX.value, [-220, 0, 220], [0.96, 1, 0.96], Extrapolation.CLAMP) * entryScale.value },
    ],
  }));
  const leftUnderlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-140, -24, 0], [1, 0.28, 0], Extrapolation.CLAMP),
  }));
  const rightUnderlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 24, 140], [0, 0.28, 1], Extrapolation.CLAMP),
  }));
  const leftCopyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(translateX.value, [-140, 0], [0, -16], Extrapolation.CLAMP) }],
  }));
  const rightCopyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(translateX.value, [0, 140], [16, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.underlay, styles.leftUnderlay, { pointerEvents: 'none' }, leftUnderlayStyle]}>
        <LinearGradient
          colors={leftGradientColors}
          end={{ x: 1, y: 0.5 }}
          start={{ x: 0, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.underlayCopy, leftCopyStyle]}>
          <Ionicons color={String(leftForegroundColor)} name={leftIcon} size={32} />
          <ReedText style={{ color: leftForegroundColor }} variant="caption">
            {leftLabel}
          </ReedText>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.underlay, styles.rightUnderlay, { pointerEvents: 'none' }, rightUnderlayStyle]}>
        <LinearGradient
          colors={RIGHT_GRADIENT_COLORS}
          end={{ x: 0, y: 0.5 }}
          start={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.underlayCopy, rightCopyStyle]}>
          <Ionicons color={String(rightForegroundColor)} name={rightIcon} size={32} />
          <ReedText style={{ color: rightForegroundColor }} variant="caption">
            {rightLabel}
          </ReedText>
        </Animated.View>
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View
          accessibilityActions={[
            ...(onSwipeRight ? [{ name: 'commit', label: rightLabel }] : []),
            ...(onSwipeLeft ? [{ name: 'secondary', label: leftLabel }] : []),
          ]}
          onAccessibilityAction={(event) => {
            if (disabled || isHandlingSwipe.value) return;
            const direction =
              event.nativeEvent.actionName === 'commit'
                ? 'right'
                : event.nativeEvent.actionName === 'secondary'
                  ? 'left'
                  : null;
            if (direction) {
              isHandlingSwipe.value = true;
              void handleCompletedSwipe(direction);
            }
          }}
          style={[styles.card, cardSurface, cardAnimatedStyle]}
        >
          <View style={styles.cardContent}>{children}</View>
          <View style={styles.foot}>
            <ReedText tone="muted" variant="caption">
              {hint}
            </ReedText>
            {onSwipeRight ? (
              <ReedButton
                disabled={disabled}
                label={rightLabel}
                onPress={() => {
                  if (isHandlingSwipe.value) return;
                  isHandlingSwipe.value = true;
                  void handleCompletedSwipe('right');
                }}
                variant="quiet"
              />
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
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
    borderRadius: reedRadii.card,
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
  card: {
    borderRadius: reedRadii.card,
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

import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useMemo } from "react";
import {
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { ReedText } from "@/components/ui/reed-text";
import { ReedButton } from "@/components/ui/reed-button";
import { reedMotion, reedReanimatedEasing, reedSprings } from "@/design/motion";
import { useReedReducedMotion } from "@/design/use-reed-reduced-motion";
import { useReedTheme } from "@/design/provider";
import { reedRadii, reedTheme, withColorAlpha } from "@/design/system";
import { useExerciseDockSize } from "./session-dock.styles";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type SwipeCardProps = {
  children: React.ReactNode;
  disabled?: boolean;
  hint: string;
  footer?: React.ReactNode;
  leftIcon?: IconName;
  leftLabel: string;
  leftTone?: "neutral" | "danger";
  onSwipeLeft?: () => void | Promise<void>;
  onSwipeRight?: () => void | Promise<void>;
  rightIcon?: IconName;
  rightLabel: string;
};

const SWIPE_THRESHOLD = reedMotion.workoutSwipe.commit;

export function WorkoutSwipeCard({
  children,
  disabled = false,
  hint,
  footer,
  leftIcon = "arrow-back",
  leftLabel,
  leftTone = "neutral",
  onSwipeLeft,
  onSwipeRight,
  rightIcon = "checkmark",
  rightLabel,
}: SwipeCardProps) {
  const { theme } = useReedTheme();
  const mascotSize = useExerciseDockSize();
  const reducedMotion = useReedReducedMotion();
  const cardSurface = { backgroundColor: theme.colors.surface } as const;
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const startAbsoluteX = useSharedValue(0);
  const entryScale = useSharedValue(1);
  const isHandlingSwipe = useSharedValue(false);
  const flyoutDistance = Math.max(width * 1.05, 360);
  const leftGradientColors = useMemo(
    () =>
      leftTone === "danger"
        ? ([String(theme.colors.dangerFill), "transparent"] as const)
        : ([String(theme.colors.surface), "transparent"] as const),
    [leftTone, theme.colors.surface, theme.colors.dangerFill],
  );
  const leftForegroundColor =
    leftTone === "danger" ? theme.colors.dangerInk : theme.colors.ink;
  const rightForegroundColor = theme.colors.successInk;
  const rightGradientColors = useMemo(() => [withColorAlpha(String(theme.colors.successFill), .52), "transparent"] as const, [theme.colors.successFill]);

  const handleCompletedSwipe = useCallback(
    async (direction: "left" | "right") => {
      try {
        if (direction === "right") {
          await onSwipeRight?.();
        } else {
          await onSwipeLeft?.();
        }
      } finally {
        cancelAnimation(translateX);
        translateX.value = 0;
        entryScale.value = reducedMotion ? 1 : 0.98;
        entryScale.value = withTiming(1, {
          duration: reducedMotion ? 0 : reedMotion.durations.standard,
          easing: reedReanimatedEasing.easeOut,
        });
        isHandlingSwipe.value = false;
      }
    },
    [
      entryScale,
      isHandlingSwipe,
      onSwipeLeft,
      onSwipeRight,
      reducedMotion,
      translateX,
    ],
  );

  const gesture = useMemo(
    () => Gesture.Pan()
      .enabled(!disabled && Boolean(onSwipeLeft || onSwipeRight))
      .activeOffsetX([-reedMotion.workoutSwipe.activation, reedMotion.workoutSwipe.activation])
      .failOffsetY([-reedMotion.workoutSwipe.failY, reedMotion.workoutSwipe.failY])
      .onBegin(event => {
        if (isHandlingSwipe.value) return;
        cancelAnimation(translateX);
        startAbsoluteX.value = event.absoluteX;
      })
      .onUpdate(event => {
        if (isHandlingSwipe.value) return;
        translateX.value = event.absoluteX - startAbsoluteX.value;
      })
      .onEnd(event => {
        if (isHandlingSwipe.value) return;
        const swipeX = event.absoluteX - startAbsoluteX.value;
        const direction = swipeX <= -SWIPE_THRESHOLD && onSwipeLeft ? "left"
          : swipeX >= SWIPE_THRESHOLD && onSwipeRight ? "right" : null;
        if (!direction) return;
        isHandlingSwipe.value = true;
        if (reducedMotion) {
          scheduleOnRN(handleCompletedSwipe, direction);
        } else {
          translateX.value = withSpring(direction === "left" ? -flyoutDistance : flyoutDistance, {
            ...reedSprings.snappy, velocity: event.velocityX, overshootClamping: true,
          }, finished => {
            if (finished) scheduleOnRN(handleCompletedSwipe, direction);
          });
        }
      })
      .onFinalize(event => {
        if (isHandlingSwipe.value) return;
        translateX.value = reducedMotion ? 0 : withSpring(0, { ...reedSprings.snappy, velocity: event.velocityX });
      }),
    [disabled, onSwipeLeft, onSwipeRight, translateX, isHandlingSwipe, reducedMotion, flyoutDistance, handleCompletedSwipe, startAbsoluteX],
  );

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      {
        rotate: `${interpolate(translateX.value, [-flyoutDistance, 0, flyoutDistance], [-20, 0, 20], Extrapolation.CLAMP)}deg`,
      },
      {
        scale:
          interpolate(
            translateX.value,
            [-220, 0, 220],
            [0.96, 1, 0.96],
            Extrapolation.CLAMP,
          ) * entryScale.value,
      },
    ],
  }));
  const leftUnderlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-140, -24, 0],
      [1, 0.28, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const rightUnderlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, 24, 140],
      [0, 0.28, 1],
      Extrapolation.CLAMP,
    ),
  }));
  const leftCopyStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          translateX.value,
          [-140, 0],
          [0, -16],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const rightCopyStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          translateX.value,
          [0, 140],
          [16, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.underlay,
          styles.leftUnderlay,
          { pointerEvents: "none" },
          leftUnderlayStyle,
        ]}
      >
        <LinearGradient
          colors={leftGradientColors}
          end={{ x: 1, y: 0.5 }}
          start={{ x: 0, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.underlayCopy, leftCopyStyle]}>
          <Ionicons
            color={String(leftForegroundColor)}
            name={leftIcon}
            size={32}
          />
          <ReedText style={{ color: leftForegroundColor }} variant="caption">
            {leftLabel}
          </ReedText>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.underlay, styles.rightUnderlay, { pointerEvents: "none" }, rightUnderlayStyle]}>
        <LinearGradient colors={rightGradientColors} end={{ x: 0, y: 0.5 }} start={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.underlayCopy, rightCopyStyle]}>
          <Ionicons color={String(rightForegroundColor)} name={rightIcon} size={32} />
          <ReedText style={{ color: rightForegroundColor }} variant="caption">{rightLabel}</ReedText>
        </Animated.View>
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View
          accessibilityActions={[
            ...(onSwipeRight ? [{ name: "commit", label: rightLabel }] : []),
            ...(onSwipeLeft ? [{ name: "secondary", label: leftLabel }] : []),
          ]}
          onAccessibilityAction={(event) => {
            if (disabled || isHandlingSwipe.value) return;
            const direction = event.nativeEvent.actionName === "commit"
              ? "right" : event.nativeEvent.actionName === "secondary" ? "left" : null;
            if (direction) {
              isHandlingSwipe.value = true;
              void handleCompletedSwipe(direction);
            }
          }}
          style={[styles.card, cardSurface, cardAnimatedStyle]}
        >
          <View style={styles.cardContent}>
            {children}
          </View>
          <View style={[styles.foot, { paddingLeft: mascotSize }]}>
            {footer ?? (
              <>
                <ReedText tone="muted" variant="caption">
                  {hint}
                </ReedText>
                {onSwipeRight ? (
                  <ReedButton
                    hapticTap
                    disabled={disabled}
                    label={rightLabel}
                    onPress={() => {
                      if (isHandlingSwipe.value) return;
                      isHandlingSwipe.value = true;
                      void handleCompletedSwipe("right");
                    }}
                    variant="quiet"
                  />
                ) : null}
              </>
            )}
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
    position: "relative",
  },
  underlay: {
    alignItems: "center",
    borderRadius: reedRadii.card,
    bottom: 0,
    justifyContent: "center",
    overflow: "hidden",
    position: "absolute",
    top: 0,
    width: "100%",
  },
  leftUnderlay: {
    alignItems: "flex-end",
    paddingRight: 28,
  },
  rightUnderlay: {
    alignItems: "flex-start",
    paddingLeft: 28,
  },
  underlayCopy: {
    alignItems: "center",
    gap: 8,
  },
  card: {
    borderRadius: reedRadii.card,
    flex: 1,
    overflow: "hidden",
  },
  cardContent: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    paddingBottom: reedTheme.spacing.xs,
    paddingHorizontal: reedTheme.spacing.gutter,
    paddingTop: reedTheme.spacing.gutter,
  },
  foot: {
    alignItems: "center",
    paddingBottom: reedTheme.spacing.sm,
    paddingHorizontal: reedTheme.spacing.md,
  },
});

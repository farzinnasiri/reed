import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
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
import { useReedReducedMotion as useReducedMotion } from '@/design/use-reed-reduced-motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { withColorAlpha } from '@/design/system';
import * as haptics from '@/design/haptics';
import { reedMotion, reedSprings } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { useStageRecedeProgress } from '@/design/stage-recede';
import { appModeRoutes, workoutRouteForIntent } from '../app-routes';
import { useAppShell } from '../app-shell-context';
import { useFiveMinuteNow } from '../use-five-minute-now';
import { PulseExpanded } from './pulse-expanded';
import { LivePulseStrip, PULSE_STRIP_HEIGHT, PulseStrip } from './pulse-strip';
import { usePulse } from './use-pulse';
import { YOU_PILL_WIDTH, YouPill } from './you-pill';

const CHROME_GUTTER = 14;
// The strip stops short of the You pill: 14 (edge) + 48 (pill) + 6 (gap).
const STRIP_RIGHT_INSET = CHROME_GUTTER + YOU_PILL_WIDTH + 6;
const EXPANDED_INSET = 8;
const EXPANDED_BOTTOM_MARGIN = 10;
const COLLAPSED_RADIUS = 26;
const EXPANDED_RADIUS = 36;
// Finger travel for a full open or close; the release snaps by velocity and position. Closing is
// shorter because the header the finger starts on sits near the top of the screen.
const OPEN_DRAG_RANGE = 320;
const CLOSE_DRAG_RANGE = 180;
const FLICK_VELOCITY = 600;
const RUBBER_BAND = 0.25;
const LIVE_RING_ALPHA = 0.35;

// Past either end the finger still moves the Pulse, but at a fraction of the distance.
function rubberBand(value: number) {
  'worklet';
  if (value > 1) return 1 + (value - 1) * RUBBER_BAND;
  if (value < 0) return value * RUBBER_BAND;
  return value;
}

type PulseProps = {
  onOpenYou: () => void;
  /** Open the Pulse once (a `/progress` link or a push notification); the owner clears the request. */
  openRequested: boolean;
  onOpenRequestHandled: () => void;
  onOpenChanged?: (open: boolean) => void;
};

/**
 * The top of home. Collapsed it is a 52px strip next to the You button; tapped or pulled down it
 * morphs, by one `progress` value (0 strip, 1 expanded), into the Progress view over a scrim while
 * the stage behind recedes. While a session is open it is the live activity instead and does not
 * expand.
 */
export function Pulse({ onOpenRequestHandled, onOpenYou, openRequested, onOpenChanged }: PulseProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { activeWorkout, hasUnreadCoachMessage } = useAppShell();
  const pulse = usePulse();
  const now = useFiveMinuteNow();
  const viewer = useQuery(api.profiles.viewer, {});
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('en-US', {
    timeZone: viewer?.timeZone,
    weekday: 'short', month: 'short', day: 'numeric',
  }).format(now), [now, viewer?.timeZone]);
  const stageRecede = useStageRecedeProgress();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [isOpen, setIsOpen] = useState(openRequested && activeWorkout === null);
  useEffect(() => { onOpenChanged?.(isOpen); }, [isOpen, onOpenChanged]);
  // The expanded content subscribes to a lot of data, so it only exists while open or settling.
  const [isContentMounted, setIsContentMounted] = useState(openRequested && activeWorkout === null);
  const isLive = activeWorkout !== null;

  const collapsedTop = insets.top + theme.spacing.lg;
  const expandedTop = Math.max(insets.top - 2, EXPANDED_INSET);
  const expandedHeight = windowHeight - expandedTop - (insets.bottom + EXPANDED_BOTTOM_MARGIN);

  // Reduce Motion: the container jumps between its two shapes and the content crossfades.
  const geometry = useDerivedValue(() => (reduceMotion ? (progress.value > 0 ? 1 : 0) : progress.value));

  const settle = useCallback((open: boolean, velocity = 0) => {
    setIsOpen(open);
    if (open) {
      setIsContentMounted(true);
      haptics.light();
    }
    const target = open ? 1 : 0;
    const onFinished = (finished?: boolean) => {
      'worklet';
      if (finished && !open) scheduleOnRN(setIsContentMounted, false);
    };
    progress.value = reduceMotion
      ? withTiming(target, { duration: reedMotion.durations.standard, reduceMotion: ReduceMotion.Never }, onFinished)
      : withSpring(target, { ...reedSprings.morph, velocity }, onFinished);
  }, [progress, reduceMotion]);

  const collapseNow = useCallback(() => {
    progress.value = 0;
    setIsOpen(false);
    setIsContentMounted(false);
  }, [progress]);

  const mountContent = useCallback(() => setIsContentMounted(true), []);

  const openSessions = useCallback(() => {
    collapseNow();
    router.navigate(appModeRoutes.workout);
  }, [collapseNow]);

  // Act once per request: on web the param can outlive `onOpenRequestHandled`, and a later change
  // of `isLive` must not reopen the Pulse.
  const [previousRequest, setPreviousRequest] = useState(openRequested);
  const [previousLive, setPreviousLive] = useState(isLive);
  if (previousRequest !== openRequested) {
    setPreviousRequest(openRequested);
    if (openRequested && !isLive) { setIsOpen(true); setIsContentMounted(true); }
  }
  if (previousLive !== isLive) {
    setPreviousLive(isLive);
    if (isLive) { setIsOpen(false); setIsContentMounted(false); }
  }
  useEffect(() => {
    if (!openRequested) return;
    onOpenRequestHandled();
    if (!isLive) {
      haptics.light();
      progress.value = reduceMotion
        ? withTiming(1, { duration: reedMotion.durations.standard, reduceMotion: ReduceMotion.Never })
        : withSpring(1, reedSprings.morph);
    }
  }, [isLive, onOpenRequestHandled, openRequested, progress, reduceMotion]);
  useEffect(() => { if (isLive) progress.value = 0; }, [isLive, progress]);

  useEffect(() => {
    if (!isOpen || Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      settle(false);
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, settle]);

  useAnimatedReaction(
    () => progress.value,
    value => {
      if (stageRecede) stageRecede.value = Math.min(1, Math.max(0, value));
    },
  );

  const openGesture = useMemo(() => Gesture.Pan()
    .enabled(!reduceMotion && !isLive)
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .onStart(() => scheduleOnRN(mountContent))
    .onUpdate(event => {
      progress.value = rubberBand(event.translationY / OPEN_DRAG_RANGE);
    })
    .onEnd(event => {
      const open = event.velocityY > FLICK_VELOCITY || (event.velocityY > -FLICK_VELOCITY && progress.value > 0.35);
      scheduleOnRN(settle, open, event.velocityY / OPEN_DRAG_RANGE);
    }), [isLive, mountContent, progress, reduceMotion, settle]);

  const closeGesture = useMemo(() => Gesture.Pan()
    .enabled(!reduceMotion)
    .activeOffsetY(-8)
    .failOffsetX([-24, 24])
    .onUpdate(event => {
      progress.value = rubberBand(1 + event.translationY / CLOSE_DRAG_RANGE);
    })
    .onEnd(event => {
      const open = !(event.velocityY < -FLICK_VELOCITY || (event.velocityY < FLICK_VELOCITY && progress.value < 0.7));
      scheduleOnRN(settle, open, event.velocityY / CLOSE_DRAG_RANGE);
    }), [progress, reduceMotion, settle]);

  const stripColor = String(theme.colors.surface);
  const sheetColor = String(theme.colors.sheet);
  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(geometry.value, [0, 1], [stripColor, sheetColor]),
    borderRadius: interpolate(geometry.value, [0, 1], [COLLAPSED_RADIUS, EXPANDED_RADIUS], Extrapolation.CLAMP),
    height: Math.max(
      PULSE_STRIP_HEIGHT,
      interpolate(geometry.value, [0, 1], [PULSE_STRIP_HEIGHT, expandedHeight], Extrapolation.EXTEND),
    ),
    left: interpolate(geometry.value, [0, 1], [CHROME_GUTTER, EXPANDED_INSET], Extrapolation.CLAMP),
    right: interpolate(geometry.value, [0, 1], [STRIP_RIGHT_INSET, EXPANDED_INSET], Extrapolation.CLAMP),
    top: interpolate(geometry.value, [0, 1], [collapsedTop, expandedTop], Extrapolation.CLAMP),
  }));
  const fadeOutRange = reduceMotion ? [0, 1] : [0, 0.2];
  const fadeInRange = reduceMotion ? [0, 1] : [0.2, 0.55];
  const stripStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, fadeOutRange, [1, 0], Extrapolation.CLAMP),
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, fadeInRange, [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-14, 0], Extrapolation.CLAMP) }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const youStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
  }));

  const weekLabel = pulse
    ? `${pulse.week.count}${pulse.week.target !== null ? ` of ${pulse.week.target}` : ''} sessions this week`
    : 'This week';

  return (
    <>
      <Animated.View style={[styles.scrim, { backgroundColor: theme.colors.scrim, pointerEvents: isOpen ? 'auto' : 'none' }, scrimStyle]}>
        {/* Tapping outside closes it; the chevron in the header is the accessible control. */}
        <Pressable accessible={false} onPress={() => settle(false)} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <View style={styles.layer}>
        <View style={styles.column}>
          {activeWorkout ? (
            <Pressable
              accessibilityHint="Returns to your session."
              accessibilityLabel={`${dateLabel}, session in progress`}
              accessibilityRole="button"
              onPress={() => router.navigate(workoutRouteForIntent({ kind: 'resume' }))}
              style={[
                styles.liveStrip,
                {
                  backgroundColor: theme.colors.accentSoft,
                  borderColor: withColorAlpha(String(theme.colors.accent), LIVE_RING_ALPHA),
                  top: collapsedTop,
                },
              ]}
            >
              <LivePulseStrip dateLabel={dateLabel} workout={activeWorkout} />
            </Pressable>
          ) : (
            <Animated.View style={[styles.container, containerStyle]}>
              <Animated.View style={[styles.strip, stripStyle, { pointerEvents: isOpen ? 'none' : 'auto' }]}>
                <GestureDetector gesture={openGesture}>
                  <Pressable
                    accessibilityHint="Opens your progress."
                    accessibilityLabel={`${dateLabel}, ${weekLabel}${hasUnreadCoachMessage ? ', new note from Reed' : ''}`}
                    accessibilityRole="button"
                    onPress={() => settle(true)}
                  >
                    <PulseStrip dateLabel={dateLabel} pulse={pulse} />
                    {hasUnreadCoachMessage ? <View style={[styles.unreadDot, { backgroundColor: theme.colors.accent }]} /> : null}
                  </Pressable>
                </GestureDetector>
              </Animated.View>

              {isContentMounted ? (
                <Animated.View style={[StyleSheet.absoluteFill, contentStyle, { pointerEvents: isOpen ? 'auto' : 'none' }]}>
                  <PulseExpanded
                    closeGesture={closeGesture}
                    onClose={() => settle(false)}
                    onOpenSessions={openSessions}
                  />
                </Animated.View>
              ) : null}
            </Animated.View>
          )}

          <Animated.View style={[styles.you, { top: collapsedTop, pointerEvents: isOpen ? 'none' : 'auto' }, youStyle]}>
            <YouPill onPress={onOpenYou} />
          </Animated.View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  column: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 720,
    pointerEvents: 'box-none',
    width: '100%',
  },
  container: {
    overflow: 'hidden',
    position: 'absolute',
  },
  layer: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'box-none',
    zIndex: 20,
  },
  liveStrip: {
    borderRadius: COLLAPSED_RADIUS,
    borderWidth: 1,
    height: PULSE_STRIP_HEIGHT,
    left: CHROME_GUTTER,
    overflow: 'hidden',
    position: 'absolute',
    right: STRIP_RIGHT_INSET,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    zIndex: 15,
  },
  strip: {
    height: PULSE_STRIP_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  unreadDot: {
    borderRadius: 3,
    height: 6,
    position: 'absolute',
    right: 12,
    top: 8,
    width: 6,
  },
  you: {
    position: 'absolute',
    right: CHROME_GUTTER,
  },
});

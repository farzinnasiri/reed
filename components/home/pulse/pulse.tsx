import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withColorAlpha } from '@/design/system';
import { useReedTheme } from '@/design/provider';
import { useStripMorph } from '@/design/use-strip-morph';
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
const LIVE_RING_ALPHA = 0.35;

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
  const isLive = activeWorkout !== null;

  const collapsedTop = insets.top + theme.spacing.lg;
  const expandedTop = Math.max(insets.top - 2, EXPANDED_INSET);
  const expandedHeight = windowHeight - expandedTop - (insets.bottom + EXPANDED_BOTTOM_MARGIN);
  // While a session is open the strip is the live activity and does not expand.
  const morph = useStripMorph({
    collapsed: { top: collapsedTop, left: CHROME_GUTTER, right: STRIP_RIGHT_INSET, height: PULSE_STRIP_HEIGHT, radius: COLLAPSED_RADIUS, color: String(theme.colors.surface) },
    expanded: { top: expandedTop, left: EXPANDED_INSET, right: EXPANDED_INSET, height: expandedHeight, radius: EXPANDED_RADIUS, color: String(theme.colors.sheet) },
    enabled: !isLive,
  });
  const { closeGesture, collapseNow, containerStyle, contentStyle, isContentMounted, isOpen, openGesture, scrimStyle, settle, stripStyle } = morph;
  const youStyle = morph.besideStyle;
  useEffect(() => { onOpenChanged?.(isOpen); }, [isOpen, onOpenChanged]);

  const openSessions = useCallback(() => {
    collapseNow();
    router.navigate(appModeRoutes.workout);
  }, [collapseNow]);

  // Act once per request: on web the param can outlive `onOpenRequestHandled`, and a later change
  // of `isLive` must not reopen the Pulse.
  const handledRequest = useRef(false);
  useEffect(() => {
    if (!openRequested) {
      handledRequest.current = false;
      return;
    }
    if (handledRequest.current) return;
    handledRequest.current = true;
    onOpenRequestHandled();
    if (!isLive) settle(true);
  }, [isLive, onOpenRequestHandled, openRequested, settle]);

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

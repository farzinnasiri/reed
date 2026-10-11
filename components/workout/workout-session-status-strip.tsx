import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ColorValue,
} from "react-native";
import {
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { getTapScaleStyle, reedSprings } from "@/design/motion";
import { useReedReducedMotion } from "@/design/use-reed-reduced-motion";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LiveDot } from "@/components/ui/live-dot";
import { ReedText } from "@/components/ui/reed-text";
import { useReedTheme } from "@/design/provider";
import { reedSessionMetrics, withColorAlpha } from "@/design/system";
import { usePressAnimation } from "@/design/use-press-animation";
import { useStripMorph } from "@/design/use-strip-morph";
import { useCompactElapsedLabel } from "./use-compact-elapsed-label";
import {
  styles,
  SESSION_STRIP_ACTIONS_HEIGHT,
  SESSION_STRIP_HEIGHT,
} from "./workout-session-status-strip.styles";

const CHROME_GUTTER = 14;
const EXPANDED_INSET = 8;
const EXPANDED_BOTTOM_MARGIN = 10;
const COLLAPSED_RADIUS = 26;
const EXPANDED_RADIUS = 36;

export type SessionStripPanelControls = {
  /** Pulling the panel's header up closes it; the strip owns the gesture. */
  closeGesture: GestureType;
  close: () => void;
  setExpanded: (expanded: boolean) => void;
};

type WorkoutSessionStripProps = {
  onBack: () => void;
  /** The first segment: the running clock of a live session, or the date of a finished one. */
  lead: ReactNode;
  /** Sets so far, e.g. "12 sets". */
  sets: string;
  /** Where you are, e.g. "Bench press · set 3". */
  position?: string | null;
  /** A second row under the top one (the timeline's Finish and Notes); the strip grows to hold it. */
  actions?: ReactNode;
  /** A live session shows the live dot and its strip grows into this panel; without it the strip is plain. */
  panel?: (controls: SessionStripPanelControls) => ReactNode;
  panelPeekHeight?: number;
  panelFullHeight?: number;
};

/**
 * The top of a session: the Pulse's shape and place (a 52px pill at `chrome-gutter`), and for a
 * live session the Pulse's motion too. Tapped or pulled down it morphs into the session panel
 * over a scrim while the stage recedes (`useStripMorph`, shared with home).
 */
/** `color` at `opacity` flattened onto `base`, for fills that must not let what scrolls beneath show through. Hex only. */
function flattenOver(color: string, opacity: number, base: string) {
  const parse = (hex: string) => {
    const match = hex.trim().match(/^#([0-9a-f]{6})$/i);
    if (!match) return null;
    const value = Number.parseInt(match[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  };
  const top = parse(color);
  const bottom = parse(base);
  if (!top || !bottom) return withColorAlpha(color, opacity);
  const [r, g, b] = top.map((channel, index) => Math.round(channel * opacity + bottom[index] * (1 - opacity)));
  return `rgb(${r}, ${g}, ${b})`;
}

export function WorkoutSessionStrip({
  actions,
  lead,
  onBack,
  panel,
  panelPeekHeight,
  panelFullHeight,
  position,
  sets,
}: WorkoutSessionStripProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isLive = panel !== undefined;
  const collapsedTop = insets.top + theme.spacing.lg;
  const expandedTop = Math.max(insets.top - 2, EXPANDED_INSET);
  const expandedHeight = Math.min(
    windowHeight - expandedTop - (insets.bottom + EXPANDED_BOTTOM_MARGIN),
    panelFullHeight ?? windowHeight,
  );
  const peekHeight = Math.min(
    expandedHeight,
    Math.max(
      reedSessionMetrics.panelPeekMin,
      Math.min(
        windowHeight * reedSessionMetrics.panelPeekFraction,
        panelPeekHeight ?? windowHeight * reedSessionMetrics.panelPeekFraction,
      ),
    ),
  );
  const detail = useSharedValue(0);
  const reducedMotion = useReedReducedMotion();
  const liveStripFill = flattenOver(String(theme.colors.accent), 0.16, String(theme.colors.canvas));
  const morph = useStripMorph({
    collapsed: {
      top: collapsedTop,
      left: CHROME_GUTTER,
      right: CHROME_GUTTER,
      height:
        SESSION_STRIP_HEIGHT + (actions ? SESSION_STRIP_ACTIONS_HEIGHT : 0),
      radius: COLLAPSED_RADIUS,
      // Opaque on purpose: a translucent fill lets the scrolling timeline read through the strip.
      color: isLive ? liveStripFill : String(theme.colors.surface),
    },
    expanded: {
      top: expandedTop,
      left: EXPANDED_INSET,
      right: EXPANDED_INSET,
      height: expandedHeight,
      radius: EXPANDED_RADIUS,
      color: String(theme.colors.sheet),
    },
    enabled: isLive,
  });
  const {
    closeGesture,
    containerStyle,
    contentStyle,
    isContentMounted,
    isOpen,
    openGesture,
    scrimStyle,
    settle,
    stripStyle,
  } = morph;

  useAnimatedReaction(
    () => morph.progress.get(),
    (value) => {
      if (value === 0) detail.set(0);
    },
  );
  const panelHeight = useAnimatedStyle(() => ({
    height: Math.max(
      SESSION_STRIP_HEIGHT + (actions ? SESSION_STRIP_ACTIONS_HEIGHT : 0),
      interpolate(
        reducedMotion
          ? morph.progress.get() > 0
            ? 1
            : 0
          : morph.progress.get(),
        [0, 1],
        [
          SESSION_STRIP_HEIGHT + (actions ? SESSION_STRIP_ACTIONS_HEIGHT : 0),
          peekHeight + detail.get() * (expandedHeight - peekHeight),
        ],
      ),
    ),
  }));

  const body = (
    <View style={styles.stripBody}>
      <View style={styles.stripItem}>
        {isLive ? <LiveDot color={theme.colors.accent} /> : null}
        {lead}
      </View>
      {sets ? (
        <>
          <Separator />
          <ReedText
            tone="secondary"
            variant="caption"
            numberOfLines={1}
            style={styles.stripNumber}
          >
            {sets}
          </ReedText>
        </>
      ) : null}
      {position ? (
        <>
          <Separator />
          <ReedText
            numberOfLines={1}
            style={styles.stripPosition}
            tone="muted"
            variant="caption"
          >
            {position}
          </ReedText>
        </>
      ) : (
        <View style={styles.stripPosition} />
      )}
      {isLive ? (
        <Ionicons
          color={String(theme.colors.inkMuted)}
          name="chevron-down"
          size={16}
        />
      ) : null}
    </View>
  );

  return (
    <>
      <Animated.View
        style={[
          styles.scrim,
          {
            backgroundColor: theme.colors.scrim,
            pointerEvents: isOpen ? "auto" : "none",
          },
          scrimStyle,
        ]}
      >
        {/* Tapping outside closes it; the chevron in the panel's header is the accessible control. */}
        <Pressable
          accessible={false}
          onPress={() => settle(false)}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.layer}>
        <View style={styles.column}>
          <Animated.View
            style={[styles.container, containerStyle, panelHeight]}
          >
            <Animated.View
              style={[
                styles.strip,
                stripStyle,
                actions
                  ? {
                      height:
                        SESSION_STRIP_HEIGHT + SESSION_STRIP_ACTIONS_HEIGHT,
                    }
                  : null,
                { pointerEvents: isOpen ? "none" : "auto" },
              ]}
            >
              <Pressable
                accessibilityLabel="Go back"
                onPress={onBack}
                style={({ pressed }) => [
                  styles.navButton,
                  getTapScaleStyle(pressed),
                ]}
              >
                <Ionicons
                  color={String(theme.colors.ink)}
                  name="arrow-back"
                  size={18}
                />
              </Pressable>
              {isLive ? (
                <GestureDetector gesture={openGesture}>
                  <Pressable
                    accessibilityHint="Opens the session panel."
                    accessibilityLabel={`Session, ${sets}${position ? `, ${position}` : ""}`}
                    accessibilityRole="button"
                    onPress={() => settle(true)}
                    style={{
                      flex: 1,
                      height: SESSION_STRIP_HEIGHT,
                      justifyContent: "center",
                      minWidth: 0,
                    }}
                  >
                    {body}
                  </Pressable>
                </GestureDetector>
              ) : (
                body
              )}
              {actions ? <View style={styles.actions}>{actions}</View> : null}
            </Animated.View>

            {isContentMounted && panel ? (
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  contentStyle,
                  { pointerEvents: isOpen ? "auto" : "none" },
                ]}
              >
                <View style={styles.panel}>
                  {panel({
                    closeGesture,
                    close: () => settle(false),
                    setExpanded: (expanded) => {
                      detail.set(
                        reducedMotion
                          ? expanded
                            ? 1
                            : 0
                          : withSpring(expanded ? 1 : 0, reedSprings.morph),
                      );
                    },
                  })}
                </View>
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
      </View>
    </>
  );
}

/**
 * Finish and Notes under the strip's top row: two wide halves that fill the pill's foot, each saying
 * what it does. Finish carries the session's intent in `accent-soft`; Notes is a plain raised half.
 * They sink and brighten under the thumb (`usePressAnimation`, `haptic`).
 */
export function SessionStripActions({
  hasNotes,
  onFinish,
  onNotes,
}: {
  hasNotes: boolean;
  onFinish: () => void;
  onNotes: () => void;
}) {
  const { theme } = useReedTheme();
  return (
    <>
      <StripAction
        accessibilityLabel="Finish workout"
        color={theme.colors.accentInk}
        fill={String(theme.colors.accentSoft)}
        icon="flag"
        label="Finish"
        onPress={onFinish}
        position="start"
        pressedFill={withColorAlpha(String(theme.colors.accent), 0.3)}
      />
      <StripAction
        accessibilityLabel={
          hasNotes ? "Edit session notes" : "Add session notes"
        }
        color={theme.colors.ink}
        fill={String(theme.colors.surfaceRaised)}
        icon={hasNotes ? "document-text" : "document-text-outline"}
        iconColor={hasNotes ? theme.colors.accentInk : undefined}
        label="Notes"
        onPress={onNotes}
        position="end"
        pressedFill={String(theme.colors.surfaceHigh)}
      />
    </>
  );
}

function StripAction({
  accessibilityLabel,
  color,
  fill,
  icon,
  iconColor,
  label,
  onPress,
  position,
  pressedFill,
}: {
  accessibilityLabel: string;
  color: ColorValue;
  fill: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: ColorValue;
  label: string;
  onPress: () => void;
  position: "start" | "end";
  pressedFill: string;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.actionHit}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.action,
            position === "start" ? styles.actionStart : styles.actionEnd,
            { backgroundColor: pressed ? pressedFill : fill },
            animatedStyle,
          ]}
        >
          <Ionicons color={String(iconColor ?? color)} name={icon} size={18} />
          <ReedText style={{ color }} variant="bodyStrong">
            {label}
          </ReedText>
        </Animated.View>
      )}
    </Pressable>
  );
}

/** The running clock of a live session, in the strip's accent ink; `fallback` when there is none. */
export function SessionClock({
  fallback = "0s",
  manualDurationSeconds,
  startedAt,
}: {
  fallback?: string;
  manualDurationSeconds?: number;
  startedAt?: number;
}) {
  const label = useCompactElapsedLabel(startedAt, manualDurationSeconds);
  return (
    <ReedText
      style={styles.stripNumber}
      tone={startedAt ? "accent" : "secondary"}
      variant="bodyStrong"
    >
      {label ?? fallback}
    </ReedText>
  );
}

function Separator() {
  const { theme } = useReedTheme();
  return (
    <View
      style={[styles.separator, { backgroundColor: theme.colors.lineStrong }]}
    />
  );
}

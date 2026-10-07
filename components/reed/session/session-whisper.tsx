import { useEffect, useRef, useState } from "react";
import { Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ReedText } from "@/components/ui/reed-text";
import { useReedTheme } from "@/design/provider";
import { reedMotion, reedSprings } from "@/design/motion";
import { useReedReducedMotion } from "@/design/use-reed-reduced-motion";
export type SessionWhisperValue = {
  eventId: string;
  createdAt: number;
  setIndex: number;
  text: string;
  kind: "info" | "pr" | "caution";
};
export function SessionWhisper({
  value,
  allowed,
  top,
  onOpen,
}: {
  value: SessionWhisperValue | null;
  allowed: boolean;
  top: number;
  onOpen: () => void;
}) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const [visible, setVisible] = useState(false);
  const consumed = useRef<string | null>(null);
  const progress = useSharedValue(0);
  const eventId = value?.eventId;
  const kind = value?.kind;
  const visibilityKey = `${allowed}|${eventId}`;
  const [previousVisibilityKey, setPreviousVisibilityKey] = useState(visibilityKey);
  if (previousVisibilityKey !== visibilityKey) { setPreviousVisibilityKey(visibilityKey); setVisible(false); }
  useEffect(() => {
    if (!eventId) return;
    // A picker, swipe, or sheet retires the moment. Returning must not replay it.
    if (consumed.current === eventId) return;
    consumed.current = eventId;
    if (!allowed) return;
    const show = setTimeout(
      () => setVisible(true),
      kind === "info"
        ? reedMotion.session.whisperDelayMs
        : reedMotion.presence.receivedMs,
    );
    const hide = setTimeout(
      () => setVisible(false),
      reedMotion.session.whisperDelayMs + reedMotion.session.whisperHoldMs,
    );
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [allowed, eventId, kind]);
  useEffect(() => {
    progress.set(
      visible && !reduced
        ? withSpring(1, reedSprings.pop)
        : withTiming(visible ? 1 : 0, {
            duration: reedMotion.session.whisperFadeMs,
          }),
    );
  }, [progress, reduced, visible]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [
      {
        translateY: reduced
          ? 0
          : (1 - progress.get()) * reedMotion.session.whisperY,
      },
      {
        scale: reduced
          ? 1
          : reedMotion.session.whisperScale +
            (1 - reedMotion.session.whisperScale) * progress.get(),
      },
    ],
  }));
  if (!value) return null;
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top,
          left: theme.spacing.chromeGutter,
          right: theme.spacing.chromeGutter,
          zIndex: 22,
          transformOrigin: "88% 0%",
          pointerEvents: visible ? "auto" : "none",
        },
        style,
      ]}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Talk to Reed about: ${value.text}`}
        onPress={onOpen}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.xs,
          backgroundColor: theme.colors.surfaceRaised,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.sm,
          borderWidth: kind === "info" ? 0 : 1,
          borderColor:
            value.kind === "pr" ? theme.colors.accent : theme.colors.dataWarm,
        }}
      >
        <ReedText variant="body" tone="secondary" style={{ flex: 1 }}>
          {value.text}
        </ReedText>
        <ReedText variant="caption" tone="muted">
          ›
        </ReedText>
      </Pressable>
    </Animated.View>
  );
}

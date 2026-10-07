import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ReedText } from "@/components/ui/reed-text";
import { reedMotion, reedSprings } from "@/design/motion";
import { useReedTheme } from "@/design/provider";
import {
  reedSuggestionMetrics as metrics,
  withColorAlpha,
} from "@/design/system";
import { useReedReducedMotion } from "@/design/use-reed-reduced-motion";
import { mascotSizes } from "./mascot";
import { ReplyChip } from "./reply-chip";
import { styles as columnStyles } from "./reed.styles";
import type { ReedQuickAction } from "./reed.types";
import { PendingStatus } from "./presence/pending-status";

export const PRESENCE_ROW_HEIGHT = 104;
export const PRESENCE_MASCOT_LEFT = 8;
const CONTENT_LEFT = PRESENCE_MASCOT_LEFT + mascotSizes.corner + 12;

/** Keep the row mounted when a draft sets it aside, including its scroll position. */
export function PresenceRow({
  suggestions,
  disabled,
  onReply,
  hint,
  aside,
  reading,
  onLatest,
  placement = "home",
}: {
  suggestions: Pick<ReedQuickAction, "id" | "label" | "prompt">[];
  disabled: boolean;
  onReply: (reply: string) => void;
  hint: string | null;
  aside: boolean;
  reading: boolean;
  onLatest: () => void;
  placement?: "home" | "sheet";
}) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const visible = !aside && !reading && !hint;
  const progress = useSharedValue(visible ? 1 : 0);
  const [fadeAtEdge, setFadeAtEdge] = useState(false);
  const [sizes, setSizes] = useState({ content: 0, viewport: 0 });
  useEffect(() => {
    progress.set(
      visible && !reduced
        ? withSpring(1, reedSprings.pop)
        : withTiming(visible ? 1 : 0, {
            duration: reduced
              ? reedMotion.reply.reducedMs
              : reedMotion.suggestions.asideMs,
          }),
    );
  }, [progress, reduced, visible]);
  const [previousSizes, setPreviousSizes] = useState(sizes);
  if (previousSizes !== sizes) {
    setPreviousSizes(sizes);
    setFadeAtEdge(sizes.content > sizes.viewport + 1);
  }
  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [
      {
        translateY: reduced
          ? 0
          : (1 - progress.get()) * reedMotion.suggestions.asideY,
      },
      {
        scale: reduced
          ? 1
          : reedMotion.suggestions.returnScale +
            (1 - reedMotion.suggestions.returnScale) * progress.get(),
      },
    ],
  }));
  return (
    <View
      style={[
        columnStyles.column,
        styles.row,
        placement === "sheet" && {
          height:
            suggestions.length || reading
              ? metrics.height + theme.spacing.xs
              : 0,
          paddingLeft: 0,
        },
      ]}
    >
      <Animated.View
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
        style={[
          styles.chips,
          style,
          { pointerEvents: visible ? "auto" : "none" },
        ]}
      >
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          onLayout={(event) =>
            setSizes((current) => ({
              ...current,
              viewport: event.nativeEvent.layout.width,
            }))
          }
          onContentSizeChange={(width) =>
            setSizes((current) => ({ ...current, content: width }))
          }
          onScroll={(event) => {
            const next =
              event.nativeEvent.contentOffset.x +
                event.nativeEvent.layoutMeasurement.width <
              event.nativeEvent.contentSize.width - 1;
            setFadeAtEdge((current) => (current === next ? current : next));
          }}
          scrollEventThrottle={32}
          contentContainerStyle={{
            gap: metrics.gap,
            alignItems: "center",
            paddingRight: theme.spacing.chromeGutter,
          }}
        >
          {suggestions.slice(0, 3).map((item, index) => (
            <ReplyChip
              delay={index * reedMotion.suggestions.chatStaggerMs}
              disabled={disabled}
              key={item.id}
              label={item.label}
              onPress={() => onReply(item.prompt)}
            />
          ))}
        </ScrollView>
        {fadeAtEdge ? (
          <LinearGradient
            colors={[
              withColorAlpha(
                String(
                  placement === "sheet"
                    ? theme.colors.sheet
                    : theme.colors.canvas,
                ),
                0,
              ),
              placement === "sheet" ? theme.colors.sheet : theme.colors.canvas,
            ]}
            style={[
              styles.fade,
              { width: metrics.fadeWidth, pointerEvents: "none" },
            ]}
          />
        ) : null}
      </Animated.View>
      {reading ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Jump to the latest message"
          hitSlop={12}
          onPress={onLatest}
          style={[styles.status, placement === "sheet" && { left: 0 }]}
        >
          <ReedText variant="caption" tone="secondary">
            Latest ↓
          </ReedText>
        </Pressable>
      ) : hint ? (
        <View style={styles.status}>
          <PendingStatus text={hint} />
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  chips: { flex: 1, minWidth: 0 },
  fade: { position: "absolute", right: 0, top: 0, bottom: 0 },
  status: { position: "absolute", left: CONTENT_LEFT, right: 14 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    height: PRESENCE_ROW_HEIGHT,
    paddingLeft: CONTENT_LEFT,
  },
});

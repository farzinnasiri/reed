import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, type DimensionValue } from "react-native";
import Animated from "react-native-reanimated";
import { ReedText } from "@/components/ui/reed-text";
import * as haptics from "@/design/haptics";
import { reedMotion } from "@/design/motion";
import { useReedTheme } from "@/design/provider";
import { reedSuggestionMetrics, reedTodaySuggestionMetrics } from "@/design/system";
import { useEntryAnimation } from "@/design/use-entry-animation";
import { usePressAnimation } from "@/design/use-press-animation";

export const REPLY_CHIP_STAGGER_MS = reedMotion.suggestions.todayStaggerMs;

export function ReplyChip({
  delay = 0,
  disabled = false,
  label,
  onPress,
  maxWidth = '100%',
  icon,
  grid = false,
}: {
  delay?: number;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  maxWidth?: DimensionValue;
  icon?: keyof typeof Ionicons.glyphMap;
  grid?: boolean;
}) {
  const { theme } = useReedTheme();
  const metrics = grid ? reedTodaySuggestionMetrics : reedSuggestionMetrics;
  const entry = useEntryAnimation({
    delay,
    spring: "pop",
    translateY: 0,
    translateX: reedMotion.suggestions.enterX,
    fromScale: reedMotion.suggestions.enterScale,
  });
  const press = usePressAnimation({ pressMs: reedMotion.suggestions.pressMs });
  return (
    <Animated.View style={[{ maxWidth, ...(grid ? { width: '100%' } : {}) }, entry, press.animatedStyle]}>
      <Pressable
        accessibilityHint="Sends this to Reed."
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={6}
        onPressIn={() => {
          haptics.selection();
          press.onPressIn();
        }}
        onPressOut={press.onPressOut}
        onPress={onPress}
        style={{
          alignItems: "center",
          flexDirection: 'row',
          gap: theme.spacing.xxs,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.pill,
          height: metrics.height,
          justifyContent: "center",
          paddingHorizontal: metrics.padding,
        }}
      >
        {icon ? <Ionicons name={icon} size={reedTodaySuggestionMetrics.icon} color={String(theme.colors.inkSecondary)} /> : null}
        <ReedText
          numberOfLines={grid ? 2 : 1}
          tone="secondary"
          variant="body"
          style={{ fontSize: metrics.fontSize, lineHeight: metrics.lineHeight, flexShrink: 1 }}
        >
          {label}
        </ReedText>
      </Pressable>
    </Animated.View>
  );
}

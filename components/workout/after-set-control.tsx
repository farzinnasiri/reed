import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { ReedText } from "@/components/ui/reed-text";
import { selection } from "@/design/haptics";
import { reedSprings } from "@/design/motion";
import { useReedReducedMotion } from "@/design/use-reed-reduced-motion";
import { useReedTheme } from "@/design/provider";
import { reedRadii, withColorAlpha } from "@/design/system";

export type AfterSet = "rest" | "nextExercise";

/** Where the swipe goes after this set. Next set is accent; Finish exercise is warm, so the choice reads before the label does. */
export function useAfterSetTone(value: AfterSet) {
  const { theme } = useReedTheme();
  return value === "rest"
    ? { ink: theme.colors.accentInk, fill: theme.colors.accentSoft }
    : { ink: theme.colors.dataWarm, fill: withColorAlpha(String(theme.colors.dataWarm), 0.18) };
}

function Segment({ value, selected, label, disabled, onPress }: {
  value: AfterSet;
  selected: boolean;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { theme } = useReedTheme();
  const tone = useAfterSetTone(value);
  return (
    <HapticPressable
      feedback={false}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={() => { if (!selected) { selection(); onPress(); } }}
      style={styles.segment}
    >
      <ReedText style={{ color: selected ? tone.ink : theme.colors.inkSecondary }} variant="bodyStrong">{label}</ReedText>
    </HapticPressable>
  );
}

export function AfterSetControl({ value, disabled, onChange }: {
  value: AfterSet;
  disabled: boolean;
  onChange: (next: AfterSet) => void;
}) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const rest = useAfterSetTone("rest");
  const last = useAfterSetTone("nextExercise");
  const trackWidth = useSharedValue(0);
  const position = useSharedValue(value === "rest" ? 0 : 1);
  useEffect(() => {
    const target = value === "rest" ? 0 : 1;
    position.value = reduced ? target : withSpring(target, reedSprings.smooth);
  }, [position, reduced, value]);
  // The highlight slides and changes colour as it goes, like the shared segmented control.
  const indicator = useAnimatedStyle(() => {
    const segment = (trackWidth.value - PADDING * 2 - GAP) / 2;
    return {
      width: segment,
      transform: [{ translateX: position.value * (segment + GAP) }],
      backgroundColor: interpolateColor(position.value, [0, 1], [String(rest.fill), String(last.fill)]),
    };
  });
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="After this set"
      onLayout={event => { trackWidth.value = event.nativeEvent.layout.width; }}
      style={[styles.track, { backgroundColor: theme.colors.canvas }]}
    >
      <Animated.View style={[styles.indicator, { pointerEvents: "none" }, indicator]} />
      <Segment value="rest" selected={value === "rest"} label="Next set" disabled={disabled} onPress={() => onChange("rest")} />
      <Segment value="nextExercise" selected={value === "nextExercise"} label="Finish exercise" disabled={disabled} onPress={() => onChange("nextExercise")} />
    </View>
  );
}

const PADDING = 4;
const GAP = 4;

const styles = StyleSheet.create({
  track: { alignSelf: "stretch", flexDirection: "row", borderRadius: reedRadii.pill, padding: PADDING, gap: GAP },
  indicator: { position: "absolute", top: PADDING, bottom: PADDING, left: PADDING, borderRadius: reedRadii.pill },
  segment: { flex: 1, minHeight: 44, borderRadius: reedRadii.pill, alignItems: "center", justifyContent: "center" },
});

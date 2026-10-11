import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import { ReedText } from "@/components/ui/reed-text";
import { useReedTheme } from "@/design/provider";
import type { TimelineSet } from "./workout-surface.types";

export function CompletedSetList({
  sets,
  onOpen,
  disabled = false,
  editingSetNumber,
}: {
  sets: TimelineSet[];
  onOpen: (set: TimelineSet) => void;
  disabled?: boolean;
  editingSetNumber?: number | null;
}) {
  const { theme } = useReedTheme();
  return (
    <View>
      {sets.map((set) => (
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel={`Edit set ${set.setNumber}, ${set.summary}`}
          accessibilityState={{ selected: editingSetNumber === set.setNumber }}
          disabled={disabled}
          key={set.setLogId}
          onPress={() => onOpen(set)}
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.sm,
          }}
        >
          <ReedText
            variant="caption"
            tone={editingSetNumber === set.setNumber ? "accent" : "muted"}
            style={{ minWidth: theme.spacing.xxxl }}
          >
            Set {set.setNumber}
          </ReedText>
          <ReedText
            variant="caption"
            style={{ flex: 1, minWidth: 0 }}
            numberOfLines={2}
          >
            {set.summary}
          </ReedText>
          {set.warmup ? (
            <Ionicons
              name="sunny-outline"
              size={16}
              color={String(theme.colors.inkMuted)}
            />
          ) : null}
          <Ionicons
            name="create-outline"
            size={16}
            color={String(theme.colors.inkMuted)}
          />
        </HapticPressable>
      ))}
    </View>
  );
}

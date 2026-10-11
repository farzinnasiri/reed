import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { View } from "react-native";
import { ReedIconButton } from "@/components/ui/reed-icon-button";
import { ReedSheet } from "@/components/ui/reed-sheet";
import { ReedText } from "@/components/ui/reed-text";
import { useReedTheme } from "@/design/provider";
import { reedWorkoutReviewMetrics } from "@/design/system";
import type { EffortKind } from "@/domains/workout/effort";

export function EffortHelp({ kind }: { kind: EffortKind }) {
  const { theme } = useReedTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <ReedIconButton
        accessibilityLabel="About effort and failed reps"
        variant="ghost"
        onPress={() => setOpen(true)}
      >
        <Ionicons
          name="information-circle-outline"
          size={18}
          color={String(theme.colors.inkMuted)}
        />
      </ReedIconButton>
      <ReedSheet
        open={open}
        onBack={() => setOpen(false)}
        onDismiss={() => setOpen(false)}
        heightFraction={reedWorkoutReviewMetrics.actionsFraction}
      >
        <View style={{ padding: theme.spacing.gutter, gap: theme.spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ReedText variant="headline" style={{ flex: 1 }}>
              Effort
            </ReedText>
            <ReedIconButton
              accessibilityLabel="Close effort help"
              variant="ghost"
              onPress={() => setOpen(false)}
            >
              <Ionicons
                name="close"
                size={22}
                color={String(theme.colors.ink)}
              />
            </ReedIconButton>
          </View>
          <ReedText tone="secondary">RPE rates how hard the set felt.</ReedText>
          {kind === "strength" ? (
            <View>
              {[
                ["7", "3 reps left"],
                ["8", "2 reps left"],
                ["9", "1 rep left"],
                ["10", "0 reps left"],
              ].map(([rpe, label]) => (
                <View
                  key={rpe}
                  style={{
                    flexDirection: "row",
                    gap: theme.spacing.md,
                    minHeight: 32,
                  }}
                >
                  <ReedText variant="bodyStrong" style={{ width: 32 }}>
                    {rpe}
                  </ReedText>
                  <ReedText tone="secondary">{label}</ReedText>
                </View>
              ))}
              <ReedText variant="caption" tone="muted">
                An estimate, with your usual form.
              </ReedText>
            </View>
          ) : (
            <ReedText tone="secondary">
              Rate effort, rather than reps remaining.
            </ReedText>
          )}
          <ReedText variant="caption" tone="secondary">
            Failed rep marks an attempt you could not finish. It does not add a
            completed rep.
          </ReedText>
        </View>
      </ReedSheet>
    </>
  );
}

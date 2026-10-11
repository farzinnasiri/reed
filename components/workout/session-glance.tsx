import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";
import { ReedText } from "@/components/ui/reed-text";
import { useReedTheme } from "@/design/provider";
import { reedRadii, workoutSemanticPalette } from "@/design/system";
import type { SessionInsightsValue } from "./workout-session-insights";

const MAX_AREAS = 3;

/**
 * The session panel's first look from the timeline: three bold numbers, where the work went and any
 * records. Everything else is one tap away under Workout stats.
 */
export function SessionGlance({ exercises, loggedExercises, sets, insights }: {
  exercises: number;
  loggedExercises: number;
  sets: number;
  insights: SessionInsightsValue | null;
}) {
  const { theme } = useReedTheme();
  const summary = insights?.summary;
  const records = insights?.fullInsights.performance.prExercises.length ?? 0;
  const load = summary && summary.output.totalLoadKg > 0 ? Math.round(summary.output.totalLoadKg) : null;
  const effort = summary?.intensity.averageRpe ?? null;
  const third = load !== null
    ? { value: load.toLocaleString(), label: "kg moved" }
    : effort !== null
      ? { value: effort.toFixed(1), label: "avg effort" }
      : null;
  const areas = (summary?.distribution.byGranularMuscleGroup ?? [])
    .filter(row => row.groupId !== "cardio" && row.groupId !== "other" && row.setCount > 0)
    .sort((a, b) => b.setCount - a.setCount);
  const areaTotal = areas.reduce((total, row) => total + row.setCount, 0);

  if (sets === 0) {
    return <ReedText tone="muted" style={{ paddingVertical: theme.spacing.md }}>Log a set and your session shows up here.</ReedText>;
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
        <Tile value={String(sets)} label={sets === 1 ? "set" : "sets"} />
        <Tile value={String(loggedExercises)} label={exercises > loggedExercises ? `of ${exercises} exercises` : loggedExercises === 1 ? "exercise" : "exercises"} />
        {third ? <Tile value={third.value} label={third.label} accent /> : null}
      </View>

      {areas.length > 0 ? (
        <View style={{ gap: theme.spacing.xs }}>
          <View
            accessibilityLabel={`Areas trained: ${areas.slice(0, MAX_AREAS).map(row => `${row.label} ${row.setCount} sets`).join(", ")}`}
            style={{ flexDirection: "row", gap: 2, height: 14, borderRadius: reedRadii.pill, overflow: "hidden" }}
          >
            {areas.map(row => (
              <View
                key={row.groupId}
                style={{
                  flex: row.setCount / areaTotal,
                  backgroundColor: workoutSemanticPalette.granularMuscleGroups[row.groupId as keyof typeof workoutSemanticPalette.granularMuscleGroups] ?? theme.colors.accentInk,
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: theme.spacing.md, rowGap: theme.spacing.xxs }}>
            {areas.slice(0, MAX_AREAS).map(row => (
              <View key={row.groupId} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xxs + 2 }}>
                <View style={{
                  width: 8, height: 8, borderRadius: reedRadii.pill,
                  backgroundColor: workoutSemanticPalette.granularMuscleGroups[row.groupId as keyof typeof workoutSemanticPalette.granularMuscleGroups] ?? theme.colors.accentInk,
                }} />
                <ReedText variant="caption" tone="secondary">{row.label}</ReedText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {records > 0 ? (
        <View style={{
          alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: theme.spacing.xs,
          minHeight: 36, paddingHorizontal: theme.spacing.sm, borderRadius: reedRadii.pill, backgroundColor: theme.colors.accentSoft,
        }}>
          <Ionicons name="trophy-outline" size={16} color={String(theme.colors.accentInk)} />
          <ReedText variant="caption" tone="accent">{records} {records === 1 ? "personal record" : "personal records"}</ReedText>
        </View>
      ) : null}
    </View>
  );
}

function Tile({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  const { theme } = useReedTheme();
  return (
    <View style={{
      flex: 1, minWidth: 0, gap: theme.spacing.xxs, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.sm,
      borderRadius: reedRadii.md, backgroundColor: theme.colors.surfaceRaised,
    }}>
      <ReedText variant="stat" numberOfLines={1} style={accent ? { color: theme.colors.accentInk } : undefined}>{value}</ReedText>
      <ReedText variant="caption" tone="muted" numberOfLines={1}>{label}</ReedText>
    </View>
  );
}

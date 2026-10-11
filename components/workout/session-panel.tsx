import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { CompletedSetList } from "./completed-set-list";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import { ReedIconButton } from "@/components/ui/reed-icon-button";
import { Reveal } from "@/components/ui/reveal";
import type { TimelineRow, TimelineSet } from "./workout-surface.types";
import { ScrollView, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { ReedButton } from "@/components/ui/reed-button";
import { ReedText } from "@/components/ui/reed-text";
import { useReedTheme } from "@/design/provider";
import { styles } from "./session-panel.styles";
import { SessionNotesRow } from "./session-notes-row";
import { SessionGlance } from "./session-glance";
import { SessionInsights, type SessionInsightsValue } from "./workout-session-insights";
import { type WorkoutTiming } from "./workout-duration";
import { useCompactElapsedLabel } from "./use-compact-elapsed-label";
import { reedSessionMetrics } from "@/design/system";
import type { SessionStripPanelControls } from "./workout-session-status-strip";

type SessionPanelProps = {
  controls: SessionStripPanelControls;
  workout: {
    /** On the timeline the panel is a glance at the whole session; on an exercise it is that exercise's sets. */
    page: "timeline" | "exercise";
    timeline: TimelineRow[];
    activeExerciseId: string | null;
    onOpenExercise: (exercise: TimelineRow) => void;
    onOpenSet: (exercise: TimelineRow, set: TimelineSet) => void;
  };
  session: {
    durationFallback: string;
    discardsOnFinish: boolean;
    exerciseCount: number;
    insights: SessionInsightsValue | null;
    insightsError: string | null;
    insightsLoading: boolean;
    isWorking: boolean;
    notes: string;
    timing: WorkoutTiming;
  };
  actions: {
    onFinish: () => void;
    onOpenNotes: () => void;
    onEditDuration: () => void;
    onRefreshInsights: () => unknown;
  };
};

export function SessionPanel({ controls, session, actions, workout }: SessionPanelProps) {
  const { close, closeGesture, setExpanded } = controls;
  const { theme } = useReedTheme();
  const { onRefreshInsights } = actions;
  const [full, setFull] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(workout.activeExerciseId);
  const sets = workout.timeline.reduce((count, exercise) => count + exercise.sets.length, 0);
  const elapsed = useCompactElapsedLabel(session.timing.startedAt, session.timing.manualDurationSeconds);
  const duration = elapsed ?? session.durationFallback;
  const current = workout.timeline.find(row => row.sessionExerciseId === workout.activeExerciseId);
  const exercises = current
    ? [current, ...workout.timeline.filter(row => row !== current)]
    : workout.timeline;
  const glance = workout.page === "timeline";
  useEffect(() => { if (full || glance) void onRefreshInsights(); }, [full, glance, onRefreshInsights]);
  const changeLevel = (next: boolean) => { setExpanded(next); setFull(next); };
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <GestureDetector gesture={closeGesture}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <ReedText variant="headline">{full ? "Workout stats" : "Workout"}</ReedText>
            <View style={styles.summary}>
              <HapticPressable
                accessibilityRole="button"
                accessibilityLabel={`Edit workout duration, ${duration}`}
                onPress={actions.onEditDuration}
                disabled={session.isWorking}
                style={styles.duration}
              >
                <Ionicons name="time-outline" size={16} color={String(theme.colors.inkSecondary)} />
                <ReedText variant="caption" tone="secondary">{duration}</ReedText>
                <Ionicons name="create-outline" size={14} color={String(theme.colors.accentInk)} />
              </HapticPressable>
              <ReedText variant="caption" tone="muted">· {sets} {sets === 1 ? "set" : "sets"}</ReedText>
            </View>
          </View>
          <ReedIconButton accessibilityLabel="Back to workout" onPress={close} variant="ghost">
            <Ionicons name="chevron-up" size={22} color={String(theme.colors.ink)} />
          </ReedIconButton>
        </View>
      </GestureDetector>
      <ScrollView contentContainerStyle={styles.content} style={styles.root} showsVerticalScrollIndicator={false}>
        {full ? (
          <Reveal key="stats">
            {sets > 0 ? (
              <SessionInsights
                errorMessage={session.insightsError}
                insights={session.insights}
                isLoading={session.insightsLoading}
                onRetry={() => void actions.onRefreshInsights()}
              />
            ) : (
              <ReedText variant="body" tone="muted" style={{ paddingVertical: theme.spacing.lg }}>
                Stats appear after your first set.
              </ReedText>
            )}
            <View style={{ marginTop: theme.spacing.lg }}>
              <SessionNotesRow notes={session.notes} onPress={actions.onOpenNotes} />
            </View>
          </Reveal>
        ) : glance ? (
          <Reveal key="glance">
            <SessionGlance
              exercises={workout.timeline.length}
              loggedExercises={workout.timeline.filter(row => row.sets.length > 0).length}
              sets={sets}
              insights={session.insights}
            />
          </Reveal>
        ) : (
          <Reveal key="sets">
            {exercises.map(exercise => {
              const active = exercise.sessionExerciseId === workout.activeExerciseId;
              const expanded = expandedExercise === exercise.sessionExerciseId;
              const hasSets = exercise.sets.length > 0;
              return (
                <View key={exercise.sessionExerciseId} style={{ marginBottom: theme.spacing.xs }}>
                  <HapticPressable
                    accessibilityRole="button"
                    accessibilityLabel={hasSets ? `Show sets for ${exercise.exerciseName}` : `Log ${exercise.exerciseName}`}
                    accessibilityState={hasSets ? { expanded } : undefined}
                    disabled={session.isWorking}
                    onPress={() => hasSets
                      ? setExpandedExercise(expanded ? null : exercise.sessionExerciseId)
                      : workout.onOpenExercise(exercise)}
                    style={styles.exercise}
                  >
                    <Ionicons name="barbell-outline" size={20} color={String(active ? theme.colors.accentInk : theme.colors.inkSecondary)} />
                    <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xxs }}>
                      <ReedText variant="bodyStrong">{exercise.exerciseName}</ReedText>
                      <ReedText variant="caption" tone={active ? "accent" : "muted"}>
                        {active ? "Current · " : ""}{hasSets ? `${exercise.sets.length} ${exercise.sets.length === 1 ? "set" : "sets"}` : "Not logged"}
                      </ReedText>
                    </View>
                    {!hasSets ? <ReedText variant="caption" tone="accent">Log</ReedText> : null}
                    <Ionicons name={hasSets ? expanded ? "chevron-up" : "chevron-down" : "chevron-forward"} size={18} color={String(theme.colors.accentInk)} />
                  </HapticPressable>
                  {hasSets && expanded ? (
                    <View style={{ paddingLeft: theme.spacing.xl }}>
                      <CompletedSetList sets={exercise.sets} disabled={session.isWorking} onOpen={set => workout.onOpenSet(exercise, set)} />
                      <ReedButton label="Log next set" variant="soft" disabled={session.isWorking} style={{ alignSelf: "flex-start", marginVertical: theme.spacing.xs, minHeight: reedSessionMetrics.hit }} onPress={() => workout.onOpenExercise(exercise)} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Reveal>
        )}
      </ScrollView>
      <View style={styles.finish}>
        <ReedButton
          label={full ? (glance ? "Back" : "Back to sets") : "Workout stats"}
          variant="soft"
          disabled={session.isWorking}
          style={{ minHeight: reedSessionMetrics.hit }}
          onPress={() => changeLevel(!full)}
          leading={<Ionicons name={full ? "contract-outline" : "stats-chart-outline"} size={18} color={String(theme.colors.accentInk)} />}
        />
        {full ? <ReedButton label={session.discardsOnFinish ? "Close session" : "Finish workout"} disabled={session.isWorking} onPress={actions.onFinish} leading={<Ionicons name="flag" size={18} color={String(theme.colors.accentText)} />} /> : null}
      </View>
    </View>
  );
}

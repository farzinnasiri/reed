import { useReedTheme } from "@/design/provider";
import { getTapScaleStyle } from "@/design/motion";
import { useEffect, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Id } from "@/convex/_generated/dataModel";
import { ReedText } from "@/components/ui/reed-text";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ReedSwapExercise,
  ReedSwapText,
} from "@/components/reed/session/reed-swap-feedback";
import { styles } from "./workout-exercise-page.styles";
import { formatExerciseSetupLabel } from "@/domains/workout/modifier-formatting";
import { ExerciseImage, ExerciseImageViewer } from "./exercise-image";
import type {
  CaptureCard,
  LiveCardioCard,
  LiveCardioFinishSummary,
  MetricValues,
  RestCard,
  SetOutcomeDetails,
  TimelineRow,
} from "./workout-surface.types";
import { WorkoutExerciseCaptureView } from "./workout-exercise-capture-view";
import { WorkoutExerciseRestView } from "./workout-exercise-rest-view";
import { WorkoutLiveCardioCard } from "./workout-live-cardio-card";

type ExercisePageProps = {
  contentTopInset?: number;
  history: {
    exercise: TimelineRow | null;
    onCancelEdit: () => void;
  };
  navigation: {
    onBackToTimeline: () => void;
  };
  capture: {
    card: CaptureCard | null;
    editingSetNumber: number | null;
    errorMessage: string | null;
    isEditingSet: boolean;
    isPickerInteracting: boolean;
    isWorking: boolean;
    metricValues: MetricValues;
    onCaptureSwipeRight: (afterSet?: 'rest' | 'nextExercise') => void;
    onPickerInteractionEnd: () => void;
    onPickerInteractionStart: () => void;
    onSetOutcomeDetailsChange: (details: SetOutcomeDetails) => void;
    onUpdateMetric: (key: string, nextValue: number) => void;
    onWarmupToggle: () => void;
    setOutcomeDetails: SetOutcomeDetails;
    warmup: boolean;
  };
  liveCardio: {
    card: LiveCardioCard | null;
    errorMessage: string | null;
    finishSummary: LiveCardioFinishSummary | null;
    isWorking: boolean;
    onAdjustMetric: (key: string, delta: number) => void;
    onFinish: (elapsedSeconds: number) => void;
    onOpenNextExercise: () => void;
    onStart: (sessionExerciseId: Id<"liveSessionExercises">) => void;
    onToggleRunning: () => void;
  };
  rest: {
    card: RestCard | null;
    errorMessage: string | null;
    isWorking: boolean;
    onAdjust: (deltaSeconds: number) => void;
    onMoveOn: () => void;
    nextExerciseName: string | null;
    onPreset: (durationSeconds: number) => void;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    onToggleRunning: () => void;
  };
};

export function ExercisePage({
  contentTopInset,
  navigation,
  capture,
  liveCardio,
  rest,
  history,
}: ExercisePageProps) {
  const { width } = useWindowDimensions();
  const headingExercise =
    liveCardio.card ?? liveCardio.finishSummary ?? capture.card ?? rest.card;
  const title = headingExercise?.exerciseName ?? "Exercise";
  const liveCardRingSize = Math.max(
    168,
    Math.min(216, Math.floor(width - 170)),
  );
  const [activeSide, setActiveSide] = useState<"left" | "right">("left");
  const [manualCardio, setManualCardio] = useState(false);
  const [artworkOpen, setArtworkOpen] = useState(false);
  const imageUrl = headingExercise?.imageUrl ?? null;
  const artworkKey = `${title}:${imageUrl ?? ""}`;
  const [previousArtworkKey, setPreviousArtworkKey] = useState(artworkKey);
  if (previousArtworkKey !== artworkKey) {
    setPreviousArtworkKey(artworkKey);
    setArtworkOpen(false);
  }
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();

  const captureKey = `${capture.card?.sessionExerciseId}|${capture.card?.recipeKey}`;
  const [previousCaptureKey, setPreviousCaptureKey] = useState(captureKey);
  if (previousCaptureKey !== captureKey) {
    setPreviousCaptureKey(captureKey);
    setActiveSide("left");
    setManualCardio(false);
  }

  useEffect(() => {
    if (__DEV__ && capture.card?.layoutKind === "unilateral_pair") {
      const fieldKeys = capture.card.fields.map((field) => field.key);
      if (new Set(fieldKeys).size !== fieldKeys.length) {
        console.warn(
          "Duplicate unilateral field keys detected. Left/right metrics may overwrite each other.",
        );
      }
    }
  }, [capture.card]);

  const showLiveCardioCaptureStart =
    capture.card?.processKind === "live_cardio" && !capture.isEditingSet;
  const showLiveCardioView = Boolean(
    liveCardio.finishSummary ||
    liveCardio.card ||
    (showLiveCardioCaptureStart && !manualCardio),
  );

  const setLabel = capture.card && !showLiveCardioView
    ? [
        capture.isEditingSet
          ? `Editing set ${capture.editingSetNumber ?? capture.card.currentSetNumber}`
          : `Set ${capture.card.currentSetNumber}`,
        formatExerciseSetupLabel(capture.card.exerciseSetupModifiers),
      ].filter(Boolean).join(" · ")
    : null;

  return (
    <ReedSwapExercise
      id={
        capture.card?.sessionExerciseId ??
        rest.card?.sessionExerciseId ??
        liveCardio.card?.sessionExerciseId ??
        null
      }
    >
      <View
        style={[
          styles.exercisePage,
          { paddingBottom: insets.bottom + theme.spacing.lg },
          contentTopInset !== undefined
            ? { paddingTop: contentTopInset }
            : undefined,
        ]}
      >
        <View style={styles.exerciseTopRow}>
          {imageUrl ? (
            <Pressable
              disabled={
                capture.isPickerInteracting ||
                capture.isWorking ||
                liveCardio.isWorking ||
                rest.isWorking
              }
              accessibilityRole="button"
              accessibilityLabel={`View ${title} exercise guide`}
              onPress={() => setArtworkOpen(true)}
              style={({ pressed }) => [
                styles.guideButton,
                getTapScaleStyle(pressed),
              ]}
            >
              <ExerciseImage imageUrl={imageUrl} variant="heading" />
              <View
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  backgroundColor: theme.colors.canvas,
                  borderRadius: theme.radii.pill,
                  padding: theme.spacing.xxs,
                }}
              >
                <Ionicons
                  name="expand-outline"
                  size={14}
                  color={String(theme.colors.inkSecondary)}
                />
              </View>
            </Pressable>
          ) : null}
          <View style={styles.exerciseHeadingCopy}>
            <ReedSwapText
              numberOfLines={2}
              style={styles.exerciseTitle}
              variant="headline"
            >
              {title}
            </ReedSwapText>
            {history.exercise?.mainMuscleGroups?.length ? (
              <ReedText variant="caption" tone="muted" numberOfLines={2}>
                {history.exercise.mainMuscleGroups.join(" · ")}
              </ReedText>
            ) : null}
          </View>
          {setLabel ? (
            <ReedText style={styles.setLabel} tone="secondary" variant="caption">{setLabel}</ReedText>
          ) : null}
        </View>
        <ExerciseImageViewer
          imageUrl={imageUrl}
          name={title}
          onClose={() => setArtworkOpen(false)}
          open={artworkOpen}
          muscles={{
            primary: history.exercise?.mainMuscleGroups ?? [],
            secondary: history.exercise?.secondaryMuscleGroups ?? [],
          }}
        />

        <View style={styles.cardArea}>
          {showLiveCardioView ? (
            <WorkoutLiveCardioCard
              captureCard={capture.card}
              errorMessage={liveCardio.errorMessage}
              isEditingSet={capture.isEditingSet}
              isWorking={liveCardio.isWorking}
              liveCardioCard={liveCardio.card}
              liveCardioFinishSummary={liveCardio.finishSummary}
              onAdjustLiveCardioMetric={liveCardio.onAdjustMetric}
              onBackToTimeline={navigation.onBackToTimeline}
              onFinishLiveCardio={liveCardio.onFinish}
              onOpenNextExerciseAfterLiveCardio={liveCardio.onOpenNextExercise}
              onStartLiveCardio={liveCardio.onStart}
              onToggleLiveCardioRunning={liveCardio.onToggleRunning}
              ringSize={liveCardRingSize}
            />
          ) : capture.card ? (
            <WorkoutExerciseCaptureView
              capture={{
                ...capture,
                captureCard: capture.card,
                activeSide,
                onSetActiveSide: setActiveSide,
              }}
              history={{
                onCancelEdit: history.onCancelEdit,
              }}
            />
          ) : rest.card ? (
            <WorkoutExerciseRestView
              errorMessage={rest.errorMessage}
              isWorking={rest.isWorking}
              onAdjustRest={rest.onAdjust}
              onMoveOn={rest.onMoveOn}
              nextExerciseName={rest.nextExerciseName}
              onPresetRest={rest.onPreset}
              onRestSwipeLeft={rest.onSwipeLeft}
              onRestSwipeRight={rest.onSwipeRight}
              onToggleRestRunning={rest.onToggleRunning}
              restCard={rest.card}
            />
          ) : (
            <View style={styles.cardPlaceholder}>
              <ReedText tone="muted">
                Pick an exercise from the timeline.
              </ReedText>
            </View>
          )}
          {showLiveCardioCaptureStart &&
          !liveCardio.card &&
          !liveCardio.finishSummary ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                manualCardio ? "Track cardio live" : "Log cardio manually"
              }
              onPress={() => setManualCardio((value) => !value)}
              style={({ pressed }) => [
                {
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: theme.spacing.sm,
                },
                getTapScaleStyle(pressed),
              ]}
            >
              <ReedText tone="muted">
                {manualCardio ? "Track live instead" : "Log manually"}
              </ReedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </ReedSwapExercise>
  );
}

import { HapticPressable } from "@/components/ui/haptic-pressable";
import { useEffect, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  getTapScaleStyle,
  reedMotion,
  reedReanimatedEasing,
} from "@/design/motion";
import { useReedReducedMotion } from "@/design/use-reed-reduced-motion";
import { ReedButton } from "@/components/ui/reed-button";
import { FailedRepToggle, SetOptions, setOptionsLabel } from "./set-options";
import { Pressable, StyleSheet, View } from "react-native";
import type { RecipeFieldDefinition } from "@/domains/workout/recipes";
import { ReedText } from "@/components/ui/reed-text";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { AfterSetControl, useAfterSetTone } from "./after-set-control";
import { useReedTheme } from "@/design/provider";
import { workoutSemanticPalette } from "@/design/system";
import { WorkoutMetricPicker } from "./workout-metric-picker";
import { styles } from "./workout-exercise-capture-view.styles";
import type {
  CaptureCard,
  MetricValues,
  SetOutcomeDetails,
} from "./workout-surface.types";
import { WorkoutSwipeCard } from "./workout-swipe-card";
import { useExerciseDockSize } from "./session-dock.styles";

const AFTER_SET_HEIGHT = 52;

type CaptureViewState = {
  captureCard: CaptureCard;
  editingSetNumber: number | null;
  errorMessage: string | null;
  isEditingSet: boolean;
  isPickerInteracting: boolean;
  isWorking: boolean;
  activeSide: "left" | "right";
  metricValues: MetricValues;
  onCaptureSwipeRight: (afterSet?: 'rest' | 'nextExercise') => void;
  onPickerInteractionEnd: () => void;
  onPickerInteractionStart: () => void;
  onSetActiveSide: (side: "left" | "right") => void;
  onSetOutcomeDetailsChange: (details: SetOutcomeDetails) => void;
  onUpdateMetric: (key: string, nextValue: number) => void;
  onWarmupToggle: () => void;
  setOutcomeDetails: SetOutcomeDetails;
  warmup: boolean;
};

export function WorkoutExerciseCaptureView({
  capture,
  history,
}: {
  capture: CaptureViewState;
  history: {
    onCancelEdit: () => void;
  };
}) {
  const {
    captureCard,
    editingSetNumber,
    errorMessage,
    isEditingSet,
    isPickerInteracting,
    isWorking,
    activeSide,
    metricValues,
    onCaptureSwipeRight,
    onPickerInteractionEnd,
    onPickerInteractionStart,
    onSetActiveSide,
    onSetOutcomeDetailsChange,
    onUpdateMetric,
    onWarmupToggle,
    setOutcomeDetails,
    warmup,
  } = capture;
  const { theme } = useReedTheme();
  const mascotSize = useExerciseDockSize();
  const warmupPalette = workoutSemanticPalette.warmup;
  const warmupActiveFill = warmupPalette.activeFill;
  const warmupActiveText = warmupPalette.activeText;
  const { activeSideFields, sharedFields } = getSideFields(
    captureCard,
    activeSide,
  );
  const supportsInclineAngle =
    captureCard.modifierCapabilities.setup.includes("inclineAngle");
  const supportsRangeOfMotion =
    captureCard.modifierCapabilities.setOutcome.includes("rangeOfMotion");
  const supportsFailure =
    captureCard.modifierCapabilities.setOutcome.includes("failure");
  const hasModifierControls = supportsInclineAngle || supportsRangeOfMotion;
  const [showModifierControls, setShowModifierControls] = useState(false);
  const optionsOwner = `${captureCard.sessionExerciseId}:${editingSetNumber ?? captureCard.currentSetNumber}`;
  const [previousOptionsOwner, setPreviousOptionsOwner] =
    useState(optionsOwner);
  // Where the swipe goes after this set: rest for another, or on to the next exercise. Every set starts at rest.
  const [moveOn, setMoveOn] = useState(false);
  if (previousOptionsOwner !== optionsOwner) {
    setPreviousOptionsOwner(optionsOwner);
    setShowModifierControls(false);
    setMoveOn(false);
  }
  const reducedMotion = useReedReducedMotion();
  const face = useSharedValue(0);
  useEffect(() => {
    face.value = withTiming(showModifierControls ? 1 : 0, {
      duration: reducedMotion ? 0 : reedMotion.durations.mode,
      easing: reedReanimatedEasing.easeOut,
    });
  }, [face, reducedMotion, showModifierControls]);
  const metricsFace = useAnimatedStyle(() => ({
    opacity: 1 - face.value,
    transform: [
      { translateX: -face.value * reedMotion.distances.screenShiftX },
    ],
  }));
  const optionsFace = useAnimatedStyle(() => ({
    opacity: face.value,
    transform: [
      { translateX: (1 - face.value) * reedMotion.distances.screenShiftX },
    ],
  }));
  const captureFields =
    captureCard.layoutKind === "unilateral_pair"
      ? [...activeSideFields, ...sharedFields]
      : captureCard.fields;
  const captureFieldCount = captureFields.length;
  const [metricsHeight, setMetricsHeight] = useState(0);
  const showThen = !isEditingSet && !showModifierControls;
  const afterSet = showThen && moveOn ? 'nextExercise' : 'rest';
  const afterSetTone = useAfterSetTone(afterSet);

  return (
    <WorkoutSwipeCard
      disabled={isWorking || isPickerInteracting}
      hint={isEditingSet ? "Swipe right to save set" : "Swipe right to log set"}
      leftIcon="remove"
      leftLabel="Stay here"
      rightIcon={afterSet === 'nextExercise' ? "arrow-forward" : "checkmark"}
      rightLabel={isEditingSet ? "Save set" : afterSet === 'nextExercise' ? "Log set and finish this exercise" : "Log set"}
      onSwipeRight={showModifierControls ? undefined : () => onCaptureSwipeRight(afterSet)}
      footer={
        showModifierControls ? (
          <View />
        ) : (
          <View style={styles.captureFoot}>
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel={isEditingSet ? "Save set" : afterSet === 'nextExercise' ? "Log set and finish this exercise" : "Log set"}
              disabled={isWorking || isPickerInteracting}
              hitSlop={theme.spacing.sm}
              onPress={() => onCaptureSwipeRight(afterSet)}
            >
              <ReedText numberOfLines={1} style={{ color: showThen ? afterSetTone.ink : theme.colors.inkMuted, textAlign: "center" }} variant="caption">
                {isEditingSet ? "Swipe right to save set" : afterSet === 'nextExercise' ? "Swipe right to log, then pick next" : "Swipe right to log, then rest"}
              </ReedText>
            </HapticPressable>
            {showThen ? (
              <AfterSetControl disabled={isWorking} onChange={next => setMoveOn(next === "nextExercise")} value={afterSet} />
            ) : null}
          </View>
        )
      }
    >
      <View style={[styles.cardHeader, !showModifierControls && styles.captureHeader]}>
        {showModifierControls ? (
          <View style={styles.cardHeaderCopy}>
            <ReedText variant="bodyStrong">Technique</ReedText>
          </View>
        ) : null}
        {isEditingSet && !showModifierControls ? (
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Return to current set"
            onPress={history.onCancelEdit}
            style={styles.returnToCurrent}
          >
            <Ionicons name="arrow-undo-outline" size={18} color={String(theme.colors.accentInk)} />
            <ReedText variant="caption" tone="accent">Current set</ReedText>
          </HapticPressable>
        ) : null}
        <View style={[styles.cardHeaderActions, !showModifierControls && styles.captureActions]}>
          {hasModifierControls && !showModifierControls ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Technique"
              disabled={isWorking}
              onPress={() => setShowModifierControls((current) => !current)}
              style={({ pressed }) => [
                styles.warmupChip,
                {
                  backgroundColor:
                    showModifierControls ||
                    setOptionsLabel(setOutcomeDetails) !== "Technique"
                      ? theme.colors.accentSoft
                      : theme.colors.surfaceRaised,
                  ...getTapScaleStyle(pressed, false),
                },
              ]}
            >
              <ReedText
                tone={
                  showModifierControls ||
                  setOptionsLabel(setOutcomeDetails) !== "Technique"
                    ? "accent"
                    : "secondary"
                }
                variant="caption"
              >
                {setOptionsLabel(setOutcomeDetails)}
              </ReedText>
            </Pressable>
          ) : null}
          {showModifierControls ? (
            <ReedButton
              label="Back to set"
              variant="soft"
              style={{ minHeight: 44 }}
              leading={<Ionicons name="arrow-back" size={18} color={String(theme.colors.accentInk)} />}
              onPress={() => setShowModifierControls(false)}
            />
          ) : <HapticPressable
            accessibilityLabel="Warm-up"
            accessibilityRole="switch"
            accessibilityState={{ checked: warmup }}
            hapticValue={warmup}
            disabled={isWorking}
            onPress={onWarmupToggle}
            style={({ pressed }) => [
              styles.warmupChip,
              {
                backgroundColor: warmup
                  ? warmupActiveFill
                  : theme.colors.surfaceRaised,
                ...getTapScaleStyle(pressed, false),
              },
            ]}
          >
            <ReedText
              style={{
                color: warmup ? warmupActiveText : theme.colors.inkSecondary,
              }}
              variant="caption"
            >
              Warm-up
            </ReedText>
          </HapticPressable>}
          {supportsFailure && !showModifierControls ? (
            <FailedRepToggle
              details={setOutcomeDetails}
              disabled={isWorking || isPickerInteracting}
              onChange={onSetOutcomeDetailsChange}
            />
          ) : null}
        </View>
      </View>

      {/* The Then pill sits in the room kept clear beside Reed, so the metrics keep their height. */}
      <View style={{ flex: 1, minHeight: 0, marginBottom: showModifierControls ? 0 : Math.max(0, mascotSize - theme.spacing.lg - (showThen ? AFTER_SET_HEIGHT + theme.spacing.xs : 0)) }}>
        <Animated.View
          accessibilityElementsHidden={showModifierControls}
          importantForAccessibility={
            showModifierControls ? "no-hide-descendants" : "auto"
          }
          style={[
            {
              flex: showModifierControls ? undefined : 1,
              pointerEvents: showModifierControls ? "none" : "auto",
            },
            showModifierControls ? StyleSheet.absoluteFill : undefined,
            metricsFace,
          ]}
        >
          {captureCard.layoutKind === "unilateral_pair" ? (
            <View style={styles.unilateralSwitchRow}>
              <SegmentedControl<"left" | "right">
                compact
                haptic
                disabled={isWorking}
                onChange={(nextSide) => {
                  if (isWorking) {
                    return;
                  }
                  onSetActiveSide(nextSide);
                }}
                options={[
                  { label: "Left", value: "left" },
                  { label: "Right", value: "right" },
                ]}
                value={activeSide}
                variant="pill"
              />
            </View>
          ) : null}

          <View
            onLayout={event => setMetricsHeight(event.nativeEvent.layout.height)}
            style={styles.metricsStack}
          >
            {captureFields.map((field) => (
              <WorkoutMetricPicker
                compact={captureFieldCount >= 3}
                availableHeight={metricsHeight > 0
                  ? Math.max(0, (metricsHeight - theme.spacing.xs * Math.max(0, captureFieldCount - 1)) / captureFieldCount)
                  : undefined}
                effortKind={
                  captureCard.processKind === "live_cardio"
                    ? "cardio"
                    : captureFields.some(
                          (item) =>
                            item.key === "reps" || item.key.endsWith("Reps"),
                        )
                      ? "strength"
                      : "hold"
                }
                field={field}
                key={`${captureCard.sessionExerciseId}:${editingSetNumber ?? captureCard.currentSetNumber}:${field.key}`}
                onChange={(nextValue) => onUpdateMetric(field.key, nextValue)}
                onInteractionEnd={onPickerInteractionEnd}
                onInteractionStart={onPickerInteractionStart}
                previousValue={captureCard.previousMetrics?.[field.key]}
                value={
                  metricValues[field.key] ??
                  captureCard.initialMetrics[field.key]
                }
              />
            ))}
          </View>

        </Animated.View>
        <Animated.View
          accessibilityElementsHidden={!showModifierControls}
          importantForAccessibility={
            showModifierControls ? "auto" : "no-hide-descendants"
          }
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: showModifierControls ? "auto" : "none",
            },
            optionsFace,
          ]}
        >
          <SetOptions
            capabilities={captureCard.modifierCapabilities}
            details={setOutcomeDetails}
            disabled={isWorking}
            onChange={onSetOutcomeDetailsChange}
          />
        </Animated.View>
      </View>

      {errorMessage ? (
        <ReedText style={styles.inlineError} tone="danger">
          {errorMessage}
        </ReedText>
      ) : null}
    </WorkoutSwipeCard>
  );
}

function getSideFields(captureCard: CaptureCard, activeSide: "left" | "right") {
  if (captureCard.layoutKind !== "unilateral_pair") {
    return {
      activeSideFields: captureCard.fields,
      sharedFields: [] as RecipeFieldDefinition[],
    };
  }

  const activeSideFields = captureCard.fields.filter((field) =>
    activeSide === "left" ? field.group === "left" : field.group === "right",
  );
  const sharedFields = captureCard.fields.filter(
    (field) => field.group === "shared",
  );

  return { activeSideFields, sharedFields };
}

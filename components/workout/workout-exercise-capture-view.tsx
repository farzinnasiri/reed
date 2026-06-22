import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatExerciseSetupLabel } from '@/domains/workout/modifier-formatting';
import type { RecipeFieldDefinition } from '@/domains/workout/recipes';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { workoutSemanticPalette } from '@/design/system';
import { WorkoutMetricPicker } from './workout-metric-picker';
import { styles } from './workout-surface.styles';
import type { CaptureCard, MetricValues, RangeOfMotion, SetOutcomeDetails } from './workout-surface.types';
import { WorkoutSwipeCard } from './workout-swipe-card';

type CaptureViewProps = {
  captureCard: CaptureCard;
  editingSetNumber: number | null;
  errorMessage: string | null;
  isEditingSet: boolean;
  isPickerInteracting: boolean;
  isWorking: boolean;
  activeSide: 'left' | 'right';
  metricValues: MetricValues;
  onCaptureSwipeRight: () => void;
  onPickerInteractionEnd: () => void;
  onPickerInteractionStart: () => void;
  onSetActiveSide: (side: 'left' | 'right') => void;
  onSetOutcomeDetailsChange: (details: SetOutcomeDetails) => void;
  onUpdateMetric: (key: string, nextValue: number) => void;
  onWarmupToggle: () => void;
  setOutcomeDetails: SetOutcomeDetails;
  warmup: boolean;
};

export function WorkoutExerciseCaptureView({
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
}: CaptureViewProps) {
  const { theme } = useReedTheme();
  const warmupPalette = workoutSemanticPalette.warmup;
  const warmupActiveFill = theme.mode === 'dark' ? warmupPalette.activeFillDark : warmupPalette.activeFillLight;
  const warmupActiveBorder = theme.mode === 'dark' ? warmupPalette.activeBorderDark : warmupPalette.activeBorderLight;
  const warmupActiveText = theme.mode === 'dark' ? warmupPalette.activeTextDark : warmupPalette.activeTextLight;
  const { activeSideFields, sharedFields } = getSideFields(captureCard, activeSide);
  const supportsInclineAngle = captureCard.modifierCapabilities.setup.includes('inclineAngle');
  const inclineAngle = setOutcomeDetails.inclineAngleDegrees;
  const supportsRangeOfMotion = captureCard.modifierCapabilities.setOutcome.includes('rangeOfMotion');
  const supportsFailure = captureCard.modifierCapabilities.setOutcome.includes('failure');
  const rangeOfMotion = setOutcomeDetails.rangeOfMotion ?? 'full';
  const failedReps = setOutcomeDetails.failedReps ?? 0;
  const hasModifierControls = supportsInclineAngle || supportsRangeOfMotion || supportsFailure;
  const hasActiveModifier = inclineAngle !== undefined || rangeOfMotion !== 'full' || failedReps > 0;
  const [showModifierControls, setShowModifierControls] = useState(false);
  const captureFields =
    captureCard.layoutKind === 'unilateral_pair' ? [...activeSideFields, ...sharedFields] : captureCard.fields;
  const captureFieldCount = captureFields.length;
  const metricsStackVariantStyle =
    captureFieldCount <= 1
      ? styles.metricsStackSingle
      : captureFieldCount === 2
        ? styles.metricsStackPair
        : captureFieldCount === 3
          ? styles.metricsStackTriple
          : styles.metricsStackDense;

  return (
    <WorkoutSwipeCard
      disabled={isWorking || isPickerInteracting}
      hint={isEditingSet ? 'Swipe right to save set' : 'Swipe right to log set'}
      leftIcon="remove"
      leftLabel="Stay here"
      rightIcon="checkmark"
      rightLabel={isEditingSet ? 'Save set' : 'Log set'}
      onSwipeRight={onCaptureSwipeRight}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <ReedText tone="muted" variant="caption">
            {[
              isEditingSet
                ? `Editing set ${editingSetNumber ?? captureCard.currentSetNumber}`
                : `Set ${captureCard.currentSetNumber}`,
              formatExerciseSetupLabel(captureCard.exerciseSetupModifiers),
            ].filter(Boolean).join(' · ')}
          </ReedText>
        </View>
        <View style={styles.cardHeaderActions}>
          {hasModifierControls ? (
            <Pressable
              disabled={isWorking}
              onPress={() => setShowModifierControls(current => !current)}
              style={({ pressed }) => [
                styles.warmupChip,
                {
                  backgroundColor: showModifierControls || hasActiveModifier ? theme.colors.controlActiveFill : theme.colors.controlFill,
                  borderColor: showModifierControls || hasActiveModifier ? theme.colors.borderStrong : theme.colors.controlBorder,
                  ...getTapScaleStyle(pressed, false),
                },
              ]}
            >
              <ReedText variant="caption">Details</ReedText>
            </Pressable>
          ) : null}
          <Pressable
            disabled={isWorking}
            onPress={onWarmupToggle}
            style={({ pressed }) => [
              styles.warmupChip,
              {
                backgroundColor: warmup ? warmupActiveFill : theme.colors.controlFill,
                borderColor: warmup ? warmupActiveBorder : theme.colors.controlBorder,
                ...getTapScaleStyle(pressed, false),
              },
            ]}
          >
            <ReedText style={{ color: warmup ? warmupActiveText : theme.colors.textPrimary }} variant="caption">
              Warm-up
            </ReedText>
          </Pressable>
        </View>
      </View>

      {showModifierControls ? (
        <View style={styles.modifierControlsRow}>
          {supportsInclineAngle ? (
            <Pressable
              disabled={isWorking}
              onPress={() =>
                onSetOutcomeDetailsChange({
                  ...setOutcomeDetails,
                  inclineAngleDegrees: getNextInclineAngle(inclineAngle),
                })
              }
              style={({ pressed }) => [
                styles.warmupChip,
                {
                  backgroundColor: inclineAngle === undefined ? theme.colors.controlFill : theme.colors.controlActiveFill,
                  borderColor: inclineAngle === undefined ? theme.colors.controlBorder : theme.colors.borderStrong,
                  ...getTapScaleStyle(pressed, false),
                },
              ]}
            >
              <ReedText variant="caption">{inclineAngle === undefined ? 'Angle' : `${inclineAngle}°`}</ReedText>
            </Pressable>
          ) : null}
          {supportsRangeOfMotion ? (
            <Pressable
              disabled={isWorking}
              onPress={() => onSetOutcomeDetailsChange({ ...setOutcomeDetails, rangeOfMotion: getNextRangeOfMotion(rangeOfMotion) })}
              style={({ pressed }) => [
                styles.warmupChip,
                {
                  backgroundColor: rangeOfMotion === 'full' ? theme.colors.controlFill : theme.colors.controlActiveFill,
                  borderColor: rangeOfMotion === 'full' ? theme.colors.controlBorder : theme.colors.borderStrong,
                  ...getTapScaleStyle(pressed, false),
                },
              ]}
            >
              <ReedText variant="caption">{getRangeOfMotionLabel(rangeOfMotion)}</ReedText>
            </Pressable>
          ) : null}
          {supportsFailure ? (
            <Pressable
              disabled={isWorking}
              onPress={() =>
                onSetOutcomeDetailsChange({
                  ...setOutcomeDetails,
                  failedReps: failedReps > 0 ? undefined : 1,
                })
              }
              style={({ pressed }) => [
                styles.warmupChip,
                {
                  backgroundColor: failedReps > 0 ? theme.colors.dangerFill : theme.colors.controlFill,
                  borderColor: failedReps > 0 ? theme.colors.dangerBorder : theme.colors.controlBorder,
                  ...getTapScaleStyle(pressed, false),
                },
              ]}
            >
              <ReedText style={{ color: failedReps > 0 ? theme.colors.dangerText : theme.colors.textPrimary }} variant="caption">
                Fail
              </ReedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {captureCard.layoutKind === 'unilateral_pair' ? (
        <View style={styles.unilateralSwitchRow}>
          <SegmentedControl<'left' | 'right'>
            compact
            onChange={nextSide => {
              if (isWorking) {
                return;
              }
              onSetActiveSide(nextSide);
            }}
            options={[
              { label: 'Left', value: 'left' },
              { label: 'Right', value: 'right' },
            ]}
            value={activeSide}
            variant="pill"
          />
        </View>
      ) : null}

      <View style={[styles.metricsStack, metricsStackVariantStyle]}>
        {captureFields.map(field => (
          <WorkoutMetricPicker
            compact={captureFieldCount > 3}
            field={field}
            key={field.key}
            onChange={nextValue => onUpdateMetric(field.key, nextValue)}
            onInteractionEnd={onPickerInteractionEnd}
            onInteractionStart={onPickerInteractionStart}
            previousValue={captureCard.previousMetrics?.[field.key]}
            value={metricValues[field.key] ?? captureCard.initialMetrics[field.key]}
          />
        ))}
      </View>

      {errorMessage ? (
        <ReedText style={styles.inlineError} tone="danger">
          {errorMessage}
        </ReedText>
      ) : null}
    </WorkoutSwipeCard>
  );
}

const inclineAngleCycle = [15, 30, 45, 60, 75, undefined] as const;

function getNextInclineAngle(current: number | undefined) {
  const currentIndex = inclineAngleCycle.findIndex(value => value === current);
  return inclineAngleCycle[(currentIndex + 1) % inclineAngleCycle.length];
}

const rangeOfMotionCycle: RangeOfMotion[] = ['full', 'top_partial', 'bottom_partial', 'mid_partial'];

function getNextRangeOfMotion(current: RangeOfMotion): RangeOfMotion {
  const currentIndex = rangeOfMotionCycle.indexOf(current);
  return rangeOfMotionCycle[(currentIndex + 1) % rangeOfMotionCycle.length] ?? 'full';
}

function getRangeOfMotionLabel(rangeOfMotion: RangeOfMotion) {
  switch (rangeOfMotion) {
    case 'top_partial':
      return 'Top partial';
    case 'bottom_partial':
      return 'Bottom partial';
    case 'mid_partial':
      return 'Mid partial';
    case 'full':
    default:
      return 'Full ROM';
  }
}

function getSideFields(captureCard: CaptureCard, activeSide: 'left' | 'right') {
  if (captureCard.layoutKind !== 'unilateral_pair') {
    return { activeSideFields: captureCard.fields, sharedFields: [] as RecipeFieldDefinition[] };
  }

  const activeSideFields = captureCard.fields.filter(field =>
    activeSide === 'left' ? field.group === 'left' : field.group === 'right',
  );
  const sharedFields = captureCard.fields.filter(field => field.group === 'shared');

  return { activeSideFields, sharedFields };
}

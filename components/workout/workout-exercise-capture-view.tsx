import { Pressable, View } from 'react-native';
import type { RecipeFieldDefinition } from '@/domains/workout/recipes';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { WorkoutMetricPicker } from './workout-metric-picker';
import { styles } from './workout-surface.styles';
import type { CaptureCard, MetricValues } from './workout-surface.types';
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
  onUpdateMetric: (key: string, nextValue: number) => void;
  onWarmupToggle: () => void;
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
  onUpdateMetric,
  onWarmupToggle,
  warmup,
}: CaptureViewProps) {
  const { theme } = useReedTheme();
  const warmupActiveFill = theme.mode === 'dark' ? 'rgba(251, 191, 36, 0.22)' : 'rgba(245, 158, 11, 0.2)';
  const warmupActiveBorder = theme.mode === 'dark' ? '#f59e0b' : '#d97706';
  const warmupActiveText = theme.mode === 'dark' ? '#fde68a' : '#92400e';
  const { activeSideFields, sharedFields } = getSideFields(captureCard, activeSide);
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
            {isEditingSet
              ? `Editing set ${editingSetNumber ?? captureCard.currentSetNumber}`
              : `Set ${captureCard.currentSetNumber}${
                  captureCard.previousSetSummary ? ` · Last ${captureCard.previousSetSummary}` : ' · First set'
                }`}
          </ReedText>
        </View>
        <View style={styles.cardHeaderActions}>
          <Pressable
            onPress={onWarmupToggle}
            style={({ pressed }) => [
              styles.warmupChip,
              {
                backgroundColor: warmup ? warmupActiveFill : theme.colors.controlFill,
                borderColor: warmup ? warmupActiveBorder : theme.colors.controlBorder,
                ...getTapScaleStyle(pressed, isWorking),
              },
            ]}
          >
            <ReedText style={{ color: warmup ? warmupActiveText : theme.colors.textPrimary }} variant="caption">
              Warm-up
            </ReedText>
          </Pressable>
        </View>
      </View>

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

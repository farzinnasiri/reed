import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { WorkoutMetricPicker } from './workout-metric-picker';
import { WorkoutRestRing } from './workout-rest-ring';
import { styles } from './workout-surface.styles';
import type { CaptureCard, MetricValues, RestCard } from './workout-surface.types';
import { WorkoutSwipeCard } from './workout-swipe-card';

type ExercisePageProps = {
  captureCard: CaptureCard | null;
  editingSetNumber: number | null;
  errorMessage: string | null;
  isEditingSet: boolean;
  isPickerInteracting: boolean;
  isWorking: boolean;
  metricValues: MetricValues;
  onAdjustRest: (deltaSeconds: number) => void;
  onBackToTimeline: () => void;
  onCaptureSwipeRight: () => void;
  onPickerInteractionEnd: () => void;
  onPickerInteractionStart: () => void;
  onPresetRest: (durationSeconds: number) => void;
  onRestSwipeLeft: () => void;
  onRestSwipeRight: () => void;
  onToggleRestRunning: () => void;
  onUpdateMetric: (key: string, nextValue: number) => void;
  onWarmupToggle: () => void;
  restCard: RestCard | null;
  restRemaining: number;
  restRunning: boolean;
  warmup: boolean;
};

export function ExercisePage({
  captureCard,
  editingSetNumber,
  errorMessage,
  isEditingSet,
  isPickerInteracting,
  isWorking,
  metricValues,
  onAdjustRest,
  onBackToTimeline,
  onCaptureSwipeRight,
  onPickerInteractionEnd,
  onPickerInteractionStart,
  onPresetRest,
  onRestSwipeLeft,
  onRestSwipeRight,
  onToggleRestRunning,
  onUpdateMetric,
  onWarmupToggle,
  restCard,
  restRemaining,
  restRunning,
  warmup,
}: ExercisePageProps) {
  const { theme } = useReedTheme();
  const { width } = useWindowDimensions();
  const title = captureCard?.exerciseName ?? restCard?.exerciseName ?? 'Exercise';
  const timerRingSize = Math.max(176, Math.min(228, Math.floor(width - 150)));
  const warmupActiveFill = theme.mode === 'dark' ? 'rgba(251, 191, 36, 0.22)' : 'rgba(245, 158, 11, 0.2)';
  const warmupActiveBorder = theme.mode === 'dark' ? '#f59e0b' : '#d97706';
  const warmupActiveText = theme.mode === 'dark' ? '#fde68a' : '#92400e';
  const captureFieldCount = captureCard?.fields.length ?? 0;
  const metricsStackVariantStyle =
    captureFieldCount <= 1
      ? styles.metricsStackSingle
      : captureFieldCount === 2
        ? styles.metricsStackPair
        : captureFieldCount === 3
          ? styles.metricsStackTriple
          : styles.metricsStackDense;

  return (
    <View style={styles.exercisePage}>
      <View style={styles.exerciseTopRow}>
        <Pressable onPress={onBackToTimeline} style={styles.navButton}>
          <Ionicons color={String(theme.colors.textPrimary)} name="arrow-back" size={18} />
        </Pressable>
        <ReedText numberOfLines={1} style={styles.exerciseTitle} variant="title">
          {title}
        </ReedText>
        <View style={styles.navButtonSpacer} />
      </View>

      <View style={styles.cardArea}>
        {captureCard ? (
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
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <ReedText
                    style={{ color: warmup ? warmupActiveText : theme.colors.textPrimary }}
                    variant="caption"
                  >
                    Warm-up
                  </ReedText>
                </Pressable>
              </View>
            </View>

            <View style={[styles.metricsStack, metricsStackVariantStyle]}>
              {captureCard.fields.map(field => (
                <WorkoutMetricPicker
                  compact={captureFieldCount > 3}
                  field={field}
                  key={field.key}
                  onInteractionEnd={onPickerInteractionEnd}
                  onInteractionStart={onPickerInteractionStart}
                  onChange={nextValue => onUpdateMetric(field.key, nextValue)}
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
        ) : restCard ? (
          <WorkoutSwipeCard
            disabled={isWorking}
            hint="Swipe right to start next · Swipe left to go back"
            leftIcon="play-back"
            leftLabel="Go back"
            leftTone="danger"
            rightIcon="play-forward"
            rightLabel="Next set"
            onSwipeLeft={onRestSwipeLeft}
            onSwipeRight={onRestSwipeRight}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderCopy}>
                <ReedText tone="muted" variant="caption">
                  Next set {restCard.nextSetNumber}
                  {restCard.previousSetSummary ? ` · ${restCard.previousSetSummary}` : ''}
                </ReedText>
              </View>
            </View>

            <View style={styles.restBody}>
              <View style={styles.restMainGroup}>
                <View style={styles.restTopRow}>
                  <Pressable onPress={onToggleRestRunning} style={styles.timerButton}>
                    <WorkoutRestRing
                      durationSeconds={restCard.durationSeconds}
                      isRunning={restRunning}
                      remainingSeconds={restRemaining}
                      size={timerRingSize}
                    />
                  </Pressable>

                  <View style={styles.restSteps}>
                    {[-15, 15].map(delta => (
                      <Pressable
                        key={delta}
                        onPress={() => onAdjustRest(delta)}
                        style={({ pressed }) => [
                          styles.restStep,
                          {
                            backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.42)',
                            borderColor: theme.colors.controlBorder,
                            opacity: pressed ? 0.9 : 1,
                          },
                        ]}
                      >
                        <ReedText variant="title">{delta > 0 ? `+${delta}` : `${delta}`}</ReedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.presetRow}>
                {[30, 60, 90, 120].map(seconds => (
                  <Pressable
                    key={seconds}
                    onPress={() => onPresetRest(seconds)}
                    style={({ pressed }) => [
                      styles.presetChip,
                      {
                        backgroundColor:
                          restCard.durationSeconds === seconds
                            ? theme.mode === 'dark'
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(255,255,255,0.92)'
                            : 'transparent',
                        borderColor:
                          restCard.durationSeconds === seconds
                            ? theme.colors.accentPrimary
                            : 'transparent',
                        borderWidth: restCard.durationSeconds === seconds ? 3 : 1,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <ReedText
                      style={{
                        color: restCard.durationSeconds === seconds ? theme.colors.accentPrimary : theme.colors.textPrimary,
                      }}
                      variant="title"
                    >
                      {seconds}s
                    </ReedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {errorMessage ? (
              <ReedText style={styles.inlineError} tone="danger">
                {errorMessage}
              </ReedText>
            ) : null}
          </WorkoutSwipeCard>
        ) : (
          <View style={styles.cardPlaceholder}>
            <ReedText tone="muted">Pick an exercise from the timeline.</ReedText>
          </View>
        )}
      </View>
    </View>
  );
}

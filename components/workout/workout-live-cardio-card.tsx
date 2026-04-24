import { Pressable, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import type { RecipeFieldDefinition } from '@/domains/workout/recipes';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { styles } from './workout-surface.styles';
import type { CaptureCard, LiveCardioCard, LiveCardioFinishSummary } from './workout-surface.types';
import { formatClock } from './workout-surface.utils';

type WorkoutLiveCardioCardProps = {
  captureCard: CaptureCard | null;
  errorMessage: string | null;
  isEditingSet: boolean;
  isWorking: boolean;
  liveElapsedSeconds: number;
  liveCardioCard: LiveCardioCard | null;
  liveCardioFinishSummary: LiveCardioFinishSummary | null;
  onAdjustLiveCardioMetric: (key: string, delta: number) => void;
  onBackToTimeline: () => void;
  onFinishLiveCardio: () => void;
  onOpenNextExerciseAfterLiveCardio: () => void;
  onStartLiveCardio: (sessionExerciseId: CaptureCard['sessionExerciseId']) => void;
  onToggleLiveCardioRunning: () => void;
  ringSize: number;
};

export function WorkoutLiveCardioCard({
  captureCard,
  errorMessage,
  isEditingSet,
  isWorking,
  liveElapsedSeconds,
  liveCardioCard,
  liveCardioFinishSummary,
  onAdjustLiveCardioMetric,
  onBackToTimeline,
  onFinishLiveCardio,
  onOpenNextExerciseAfterLiveCardio,
  onStartLiveCardio,
  onToggleLiveCardioRunning,
  ringSize,
}: WorkoutLiveCardioCardProps) {
  const { theme } = useReedTheme();
  const showLiveCardioCaptureStart = captureCard?.processKind === 'live_cardio' && !isEditingSet;

  if (liveCardioFinishSummary) {
    return (
      <View
        style={[
          styles.liveCardShell,
          {
            backgroundColor: theme.colors.glassFallback,
            borderColor: theme.colors.glassHighlight,
          },
        ]}
      >
        <View style={styles.liveSummaryBody}>
          <LiveCardioElapsedTimer
            elapsedSeconds={liveCardioFinishSummary.elapsedSeconds}
            isRunning={false}
            label="Workout effort complete"
            size={ringSize}
          />
          <View style={styles.liveSummaryMeta}>
            <ReedText style={styles.liveSummaryValue} variant="title">
              {getSummaryPrimary(liveCardioFinishSummary.summary)}
            </ReedText>
          </View>
        </View>

        <View style={styles.liveSummaryActions}>
          <Pressable
            disabled={isWorking}
            onPress={onBackToTimeline}
            style={({ pressed }) => [
              styles.livePrimaryButton,
              {
                backgroundColor: theme.colors.accentPrimary,
                ...getTapScaleStyle(pressed, isWorking),
              },
            ]}
          >
            <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="bodyStrong">
              Back to workout
            </ReedText>
          </Pressable>
          <Pressable
            disabled={isWorking || !liveCardioFinishSummary.nextExerciseId}
            onPress={onOpenNextExerciseAfterLiveCardio}
            style={({ pressed }) => [
              styles.liveFinishButton,
              {
                borderColor: theme.colors.controlActiveBorder,
                ...getTapScaleStyle(pressed, isWorking || !liveCardioFinishSummary.nextExerciseId),
              },
            ]}
          >
            <ReedText variant="bodyStrong">Next exercise</ReedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (liveCardioCard) {
    return (
      <View
        style={[
          styles.liveCardShell,
          {
            backgroundColor: theme.colors.glassFallback,
            borderColor: theme.colors.glassHighlight,
          },
        ]}
      >
        <View style={styles.liveCardBody}>
          <View style={styles.liveCardTimerSection}>
            {liveCardioCard.previousSetSummary ? (
              <ReedText tone="muted" variant="caption">
                Last {liveCardioCard.previousSetSummary}
              </ReedText>
            ) : null}
            <Pressable
              disabled={isWorking}
              onPress={onToggleLiveCardioRunning}
              style={({ pressed }) => [
                styles.liveRingButton,
                getTapScaleStyle(pressed, isWorking),
              ]}
            >
              <LiveCardioElapsedTimer
                elapsedSeconds={liveElapsedSeconds}
                isRunning={liveCardioCard.isRunning}
                size={ringSize}
              />
            </Pressable>

            <View style={styles.livePrimaryActions}>
              <Pressable
                disabled={isWorking}
                onPress={onToggleLiveCardioRunning}
                style={({ pressed }) => [
                  styles.livePrimaryButton,
                  {
                    backgroundColor: theme.colors.accentPrimary,
                    ...getTapScaleStyle(pressed, isWorking),
                  },
                ]}
              >
                <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="bodyStrong">
                  {liveCardioCard.isRunning
                    ? 'Pause'
                    : liveElapsedSeconds > 0
                      ? 'Resume'
                      : 'Start'}
                </ReedText>
              </Pressable>
              <Pressable
                disabled={isWorking}
                onPress={onFinishLiveCardio}
                style={({ pressed }) => [
                  styles.liveFinishButton,
                  {
                    borderColor: theme.colors.controlActiveBorder,
                    ...getTapScaleStyle(pressed, isWorking),
                  },
                ]}
              >
                <ReedText tone="danger" variant="bodyStrong">
                  Finish
                </ReedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.liveMetricList}>
            {liveCardioCard.trackedFields.map(field => {
              const value = liveCardioCard.trackedMetrics[field.key] ?? field.defaultValue;
              const step = field.step || 1;
              const presetStep = getPresetStep(step);

              return (
                <View key={field.key} style={styles.liveMetricRow}>
                  <View style={styles.liveMetricCopy}>
                    <ReedText tone="muted" variant="caption">
                      {field.label}
                    </ReedText>
                    <ReedText variant="title">{formatTrackedMetric(field, value)}</ReedText>
                  </View>
                  <View style={styles.liveMetricActions}>
                    <StepButton
                      disabled={isWorking}
                      label={`-${formatDelta(step)}`}
                      onPress={() => onAdjustLiveCardioMetric(field.key, -step)}
                    />
                    <StepButton
                      disabled={isWorking}
                      label={`+${formatDelta(step)}`}
                      onPress={() => onAdjustLiveCardioMetric(field.key, step)}
                    />
                    <StepButton
                      disabled={isWorking}
                      label={`+${formatDelta(presetStep)}`}
                      onPress={() => onAdjustLiveCardioMetric(field.key, presetStep)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {errorMessage ? (
          <ReedText style={styles.inlineError} tone="danger">
            {errorMessage}
          </ReedText>
        ) : null}
      </View>
    );
  }

  if (showLiveCardioCaptureStart && captureCard) {
    return (
      <View
        style={[
          styles.liveCardShell,
          {
            backgroundColor: theme.colors.glassFallback,
            borderColor: theme.colors.glassHighlight,
          },
        ]}
      >
        <View style={styles.liveCardStartState}>
          {captureCard.previousSetSummary ? (
            <ReedText style={styles.liveStartHint} tone="muted" variant="caption">
              Last {captureCard.previousSetSummary}
            </ReedText>
          ) : null}
          <Pressable
            disabled={isWorking}
            onPress={() => onStartLiveCardio(captureCard.sessionExerciseId)}
            style={({ pressed }) => [
              styles.livePrimaryButton,
              {
                backgroundColor: theme.colors.accentPrimary,
                ...getTapScaleStyle(pressed, isWorking),
              },
            ]}
          >
            <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="bodyStrong">
              {isWorking ? 'Starting…' : 'Start tracking'}
            </ReedText>
          </Pressable>
        </View>

        {errorMessage ? (
          <ReedText style={styles.inlineError} tone="danger">
            {errorMessage}
          </ReedText>
        ) : null}
      </View>
    );
  }

  return null;
}

function StepButton({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useReedTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.liveStepButton,
        {
          backgroundColor: theme.colors.controlFill,
          borderColor: theme.colors.controlBorder,
          ...getTapScaleStyle(pressed, disabled),
        },
      ]}
    >
      <ReedText variant="caption">{label}</ReedText>
    </Pressable>
  );
}

function LiveCardioElapsedTimer({
  elapsedSeconds,
  isRunning,
  label,
  size,
}: {
  elapsedSeconds: number;
  isRunning: boolean;
  label?: string;
  size: number;
}) {
  const { theme } = useReedTheme();

  return (
    <View style={styles.liveElapsedTimerShell}>
      <View
        style={[
          styles.liveElapsedTimerRing,
          {
            borderColor: theme.colors.controlBorder,
            height: size,
            width: size,
          },
        ]}
      >
        <View style={styles.liveElapsedCopy}>
          <ReedText
            style={{
              color: theme.colors.textPrimary,
              fontSize: Math.round(size * 0.3),
              letterSpacing: -2,
              lineHeight: Math.round(size * 0.28),
            }}
            variant="display"
          >
            {formatClock(elapsedSeconds)}
          </ReedText>
          <ReedText style={{ color: theme.colors.textMuted }} variant="section">
            {label ?? (isRunning ? 'Tap to pause' : elapsedSeconds > 0 ? 'Tap to resume' : 'Tap to start')}
          </ReedText>
        </View>
      </View>
    </View>
  );
}

function formatTrackedMetric(field: RecipeFieldDefinition, value: number) {
  const rounded = roundMetric(value);

  if (field.unit === 'km') {
    return `${rounded.toFixed(2)} km`;
  }

  if (field.unit === 'kg') {
    return `${rounded.toFixed(1)} kg`;
  }

  if (field.unit === 'floors') {
    return `${Math.round(rounded)} floors`;
  }

  if (field.unit === 'km/h') {
    return `${rounded.toFixed(1)} km/h`;
  }

  return `${Math.round(rounded)}s`;
}

function formatDelta(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(1);
}

function getPresetStep(step: number) {
  return step >= 1 ? step * 5 : roundMetric(step * 10);
}

function roundMetric(value: number) {
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function getSummaryPrimary(summary: string) {
  const trimmed = summary.trim();
  if (!trimmed) {
    return 'No metrics logged';
  }

  if (trimmed.includes(' in ')) {
    const [left] = trimmed.split(' in ');
    return left.trim();
  }

  return trimmed;
}

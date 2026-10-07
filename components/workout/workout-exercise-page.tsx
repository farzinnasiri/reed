import { useReedTheme } from '@/design/provider';
import { getTapScaleStyle } from '@/design/motion';
import { useEffect, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Id } from '@/convex/_generated/dataModel';
import { ReedText } from '@/components/ui/reed-text';
import { ReedSwapExercise, ReedSwapText } from '@/components/reed/session/reed-swap-feedback';
import { styles } from './workout-exercise-page.styles';
import type {
  CaptureCard,
  LiveCardioCard,
  LiveCardioFinishSummary,
  MetricValues,
  RestCard,
  SetOutcomeDetails,
} from './workout-surface.types';
import { WorkoutExerciseCaptureView } from './workout-exercise-capture-view';
import { WorkoutExerciseRestView } from './workout-exercise-rest-view';
import { WorkoutLiveCardioCard } from './workout-live-cardio-card';

type ExercisePageProps = {
  contentTopInset?: number;
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
    onCaptureSwipeRight: () => void;
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
    onStart: (sessionExerciseId: Id<'liveSessionExercises'>) => void;
    onToggleRunning: () => void;
  };
  rest: {
    card: RestCard | null;
    errorMessage: string | null;
    isWorking: boolean;
    onAdjust: (deltaSeconds: number) => void;
    onPreset: (durationSeconds: number) => void;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    onToggleRunning: () => void;
  };
};

export function ExercisePage({ contentTopInset, navigation, capture, liveCardio, rest }: ExercisePageProps) {
  const { width } = useWindowDimensions();
  const title =
    liveCardio.card?.exerciseName ??
    liveCardio.finishSummary?.exerciseName ??
    capture.card?.exerciseName ??
    rest.card?.exerciseName ??
    'Exercise';
  const liveCardRingSize = Math.max(168, Math.min(216, Math.floor(width - 170)));
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left');
  const [manualCardio, setManualCardio] = useState(false);
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();

  const captureKey = `${capture.card?.sessionExerciseId}|${capture.card?.recipeKey}`;
  const [previousCaptureKey, setPreviousCaptureKey] = useState(captureKey);
  if (previousCaptureKey !== captureKey) { setPreviousCaptureKey(captureKey); setActiveSide('left'); setManualCardio(false); }

  useEffect(() => {
    if (__DEV__ && capture.card?.layoutKind === 'unilateral_pair') {
      const fieldKeys = capture.card.fields.map(field => field.key);
      if (new Set(fieldKeys).size !== fieldKeys.length) {
        console.warn('Duplicate unilateral field keys detected. Left/right metrics may overwrite each other.');
      }
    }
  }, [capture.card]);

  const showLiveCardioCaptureStart = capture.card?.processKind === 'live_cardio' && !capture.isEditingSet;
  const showLiveCardioView = Boolean(liveCardio.finishSummary || liveCardio.card || (showLiveCardioCaptureStart && !manualCardio));

  return (
    <ReedSwapExercise id={capture.card?.sessionExerciseId ?? rest.card?.sessionExerciseId ?? liveCardio.card?.sessionExerciseId ?? null}><View style={[styles.exercisePage, { paddingBottom: insets.bottom + theme.spacing.xs }, contentTopInset !== undefined ? { paddingTop: contentTopInset } : undefined]}>
      <View style={styles.exerciseTopRow}>
        {/* The session status strip is the canonical back affordance for this nested surface. */}
        <ReedSwapText numberOfLines={1} style={styles.exerciseTitle} variant="title">
          {title}
        </ReedSwapText>
      </View>

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
            activeSide={activeSide}
            captureCard={capture.card}
            editingSetNumber={capture.editingSetNumber}
            errorMessage={capture.errorMessage}
            isEditingSet={capture.isEditingSet}
            isPickerInteracting={capture.isPickerInteracting}
            isWorking={capture.isWorking}
            metricValues={capture.metricValues}
            onCaptureSwipeRight={capture.onCaptureSwipeRight}
            onPickerInteractionEnd={capture.onPickerInteractionEnd}
            onPickerInteractionStart={capture.onPickerInteractionStart}
            onSetActiveSide={setActiveSide}
            onSetOutcomeDetailsChange={capture.onSetOutcomeDetailsChange}
            onUpdateMetric={capture.onUpdateMetric}
            onWarmupToggle={capture.onWarmupToggle}
            setOutcomeDetails={capture.setOutcomeDetails}
            warmup={capture.warmup}
          />
        ) : rest.card ? (
          <WorkoutExerciseRestView
            errorMessage={rest.errorMessage}
            isWorking={rest.isWorking}
            onAdjustRest={rest.onAdjust}
            onPresetRest={rest.onPreset}
            onRestSwipeLeft={rest.onSwipeLeft}
            onRestSwipeRight={rest.onSwipeRight}
            onToggleRestRunning={rest.onToggleRunning}
            restCard={rest.card}
          />
        ) : (
          <View style={styles.cardPlaceholder}>
            <ReedText tone="muted">Pick an exercise from the timeline.</ReedText>
          </View>
        )}
        {showLiveCardioCaptureStart && !liveCardio.card && !liveCardio.finishSummary ? (
          <Pressable accessibilityRole="button" accessibilityLabel={manualCardio ? 'Track cardio live' : 'Log cardio manually'} onPress={() => setManualCardio(value => !value)} style={({ pressed }) => [{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.sm }, getTapScaleStyle(pressed)]}>
            <ReedText tone="muted">{manualCardio ? 'Track live instead' : 'Log manually'}</ReedText>
          </Pressable>
        ) : null}
      </View>
    </View></ReedSwapExercise>
  );
}

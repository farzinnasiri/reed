import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { Id } from '@/convex/_generated/dataModel';
import { ReedText } from '@/components/ui/reed-text';
import { styles } from './workout-surface.styles';
import type {
  CaptureCard,
  LiveCardioCard,
  LiveCardioFinishSummary,
  MetricValues,
  RestCard,
} from './workout-surface.types';
import { WorkoutExerciseCaptureView } from './workout-exercise-capture-view';
import { WorkoutExerciseRestView } from './workout-exercise-rest-view';
import { WorkoutLiveCardioCard } from './workout-live-cardio-card';

type ExercisePageProps = {
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
    onUpdateMetric: (key: string, nextValue: number) => void;
    onWarmupToggle: () => void;
    warmup: boolean;
  };
  liveCardio: {
    card: LiveCardioCard | null;
    elapsedSeconds: number;
    errorMessage: string | null;
    finishSummary: LiveCardioFinishSummary | null;
    isWorking: boolean;
    onAdjustMetric: (key: string, delta: number) => void;
    onFinish: () => void;
    onOpenNextExercise: () => void;
    onStart: (sessionExerciseId: Id<'liveSessionExercises'>) => void;
    onToggleRunning: () => void;
  };
  rest: {
    card: RestCard | null;
    errorMessage: string | null;
    isRunning: boolean;
    isWorking: boolean;
    onAdjust: (deltaSeconds: number) => void;
    onPreset: (durationSeconds: number) => void;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    onToggleRunning: () => void;
    remaining: number;
  };
};

export function ExercisePage({ navigation, capture, liveCardio, rest }: ExercisePageProps) {
  const { width } = useWindowDimensions();
  const title =
    liveCardio.card?.exerciseName ??
    liveCardio.finishSummary?.exerciseName ??
    capture.card?.exerciseName ??
    rest.card?.exerciseName ??
    'Exercise';
  const liveCardRingSize = Math.max(168, Math.min(216, Math.floor(width - 170)));
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left');

  useEffect(() => {
    setActiveSide('left');
  }, [capture.card?.recipeKey, capture.card?.sessionExerciseId]);

  useEffect(() => {
    if (__DEV__ && capture.card?.layoutKind === 'unilateral_pair') {
      const fieldKeys = capture.card.fields.map(field => field.key);
      if (new Set(fieldKeys).size !== fieldKeys.length) {
        console.warn('Duplicate unilateral field keys detected. Left/right metrics may overwrite each other.');
      }
    }
  }, [capture.card]);

  const showLiveCardioCaptureStart = capture.card?.processKind === 'live_cardio' && !capture.isEditingSet;
  const showLiveCardioView = Boolean(liveCardio.finishSummary || liveCardio.card || showLiveCardioCaptureStart);

  return (
    <View style={styles.exercisePage}>
      <View style={styles.exerciseTopRow}>
        {/* The session status strip is the canonical back affordance for this nested surface. */}
        <ReedText numberOfLines={1} style={styles.exerciseTitle} variant="title">
          {title}
        </ReedText>
      </View>

      <View style={styles.cardArea}>
        {showLiveCardioView ? (
          <WorkoutLiveCardioCard
            captureCard={capture.card}
            errorMessage={liveCardio.errorMessage}
            isEditingSet={capture.isEditingSet}
            isWorking={liveCardio.isWorking}
            liveElapsedSeconds={liveCardio.elapsedSeconds}
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
            onUpdateMetric={capture.onUpdateMetric}
            onWarmupToggle={capture.onWarmupToggle}
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
            restRemaining={rest.remaining}
            restRunning={rest.isRunning}
          />
        ) : (
          <View style={styles.cardPlaceholder}>
            <ReedText tone="muted">Pick an exercise from the timeline.</ReedText>
          </View>
        )}
      </View>
    </View>
  );
}

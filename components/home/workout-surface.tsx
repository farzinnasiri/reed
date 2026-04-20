import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { AddExerciseSheet } from './workout-add-exercise-sheet';
import { ExercisePage } from './workout-exercise-page';
import { styles } from './workout-surface.styles';
import type {
  CaptureCard,
  EditingSet,
  MetricValues,
  RestCard,
  TimelineSet,
  WorkoutPage,
} from './workout-surface.types';
import { TimelinePage } from './workout-timeline-page';
import { clampSeconds, formatElapsed, getErrorMessage } from './workout-surface.utils';

type WorkoutSurfaceProps = {
  onExitWorkout: () => void;
  showStartBackButton?: boolean;
};

const SHOULD_USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function WorkoutSurface({ onExitWorkout, showStartBackButton = true }: WorkoutSurfaceProps) {
  const { theme } = useReedTheme();
  const session = useQuery(api.liveSessions.getCurrent, {});
  const latestEndedSummary = useQuery(api.liveSessions.getLatestEndedSummary, {});
  const startSession = useMutation(api.liveSessions.start);
  const addExercise = useMutation(api.liveSessions.addExercise);
  const removeExercise = useMutation(api.liveSessions.removeExercise);
  const selectExercise = useMutation(api.liveSessions.selectExercise);
  const logSet = useMutation(api.liveSessions.logSet);
  const updateSet = useMutation(api.liveSessions.updateSet);
  const deleteSet = useMutation(api.liveSessions.deleteSet);
  const finishSession = useMutation(api.liveSessions.finishSession);
  const endRest = useMutation(api.liveSessions.endRest);
  const updateRestProcess = useMutation(api.liveSessions.updateRestProcess);
  const toggleFavorite = useMutation(api.exerciseCatalog.toggleFavorite);

  const [isWorking, setIsWorking] = useState(false);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [warmup, setWarmup] = useState(false);
  const [metricValues, setMetricValues] = useState<MetricValues>({});
  const [restRemaining, setRestRemaining] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [isPickerInteracting, setIsPickerInteracting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState<WorkoutPage>('timeline');
  const [elapsedNow, setElapsedNow] = useState(() => Date.now());
  const [editingSet, setEditingSet] = useState<EditingSet | null>(null);
  const [isConfirmingFinishSession, setIsConfirmingFinishSession] = useState(false);
  const pageTransition = useRef(new Animated.Value(1)).current;
  const lastAnimatedPageRef = useRef<WorkoutPage>('timeline');

  const addSheet = useQuery(
    api.exerciseCatalog.searchForAddSheet,
    isAddSheetOpen
      ? {
          equipment: selectedEquipment,
          muscleGroup: selectedMuscleGroup,
          query: searchText.trim() || undefined,
        }
      : 'skip',
  );

  const captureCard = (session?.activeCard.capture ?? null) as CaptureCard | null;
  const restCard = (session?.activeCard.rest ?? null) as RestCard | null;
  const activeSetEditor = useMemo(() => {
    if (!captureCard || !editingSet || editingSet.sessionExerciseId !== captureCard.sessionExerciseId) {
      return null;
    }

    return editingSet;
  }, [captureCard, editingSet]);

  // Use a stable key that covers the capture card's full identity so that
  // reshaping initialMetrics (e.g. recipe change) also triggers a reset,
  // not just set-number / exercise-id transitions.
  const captureCardKey = captureCard
    ? `${captureCard.sessionExerciseId}:${captureCard.currentSetNumber}:${captureCard.recipeKey}`
    : null;
  const lastCaptureCardKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!captureCard || !captureCardKey || activeSetEditor) {
      return;
    }

    if (captureCardKey === lastCaptureCardKeyRef.current) {
      return;
    }

    lastCaptureCardKeyRef.current = captureCardKey;
    setIsPickerInteracting(false);
    setMetricValues(captureCard.initialMetrics);
    setWarmup(false);
    setErrorMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureCardKey, activeSetEditor]);

  useEffect(() => {
    if (!activeSetEditor) {
      return;
    }
    setMetricValues(activeSetEditor.metrics);
    setWarmup(activeSetEditor.warmup);
    setErrorMessage(null);
  }, [activeSetEditor]);

  useEffect(() => {
    if (!restCard) {
      return;
    }

    setIsPickerInteracting(false);
    setEditingSet(null);
    setRestRemaining(restCard.remainingSeconds);
    setRestRunning(restCard.isRunning);
    setErrorMessage(null);
  }, [restCard?.isRunning, restCard?.nextSetNumber, restCard?.remainingSeconds, restCard?.sessionExerciseId]);

  useEffect(() => {
    if (!session) {
      setPage('timeline');
      setEditingSet(null);
      return;
    }

    const hasTimelineRows = session.timeline.length > 0;
    if (page === 'exercise' && !captureCard && !restCard && !hasTimelineRows) {
      setPage('timeline');
    }
  }, [captureCard, page, restCard, session]);

  useEffect(() => {
    if (!session || !editingSet) {
      return;
    }

    const exists = session.timeline.some(
      row =>
        row.sessionExerciseId === editingSet.sessionExerciseId &&
        row.sets.some(setEntry => setEntry.setLogId === editingSet.setLogId),
    );

    if (!exists) {
      setEditingSet(null);
    }
  }, [editingSet, session]);

  useEffect(() => {
    if (session?.cardMode !== 'rest' || !restRunning || restRemaining <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setRestRemaining(current => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [restRemaining, restRunning, session?.cardMode]);

  useEffect(() => {
    if (restRemaining === 0) {
      setRestRunning(false);
    }
  }, [restRemaining]);

  useEffect(() => {
    if (!session?.session.startedAt) {
      return;
    }

    setElapsedNow(Date.now());

    const interval = setInterval(() => {
      setElapsedNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [session?.session.startedAt]);

  useEffect(() => {
    if (lastAnimatedPageRef.current === page) {
      return;
    }
    lastAnimatedPageRef.current = page;

    pageTransition.stopAnimation();
    pageTransition.setValue(0);
    Animated.timing(pageTransition, {
      duration: theme.motion.regular + 60,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: SHOULD_USE_NATIVE_DRIVER,
    }).start();
  }, [page, pageTransition, theme.motion.regular]);

  const elapsedLabel = useMemo(() => {
    if (!session?.session.startedAt) {
      return null;
    }

    return formatElapsed(session.session.startedAt, elapsedNow);
  }, [elapsedNow, session?.session.startedAt]);

  const closeAddSheet = () => {
    setIsAddSheetOpen(false);
    setSearchText('');
    setSelectedEquipment(null);
    setSelectedMuscleGroup(null);
  };

  async function runMutation(action: () => Promise<void>) {
    setIsWorking(true);
    setErrorMessage(null);

    try {
      await action();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleStartSession() {
    await runMutation(async () => {
      await startSession({});
    });
  }

  async function handleSelectExercise(sessionExerciseId: Id<'liveSessionExercises'>) {
    await runMutation(async () => {
      await selectExercise({ sessionExerciseId });
      setIsConfirmingFinishSession(false);
      setEditingSet(null);
      setPage('exercise');
    });
  }

  async function handleOpenSet(sessionExerciseId: Id<'liveSessionExercises'>, setEntry: TimelineSet) {
    await runMutation(async () => {
      await selectExercise({ sessionExerciseId });
      setIsConfirmingFinishSession(false);
      setEditingSet({
        metrics: setEntry.metrics,
        sessionExerciseId,
        setLogId: setEntry.setLogId,
        setNumber: setEntry.setNumber,
        warmup: setEntry.warmup,
      });
      setPage('exercise');
    });
  }

  async function handleAddExercise(exerciseCatalogId: Id<'exerciseCatalog'>) {
    await runMutation(async () => {
      await addExercise({ exerciseCatalogId });
      setIsConfirmingFinishSession(false);
      closeAddSheet();
    });
  }

  async function handleAddExercisesBulk(exerciseCatalogIds: Id<'exerciseCatalog'>[]) {
    if (exerciseCatalogIds.length === 0) {
      return;
    }

    await runMutation(async () => {
      for (const exerciseCatalogId of exerciseCatalogIds) {
        await addExercise({ exerciseCatalogId });
      }
      setIsConfirmingFinishSession(false);
      closeAddSheet();
    });
  }

  async function handleRemoveExercise(sessionExerciseId: Id<'liveSessionExercises'>) {
    await runMutation(async () => {
      await removeExercise({ sessionExerciseId });
    });
  }

  async function handleToggleFavorite(exerciseCatalogId: Id<'exerciseCatalog'>) {
    await runMutation(async () => {
      await toggleFavorite({ exerciseCatalogId });
    });
  }

  async function handleCaptureSwipeRight() {
    if (!captureCard) {
      return;
    }

    await runMutation(async () => {
      if (activeSetEditor) {
        await updateSet({
          metrics: metricValues,
          setLogId: activeSetEditor.setLogId,
          warmup,
        });
        setEditingSet(null);
        return;
      }

      await logSet({
        metrics: metricValues,
        sessionExerciseId: captureCard.sessionExerciseId,
        warmup,
      });
    });
  }

  async function handleDeleteSet(setLogId: Id<'liveSetLogs'>) {
    await runMutation(async () => {
      await deleteSet({ setLogId });
      if (editingSet?.setLogId === setLogId) {
        setEditingSet(null);
      }
    });
  }

  async function handleFinishSession() {
    await runMutation(async () => {
      await finishSession({});
      setIsConfirmingFinishSession(false);
      setEditingSet(null);
      setPage('timeline');
    });
  }

  async function handleRestSwipeRight() {
    await runMutation(async () => {
      await endRest({});
      // Stay on the exercise page; next-set capture card appears via getCurrent.
    });
  }

  async function handleRestSwipeLeft() {
    await runMutation(async () => {
      await endRest({});
      // Return to the timeline so the user can pick a different exercise.
      setPage('timeline');
    });
  }

  async function handleToggleRestRunning() {
    if (!restCard) {
      return;
    }

    setRestRunning(current => !current);

    if (!restRunning && restRemaining === 0) {
      setRestRemaining(restCard.durationSeconds);
    }

    await runMutation(async () => {
      await updateRestProcess({ mode: 'toggleRunning' });
    });
  }

  async function handleAdjustRest(deltaSeconds: number) {
    setRestRemaining(current => clampSeconds(current + deltaSeconds, 15, 240));

    await runMutation(async () => {
      await updateRestProcess({ deltaSeconds, mode: 'adjustBy' });
    });
  }

  async function handlePresetRest(durationSeconds: number) {
    setRestRemaining(durationSeconds);

    await runMutation(async () => {
      await updateRestProcess({ durationSeconds, mode: 'setDuration' });
    });
  }

  if (session === undefined) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator color={String(theme.colors.accentPrimary)} />
      </View>
    );
  }

  if (session === null) {
    const completedExercises = latestEndedSummary?.exercises ?? [];

    return (
      <View style={styles.startState}>
        {showStartBackButton ? (
          <View style={styles.startTopRow}>
            <Pressable onPress={onExitWorkout} style={styles.navButton}>
              <Ionicons color={String(theme.colors.textPrimary)} name="arrow-back" size={18} />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.startContent, completedExercises.length === 0 ? styles.startContentCentered : null]}>
          <View
            style={[
              styles.startIcon,
              {
                backgroundColor: theme.colors.controlActiveFill,
                borderColor: theme.colors.controlActiveBorder,
              },
            ]}
          >
            <Ionicons color={String(theme.colors.textPrimary)} name="barbell-outline" size={22} />
          </View>
          <View style={styles.startCopy}>
            <ReedText variant="section">Start session</ReedText>
            <ReedText tone="muted">Create a live workout to build your timeline.</ReedText>
          </View>
          <Pressable
            onPress={handleStartSession}
            style={({ pressed }) => [
              styles.primaryAction,
              theme.shadows.controlActive,
              {
                backgroundColor: theme.colors.accentPrimary,
                opacity: pressed || isWorking ? 0.9 : 1,
              },
            ]}
          >
            <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="bodyStrong">
              {isWorking ? 'Starting…' : 'Start session'}
            </ReedText>
          </Pressable>
        </View>

        {completedExercises.length > 0 ? (
          <View style={styles.startHistory}>
            <View style={styles.startHistoryHeader}>
              <ReedText variant="bodyStrong">Last session</ReedText>
              <ReedText tone="muted" variant="caption">
                {completedExercises.length} {completedExercises.length === 1 ? 'exercise' : 'exercises'}
              </ReedText>
            </View>
            {completedExercises.map((item, index) => (
              <View
                key={`${item.exerciseName}-${index}`}
                style={[
                  styles.startHistoryRow,
                  {
                    borderBottomColor: theme.colors.controlBorder,
                  },
                ]}
              >
                <ReedText numberOfLines={1} style={styles.startHistoryTitle} variant="bodyStrong">
                  {item.exerciseName}
                </ReedText>
                <ReedText numberOfLines={1} tone="muted" variant="caption">
                  {item.lastLoggedSummary ?? `${item.setCount} ${item.setCount === 1 ? 'set' : 'sets'}`}
                </ReedText>
              </View>
            ))}
          </View>
        ) : null}

        {errorMessage ? (
          <ReedText style={styles.inlineError} tone="danger">
            {errorMessage}
          </ReedText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Animated.View
        style={{
          flex: 1,
          opacity: pageTransition,
          transform: [
            {
              translateY: pageTransition.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        }}
      >
        {page === 'timeline' ? (
          <TimelinePage
            activeRestAfterSetNumber={session.activeCard.rest ? session.activeCard.rest.nextSetNumber - 1 : null}
            activeRestExerciseId={session.activeCard.rest?.sessionExerciseId ?? null}
            activeRestSeconds={session.activeCard.rest?.remainingSeconds ?? null}
            elapsedLabel={elapsedLabel}
            errorMessage={errorMessage}
            isConfirmingFinishSession={isConfirmingFinishSession}
            isWorking={isWorking}
            onAddExercise={() => {
              setIsConfirmingFinishSession(false);
              setIsAddSheetOpen(true);
            }}
            onClearFinishSessionConfirm={() => setIsConfirmingFinishSession(false)}
            onDeleteSet={handleDeleteSet}
            onExitWorkout={onExitWorkout}
            onFinishSession={handleFinishSession}
            onOpenExercise={handleSelectExercise}
            onOpenSet={handleOpenSet}
            onRemoveExercise={handleRemoveExercise}
            onToggleFinishSessionConfirm={() => setIsConfirmingFinishSession(current => !current)}
            timeline={session.timeline}
          />
        ) : (
          <ExercisePage
            captureCard={captureCard}
            editingSetNumber={activeSetEditor?.setNumber ?? null}
            errorMessage={errorMessage}
            isEditingSet={Boolean(activeSetEditor)}
            isPickerInteracting={isPickerInteracting}
            isWorking={isWorking}
            metricValues={metricValues}
            onAdjustRest={handleAdjustRest}
            onBackToTimeline={() => {
              setEditingSet(null);
              setPage('timeline');
            }}
            onCaptureSwipeRight={handleCaptureSwipeRight}
            onPickerInteractionEnd={() => setIsPickerInteracting(false)}
            onPickerInteractionStart={() => setIsPickerInteracting(true)}
            onPresetRest={handlePresetRest}
            onRestSwipeLeft={handleRestSwipeLeft}
            onRestSwipeRight={handleRestSwipeRight}
            onToggleRestRunning={handleToggleRestRunning}
            onUpdateMetric={(key, nextValue) =>
              setMetricValues(current => ({
                ...current,
                [key]: nextValue,
              }))
            }
            onWarmupToggle={() => setWarmup(current => !current)}
            restCard={restCard}
            restRemaining={restRemaining}
            restRunning={restRunning}
            warmup={warmup}
          />
        )}
      </Animated.View>

      <AddExerciseSheet
        data={addSheet}
        isOpen={isAddSheetOpen}
        isWorking={isWorking}
        onAddBulk={handleAddExercisesBulk}
        onAddSingle={handleAddExercise}
        onClose={closeAddSheet}
        onSearchChange={setSearchText}
        onSelectEquipment={setSelectedEquipment}
        onSelectMuscleGroup={setSelectedMuscleGroup}
        onToggleFavorite={handleToggleFavorite}
        searchText={searchText}
        selectedEquipment={selectedEquipment}
        selectedMuscleGroup={selectedMuscleGroup}
      />
    </View>
  );
}

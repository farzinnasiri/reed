import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import {
  cancelRestTimerBackgroundAlertsAsync,
} from '@/lib/rest-timer-alerts';
import { AddExerciseSheet } from './workout-add-exercise-sheet';
import { ExercisePage } from './workout-exercise-page';
import { styles } from './workout-surface.styles';
import type {
  CaptureCard,
  EditingSet,
  LiveCardioCard,
  LiveCardioFinishSummary,
  MetricValues,
  RestCard,
  TimelineRow,
  TimelineSet,
  WorkoutPage,
} from './workout-surface.types';
import { TimelinePage } from './workout-timeline-page';
import { useRestBackgroundAlerts } from './use-rest-background-alerts';
import { useRunningTicker } from './use-running-ticker';
import { formatElapsed, getErrorMessage } from './workout-surface.utils';

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
  const startLiveCardio = useMutation(api.liveSessions.startLiveCardio);
  const pauseLiveCardio = useMutation(api.liveSessions.pauseLiveCardio);
  const resumeLiveCardio = useMutation(api.liveSessions.resumeLiveCardio);
  const adjustLiveCardioMetric = useMutation(api.liveSessions.adjustLiveCardioMetric);
  const finishLiveCardio = useMutation(api.liveSessions.finishLiveCardio);
  const toggleFavorite = useMutation(api.exerciseCatalog.toggleFavorite);

  const [isWorking, setIsWorking] = useState(false);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [warmup, setWarmup] = useState(false);
  const [metricValues, setMetricValues] = useState<MetricValues>({});
  const [restRemaining, setRestRemaining] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [isPickerInteracting, setIsPickerInteracting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState<WorkoutPage>('timeline');
  const [elapsedNow, setElapsedNow] = useState(() => Date.now());
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);
  const [editingSet, setEditingSet] = useState<EditingSet | null>(null);
  const [isConfirmingFinishSession, setIsConfirmingFinishSession] = useState(false);
  const [liveCardioFinishSummary, setLiveCardioFinishSummary] = useState<LiveCardioFinishSummary | null>(null);
  const pageTransition = useRef(new Animated.Value(1)).current;
  const lastAnimatedPageRef = useRef<WorkoutPage>('timeline');

  const captureCard = (session?.activeCard.capture ?? null) as CaptureCard | null;
  const restCard = (session?.activeCard.rest ?? null) as RestCard | null;
  const liveCardioCard = (session?.activeCard.liveCardio ?? null) as LiveCardioCard | null;
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
    if (page === 'exercise' && !captureCard && !restCard && !liveCardioCard && !hasTimelineRows) {
      setPage('timeline');
    }
  }, [captureCard, liveCardioCard, page, restCard, session]);

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
    if (!liveCardioCard) {
      setLiveElapsedSeconds(0);
      return;
    }

    setLiveCardioFinishSummary(null);
    setLiveElapsedSeconds(liveCardioCard.elapsedSeconds);
  }, [liveCardioCard?.elapsedSeconds, liveCardioCard?.isRunning, liveCardioCard?.sessionExerciseId]);

  useRunningTicker({
    isRunning: Boolean(liveCardioCard?.isRunning),
    onTick: () => {
      setLiveElapsedSeconds(current => current + 1);
    },
  });

  useEffect(() => {
    if (restRemaining === 0) {
      setRestRunning(false);
    }
  }, [restRemaining]);

  useRestBackgroundAlerts({
    cardMode:
      session?.cardMode === 'rest'
        ? 'rest'
        : session?.cardMode === 'live_cardio'
          ? 'live_cardio'
          : 'capture',
    onPermissionDenied: () => {
      setErrorMessage('Enable notifications to get rest alerts when the app is in the background.');
    },
    restCard,
    restRemaining,
  });

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

  useEffect(() => {
    if (page === 'timeline') {
      setLiveCardioFinishSummary(null);
    }
  }, [page]);

  const elapsedLabel = useMemo(() => {
    if (!session?.session.startedAt) {
      return null;
    }

    return formatElapsed(session.session.startedAt, elapsedNow);
  }, [elapsedNow, session?.session.startedAt]);

  const closeAddSheet = () => {
    setIsAddSheetOpen(false);
  };

  async function runMutation<T>(action: () => Promise<T>) {
    setIsWorking(true);
    setErrorMessage(null);

    try {
      return await action();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      return null;
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
      setLiveCardioFinishSummary(null);
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
      setLiveCardioFinishSummary(null);
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

  async function handleStartLiveCardio(sessionExerciseId: Id<'liveSessionExercises'>) {
    await runMutation(async () => {
      await startLiveCardio({ sessionExerciseId });
      setEditingSet(null);
      setLiveCardioFinishSummary(null);
    });
  }

  async function handleToggleLiveCardioRunning() {
    if (!liveCardioCard) {
      return;
    }

    await runMutation(async () => {
      if (liveCardioCard.isRunning) {
        await pauseLiveCardio({});
      } else {
        await resumeLiveCardio({});
      }
    });
  }

  async function handleAdjustLiveCardioMetric(key: string, delta: number) {
    await runMutation(async () => {
      await adjustLiveCardioMetric({ delta, key });
    });
  }

  async function handleFinishLiveCardio() {
    if (!liveCardioCard) {
      return;
    }

    const nextExerciseId = getNextTimelineExerciseId(session?.timeline ?? [], liveCardioCard.sessionExerciseId);
    const result = await runMutation(async () => finishLiveCardio({}));
    if (!result) {
      return;
    }

    setEditingSet(null);
    setLiveCardioFinishSummary({
      elapsedSeconds: liveElapsedSeconds,
      exerciseName: liveCardioCard.exerciseName,
      nextExerciseId,
      summary: result.summary,
    });
  }

  async function handleOpenNextExerciseAfterLiveCardio() {
    const nextExerciseId = liveCardioFinishSummary?.nextExerciseId;
    if (!nextExerciseId) {
      return;
    }

    await runMutation(async () => {
      await selectExercise({ sessionExerciseId: nextExerciseId });
      setEditingSet(null);
      setLiveCardioFinishSummary(null);
      setPage('exercise');
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
      await cancelRestTimerBackgroundAlertsAsync();
      await finishSession({});
      setIsConfirmingFinishSession(false);
      setEditingSet(null);
      setPage('timeline');
    });
  }

  async function handleRestSwipeRight() {
    await runMutation(async () => {
      await cancelRestTimerBackgroundAlertsAsync();
      await endRest({});
      // Stay on the exercise page; next-set capture card appears via getCurrent.
    });
  }

  async function handleRestSwipeLeft() {
    await runMutation(async () => {
      await cancelRestTimerBackgroundAlertsAsync();
      await endRest({});
      // Return to the timeline so the user can pick a different exercise.
      setPage('timeline');
    });
  }

  async function handleToggleRestRunning() {
    if (!restCard) {
      return;
    }

    await runMutation(async () => {
      await updateRestProcess({ mode: 'toggleRunning' });
      return true;
    });
  }

  async function handleAdjustRest(deltaSeconds: number) {
    await runMutation(async () => {
      await updateRestProcess({ deltaSeconds, mode: 'adjustBy' });
      return true;
    });
  }

  async function handlePresetRest(durationSeconds: number) {
    await runMutation(async () => {
      await updateRestProcess({ durationSeconds, mode: 'setDuration' });
      return true;
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
            capture={{
              card: captureCard,
              editingSetNumber: activeSetEditor?.setNumber ?? null,
              errorMessage,
              isEditingSet: Boolean(activeSetEditor),
              isPickerInteracting,
              isWorking,
              metricValues,
              onCaptureSwipeRight: handleCaptureSwipeRight,
              onPickerInteractionEnd: () => setIsPickerInteracting(false),
              onPickerInteractionStart: () => setIsPickerInteracting(true),
              onUpdateMetric: (key, nextValue) =>
                setMetricValues(current => ({
                  ...current,
                  [key]: nextValue,
                })),
              onWarmupToggle: () => setWarmup(current => !current),
              warmup,
            }}
            liveCardio={{
              card: liveCardioCard,
              elapsedSeconds: liveElapsedSeconds,
              errorMessage,
              finishSummary: liveCardioFinishSummary,
              isWorking,
              onAdjustMetric: handleAdjustLiveCardioMetric,
              onFinish: handleFinishLiveCardio,
              onOpenNextExercise: handleOpenNextExerciseAfterLiveCardio,
              onStart: handleStartLiveCardio,
              onToggleRunning: handleToggleLiveCardioRunning,
            }}
            navigation={{
              onBackToTimeline: () => {
                setEditingSet(null);
                setLiveCardioFinishSummary(null);
                setPage('timeline');
              },
            }}
            rest={{
              card: restCard,
              errorMessage,
              isRunning: restRunning,
              isWorking,
              onAdjust: handleAdjustRest,
              onPreset: handlePresetRest,
              onSwipeLeft: handleRestSwipeLeft,
              onSwipeRight: handleRestSwipeRight,
              onToggleRunning: handleToggleRestRunning,
              remaining: restRemaining,
            }}
          />
        )}
      </Animated.View>

      <AddExerciseSheet
        isOpen={isAddSheetOpen}
        isWorking={isWorking}
        onAddBulk={handleAddExercisesBulk}
        onAddSingle={handleAddExercise}
        onClose={closeAddSheet}
        onToggleFavorite={handleToggleFavorite}
      />
    </View>
  );
}

function getNextTimelineExerciseId(
  timeline: TimelineRow[],
  currentId: Id<'liveSessionExercises'>,
): Id<'liveSessionExercises'> | null {
  const currentIndex = timeline.findIndex(row => row.sessionExerciseId === currentId);

  if (currentIndex < 0) {
    return null;
  }

  const nextRow = timeline[currentIndex + 1];
  return nextRow?.sessionExerciseId ?? null;
}

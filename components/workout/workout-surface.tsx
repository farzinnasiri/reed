import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import {
  cancelRestTimerBackgroundAlertsAsync,
  playRestTimerCompletionCueAsync,
} from '@/lib/rest-timer-alerts';
import { AddExerciseSheet } from './workout-add-exercise-sheet';
import { ExercisePage } from './workout-exercise-page';
import { WorkoutSessionInsightsSheet } from './workout-session-insights-sheet';
import { WorkoutSessionStatusStrip } from './workout-session-status-strip';
import { styles } from './workout-surface.styles';
import type {
  CaptureCard,
  EditingSet,
  LiveCardioCard,
  LiveCardioFinishSummary,
  LiveSessionFullInsights,
  LiveSessionStatusStrip,
  LiveSessionSummary,
  MetricValues,
  RestCard,
  TimelineRow,
  TimelineSet,
  WorkoutPage,
} from './workout-surface.types';
import { TimelinePage } from './workout-timeline-page';
import { useRestBackgroundAlerts } from './use-rest-background-alerts';
import { useRunningTicker } from './use-running-ticker';
import { formatElapsedCompact, getErrorMessage } from './workout-surface.utils';

type WorkoutSurfaceProps = {
  onExitWorkout: () => void;
  showStartBackButton?: boolean;
};

export function WorkoutSurface({ onExitWorkout, showStartBackButton = true }: WorkoutSurfaceProps) {
  const { theme } = useReedTheme();
  const session = useQuery(api.liveSessions.getCurrent, {});
  const sessionInsights = useQuery(api.liveSessionInsights.getCurrent, {});
  const latestEndedSummary = useQuery(api.liveSessions.getLatestEndedSummary, {});
  const [sessionPageCursorStack, setSessionPageCursorStack] = useState<number[]>([]);
  const sessionPageBeforeStartedAt = sessionPageCursorStack.at(-1) ?? null;
  const [selectedEndedSessionId, setSelectedEndedSessionId] = useState<Id<'liveSessions'> | null>(null);
  const [isEndedInsightsOpen, setIsEndedInsightsOpen] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const endedSessionsPage = useQuery(api.liveSessions.listEndedSummaries, {
    beforeStartedAt: sessionPageBeforeStartedAt ?? undefined,
    limit: 5,
  });
  const endedSessionInsights = useQuery(
    api.liveSessionInsights.getForSession,
    selectedEndedSessionId ? { sessionId: selectedEndedSessionId } : 'skip',
  );
  const endedSessionTimeline = useQuery(
    api.liveSessions.getEndedTimeline,
    selectedEndedSessionId ? { sessionId: selectedEndedSessionId } : 'skip',
  );
  const startSession = useMutation(api.liveSessions.start);
  const addExercise = useMutation(api.liveSessions.addExercise);
  const reorderExercises = useMutation(api.liveSessions.reorderExercises);
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
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [liveCardioFinishSummary, setLiveCardioFinishSummary] = useState<LiveCardioFinishSummary | null>(null);
  const [statusStripHeight, setStatusStripHeight] = useState(60);
  const previousRestRemainingRef = useRef<number | null>(null);
  const currentRestRemainingRef = useRef(restRemaining);
  const captureCard = (session?.activeCard.capture ?? null) as CaptureCard | null;
  const restCard = (session?.activeCard.rest ?? null) as RestCard | null;
  const restRuntime =
    ((session as { restRuntime?: RestCard | null } | null | undefined)?.restRuntime ?? null) as RestCard | null;
  const liveCardioCard = (session?.activeCard.liveCardio ?? null) as LiveCardioCard | null;
  currentRestRemainingRef.current = restRemaining;
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
    if (!restRuntime) {
      setRestRemaining(0);
      setRestRunning(false);
      return;
    }

    setIsPickerInteracting(false);
    setEditingSet(null);
    const currentRemaining = currentRestRemainingRef.current;
    const isServerEchoWithinTick =
      restRuntime.isRunning && Math.abs(restRuntime.remainingSeconds - currentRemaining) <= 1;
    if (!isServerEchoWithinTick) {
      setRestRemaining(restRuntime.remainingSeconds);
    }
    setRestRunning(restRuntime.isRunning);
    setErrorMessage(null);
  }, [restRuntime?.isRunning, restRuntime?.nextSetNumber, restRuntime?.remainingSeconds, restRuntime?.sessionExerciseId]);

  useEffect(() => {
    if (!session) {
      setPage('timeline');
      setEditingSet(null);
      setIsInsightsOpen(false);
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
    if (!restRunning || restRemaining <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setRestRemaining(current => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [restRemaining, restRunning]);

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

  useEffect(() => {
    if (!restRuntime) {
      previousRestRemainingRef.current = null;
      return;
    }

    const previousRemaining = previousRestRemainingRef.current;
    previousRestRemainingRef.current = restRemaining;

    if (
      previousRemaining !== null &&
      previousRemaining > 0 &&
      restRemaining === 0 &&
      AppState.currentState === 'active'
    ) {
      void playRestTimerCompletionCueAsync({
        exerciseName: restRuntime.exerciseName,
        nextSetNumber: restRuntime.nextSetNumber,
      });
    }
  }, [restRemaining, restRuntime]);

  useRestBackgroundAlerts({
    cardMode:
      restRuntime
        ? 'rest'
        : session?.cardMode === 'live_cardio'
          ? 'live_cardio'
          : 'capture',
    onPermissionDenied: () => {
      setErrorMessage('Enable notifications to get rest alerts when the app is in the background.');
    },
    restCard: restRuntime,
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
    if (page === 'timeline') {
      setLiveCardioFinishSummary(null);
    }
  }, [page]);

  const elapsedLabel = useMemo(() => {
    if (!session?.session.startedAt) {
      return null;
    }

    return formatElapsedCompact(session.session.startedAt, elapsedNow);
  }, [elapsedNow, session?.session.startedAt]);

  const fallbackStatus = useMemo<LiveSessionStatusStrip>(() => {
    const completedSets = session?.timeline.reduce((total, row) => total + row.setCount, 0) ?? 0;
    return {
      completedSetsLabel: `${completedSets} ${completedSets === 1 ? 'set' : 'sets'}`,
      durationLabel: elapsedLabel ?? '0m',
      microLineTokens: [],
      workSlotKind: 'active',
      workSlotLabel: 'Active',
    };
  }, [elapsedLabel, session?.timeline]);

  const insightsStatus = sessionInsights?.statusStrip
    ? {
        ...sessionInsights.statusStrip,
        durationLabel: elapsedLabel ?? sessionInsights.statusStrip.durationLabel,
      }
    : fallbackStatus;

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

  async function handleReorderTimeline(orderedSessionExerciseIds: Id<'liveSessionExercises'>[]) {
    const result = await runMutation(async () => {
      await reorderExercises({ orderedSessionExerciseIds });
      return true;
    });

    return Boolean(result);
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

  async function handleDeleteSet(setLogId: Id<'activityLogs'>) {
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
      // Keep exercise context; after ending rest the capture card returns
      // to the same exercise so users can continue from the last set flow.
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
    setErrorMessage(null);
    setRestRemaining(current => clampRestSeconds(current + deltaSeconds));

    try {
      await updateRestProcess({ deltaSeconds, mode: 'adjustBy' });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handlePresetRest(durationSeconds: number) {
    await runMutation(async () => {
      await updateRestProcess({ durationSeconds, mode: 'setDuration' });
      return true;
    });
  }

  function renderSessionChrome({
    children,
    onBack,
    onOpenInsights,
    overlays,
    status,
  }: {
    children: ReactNode;
    onBack: () => void;
    onOpenInsights: () => void;
    overlays?: ReactNode;
    status: LiveSessionStatusStrip;
  }) {
    return (
      <View style={styles.root}>
        <View style={styles.activeWorkoutShell}>
          <View style={styles.activeWorkoutPage}>{children}</View>
          <View
            onLayout={(e) => setStatusStripHeight(e.nativeEvent.layout.height + 8)}
            style={styles.statusStripFloating}
          >
            <WorkoutSessionStatusStrip
              onBack={onBack}
              onOpenInsights={onOpenInsights}
              status={status}
            />
          </View>
        </View>
        {overlays}
      </View>
    );
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

    if (selectedEndedSessionId) {
      const endedStatus = endedSessionTimeline
        ? buildEndedStatusStrip(endedSessionTimeline.startedAt, endedSessionTimeline.endedAt, endedSessionTimeline.timeline)
        : {
            completedSetsLabel: '0 sets',
            durationLabel: '0m',
            microLineTokens: [],
            workSlotKind: 'active' as const,
            workSlotLabel: 'Completed',
          };

      return renderSessionChrome({
        children: endedSessionTimeline === undefined ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator color={String(theme.colors.accentPrimary)} />
            <ReedText tone="muted" variant="caption">Loading session.</ReedText>
          </View>
        ) : endedSessionTimeline === null ? (
          <View style={styles.trainingShelf}>
            <ReedText variant="bodyStrong">Session unavailable.</ReedText>
          </View>
        ) : (
          <TimelinePage
            activeRestAfterSetNumber={null}
            activeRestExerciseId={null}
            activeRestSeconds={null}
            contentTopInset={statusStripHeight}
            elapsedLabel={formatEndedDuration(endedSessionTimeline.startedAt, endedSessionTimeline.endedAt)}
            errorMessage={null}
            isConfirmingFinishSession={false}
            isReadOnly
            isWorking={false}
            onAddExercise={() => {}}
            onClearFinishSessionConfirm={() => {}}
            onDeleteSet={() => {}}
            onFinishSession={() => {}}
            onOpenExercise={() => {}}
            onOpenSet={() => {}}
            onReorderTimeline={async () => false}
            onRemoveExercise={() => {}}
            onToggleFinishSessionConfirm={() => {}}
            showHeader={false}
            timeline={endedSessionTimeline.timeline}
          />
        ),
        onBack: () => {
          setIsEndedInsightsOpen(false);
          setSelectedEndedSessionId(null);
        },
        onOpenInsights: () => setIsEndedInsightsOpen(true),
        overlays: endedSessionInsights ? (
          <WorkoutSessionInsightsSheet
            fullInsights={endedSessionInsights.fullInsights as LiveSessionFullInsights}
            isOpen={isEndedInsightsOpen}
            onClose={() => setIsEndedInsightsOpen(false)}
            summary={endedSessionInsights.summary as LiveSessionSummary}
          />
        ) : null,
        status: endedStatus,
      });
    }

    return (
      <ScrollView contentContainerStyle={styles.startStateScroll} showsVerticalScrollIndicator={false} style={styles.startState}>
        {showStartBackButton ? (
          <View style={styles.startTopRow}>
            <Pressable accessibilityLabel="Exit workout" onPress={onExitWorkout} style={({ pressed }) => [styles.navButton, getTapScaleStyle(pressed)]}>
              <Ionicons color={String(theme.colors.textPrimary)} name="arrow-back" size={18} />
            </Pressable>
          </View>
        ) : null}

        <GlassSurface contentStyle={styles.startHeroContent} style={styles.startHeroSurface}>
          <View style={styles.startHeroTopRow}>
            <View style={styles.startCopy}>
              <ReedText variant="section">Start session</ReedText>
              <ReedText tone="muted">Start empty. Add exercises as you train.</ReedText>
            </View>
            <Pressable
              accessibilityLabel="Start a live workout session"
              onPress={handleStartSession}
              style={({ pressed }) => [
                styles.startHeroButton,
                {
                  backgroundColor: theme.colors.accentPrimary,
                  ...getTapScaleStyle(pressed, isWorking),
                },
              ]}
            >
              <Ionicons color={String(theme.colors.accentPrimaryText)} name="arrow-forward" size={18} />
            </Pressable>
          </View>
        </GlassSurface>

        <View style={styles.startHistory}>
          <View style={styles.startHistoryHeader}>
            <ReedText variant="bodyStrong">Sessions</ReedText>
            <View style={styles.sessionHeaderActions}>
              <Pressable
                accessibilityLabel={isHistoryExpanded ? 'Collapse sessions' : 'Expand sessions'}
                onPress={() => setIsHistoryExpanded(current => !current)}
                style={({ pressed }) => [styles.sessionPagerButton, getTapScaleStyle(pressed)]}
              >
                <Ionicons color={String(theme.colors.textMuted)} name={isHistoryExpanded ? 'chevron-up' : 'chevron-down'} size={18} />
              </Pressable>
            </View>
          </View>
          {!isHistoryExpanded ? null : endedSessionsPage === undefined ? (
            <View style={styles.loadingInline}>
              <ActivityIndicator color={String(theme.colors.accentPrimary)} />
              <ReedText tone="muted" variant="caption">Loading sessions.</ReedText>
            </View>
          ) : endedSessionsPage.summaries.length > 0 ? (
            <>
            <View style={styles.lastSessionList}>
              {endedSessionsPage.summaries.map((item, index) => (
                <Pressable
                  accessibilityLabel={`Open session from ${formatSessionDate(item.startedAt)}`}
                  key={item.sessionId}
                  onPress={() => {
                    setIsEndedInsightsOpen(false);
                    setSelectedEndedSessionId(item.sessionId);
                  }}
                  style={({ pressed }) => [
                    styles.sessionSummaryRow,
                    index < endedSessionsPage.summaries.length - 1
                      ? { borderBottomColor: theme.colors.controlBorder }
                      : { borderBottomWidth: 0 },
                    getTapScaleStyle(pressed),
                  ]}
                >
                  <View style={styles.sessionSummaryCopy}>
                    <View style={styles.sessionDateRow}>
                      <ReedText numberOfLines={1} variant="bodyStrong">{formatSessionDate(item.startedAt)}</ReedText>
                      <ReedText numberOfLines={1} tone="muted" variant="caption">{formatSessionDuration(item.startedAt, item.endedAt)}</ReedText>
                    </View>
                    <ReedText numberOfLines={1} tone="muted" variant="caption">
                      {item.exercises.slice(0, 3).map(exercise => exercise.exerciseName).join(' · ')}{item.exerciseCount > 3 ? ` +${item.exerciseCount - 3}` : ''}
                    </ReedText>
                  </View>
                </Pressable>
              ))}
            </View>
            {(sessionPageCursorStack.length > 0 || endedSessionsPage.nextBeforeStartedAt) ? (
              <View style={styles.sessionPaginationRow}>
                <Pressable
                  accessibilityLabel="Show newer sessions"
                  disabled={sessionPageCursorStack.length === 0}
                  onPress={() => setSessionPageCursorStack(current => current.slice(0, -1))}
                  style={({ pressed }) => [styles.sessionPageControl, { opacity: sessionPageCursorStack.length === 0 ? 0.35 : 1 }, getTapScaleStyle(pressed, sessionPageCursorStack.length === 0)]}
                >
                  <Ionicons color={String(theme.colors.textMuted)} name="chevron-back" size={15} />
                  <ReedText tone="muted" variant="caption">Newer</ReedText>
                </Pressable>
                <Pressable
                  accessibilityLabel="Show earlier sessions"
                  disabled={!endedSessionsPage.nextBeforeStartedAt}
                  onPress={() => {
                    if (endedSessionsPage.nextBeforeStartedAt) {
                      setSessionPageCursorStack(current => [...current, endedSessionsPage.nextBeforeStartedAt!]);
                    }
                  }}
                  style={({ pressed }) => [styles.sessionPageControl, { opacity: endedSessionsPage.nextBeforeStartedAt ? 1 : 0.35 }, getTapScaleStyle(pressed, !endedSessionsPage.nextBeforeStartedAt)]}
                >
                  <ReedText tone="muted" variant="caption">Earlier</ReedText>
                  <Ionicons color={String(theme.colors.textMuted)} name="chevron-forward" size={15} />
                </Pressable>
              </View>
            ) : null}
            </>
          ) : completedExercises.length > 0 ? (
            <ReedText tone="muted" variant="caption">Earlier sessions will appear here.</ReedText>
          ) : (
            <View style={styles.trainingShelf}>
              <ReedText variant="bodyStrong">Reed is ready when you are.</ReedText>
              <ReedText tone="muted" variant="caption">Log a few sessions and this page will surface patterns, records, and useful repeats.</ReedText>
            </View>
          )}
        </View>

        {errorMessage ? (
          <ReedText style={styles.inlineError} tone="danger">
            {errorMessage}
          </ReedText>
        ) : null}
      </ScrollView>
    );
  }

  const renderWorkoutPage = (targetPage: WorkoutPage) =>
    targetPage === 'timeline' ? (
      <TimelinePage
        activeRestAfterSetNumber={restRuntime ? restRuntime.nextSetNumber - 1 : null}
        activeRestExerciseId={restRuntime?.sessionExerciseId ?? null}
        activeRestSeconds={restRuntime ? restRemaining : null}
        contentTopInset={statusStripHeight}
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
        onFinishSession={handleFinishSession}
        onOpenExercise={handleSelectExercise}
        onOpenSet={handleOpenSet}
        onReorderTimeline={handleReorderTimeline}
        onRemoveExercise={handleRemoveExercise}
        onToggleFinishSessionConfirm={() => setIsConfirmingFinishSession(current => !current)}
        timeline={session.timeline}
      />
    ) : (
      <ExercisePage
        contentTopInset={statusStripHeight}
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
    );

  function handleStatusStripBack() {
    // Two-level workout stack: timeline back exits the workout, while nested
    // exercise/rest/live-cardio surfaces return to the timeline first.
    if (page === 'timeline') {
      onExitWorkout();
      return;
    }

    setEditingSet(null);
    setLiveCardioFinishSummary(null);
    setPage('timeline');
  }

  return renderSessionChrome({
    children: renderWorkoutPage(page),
    onBack: handleStatusStripBack,
    onOpenInsights: () => setIsInsightsOpen(true),
    overlays: (
      <>
        <AddExerciseSheet
          isOpen={isAddSheetOpen}
          isWorking={isWorking}
          onAddBulk={handleAddExercisesBulk}
          onAddSingle={handleAddExercise}
          onClose={closeAddSheet}
          onToggleFavorite={handleToggleFavorite}
        />

        {sessionInsights ? (
          <WorkoutSessionInsightsSheet
            fullInsights={sessionInsights.fullInsights as LiveSessionFullInsights}
            isOpen={isInsightsOpen}
            onClose={() => setIsInsightsOpen(false)}
            summary={sessionInsights.summary as LiveSessionSummary}
          />
        ) : null}
      </>
    ),
    status: insightsStatus,
  });
}

function formatSessionDate(timestamp: number) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  }).format(new Date(timestamp));
}

function formatSessionDuration(startedAt: number, endedAt: number) {
  const minutes = Math.max(1, Math.round((endedAt - startedAt) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatEndedDuration(startedAt: number, endedAt: number) {
  const minutes = Math.max(0, Math.round((endedAt - startedAt) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function buildEndedStatusStrip(startedAt: number, endedAt: number, timeline: TimelineRow[]): LiveSessionStatusStrip {
  const completedSets = timeline.reduce((total, row) => total + row.setCount, 0);
  return {
    completedSetsLabel: `${completedSets} ${completedSets === 1 ? 'set' : 'sets'}`,
    durationLabel: formatEndedDuration(startedAt, endedAt),
    microLineTokens: [],
    workSlotKind: 'active',
    workSlotLabel: 'Completed',
  };
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

function clampRestSeconds(value: number) {
  return Math.max(15, Math.min(240, Math.round(value)));
}

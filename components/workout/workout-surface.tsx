import type { WorkoutTiming } from './workout-duration';
import { SessionHeaderMascot } from '@/components/reed/session/session-header-mascot';
import { SessionMascotProvider } from '@/components/reed/session/session-mascot';
import { SessionWhisper } from '@/components/reed/session/session-whisper';
import { ReedSessionSheet, type SessionAskContext } from '@/components/reed/session/reed-session-sheet';
import { useMascot } from '@/components/reed/mascot';
import { StageRecedeProvider, useStageRecedeStyle } from '@/design/stage-recede';
import * as haptics from '@/design/haptics';
import Animated from 'react-native-reanimated';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ReedSwapFeedback, type ReedSwapSnapshot } from '@/components/reed/session/reed-swap-feedback';
import { analytics } from '@/lib/analytics';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import type { WorkoutEntryIntent } from '@/components/home/app-routes';
import { useReedTheme } from '@/design/provider';
import { AddExerciseSheet } from './workout-add-exercise-sheet';
import { ExercisePage } from './workout-exercise-page';
import { WorkoutSessionInsightsSheet } from './workout-session-insights-sheet';
import { WorkoutSessionNotesSheet } from './workout-session-notes-sheet';
import { WorkoutSessionStatusStrip } from './workout-session-status-strip';
import { styles } from './workout-surface.styles';
import type {
  LiveCardioFinishSummary,
  LiveSessionStatusStrip,
  TimelineRow,
  TimelineSet,
  WorkoutPage,
} from './workout-surface.types';
import { TimelinePage } from './workout-timeline-page';
import { useWorkoutNavigation } from './use-workout-navigation';
import { WorkoutHistoryScreen } from './workout-history-screen';
import { useUserOperation } from '@/lib/use-user-operation';
import { useWorkoutSetEditor } from './use-workout-set-editor';
import { useWorkoutSessionRuntime } from './workout-session-runtime';
import { usePrefetchedSessionInsights } from './use-prefetched-session-insights';
import { getErrorMessage } from './workout-surface.utils';

type WorkoutSurfaceProps = {
  entryIntent: WorkoutEntryIntent | null;
  onBack: () => void;
  onEntryIntentHandled: () => void;
};

function WorkoutSurfaceContent({ entryIntent, onBack, onEntryIntentHandled }: WorkoutSurfaceProps) {
  const { theme } = useReedTheme();
  const stageStyle = useStageRecedeStyle();
  const sessionMascot = useMascot('watching');
  const [isReedOpen, setIsReedOpen] = useState(false);
  const [askContext, setAskContext] = useState<SessionAskContext | null>(null);
  const [committedSet, setCommittedSet] = useState<{
    id: Id<'activityLogs'>;
    exercise: Id<'liveSessionExercises'>;
    at: number;
  } | null>(null);
  const beforeSwap = useRef<ReedSwapSnapshot | null>(null);
  const [confirmedSwap, setConfirmedSwap] = useState<ReedSwapSnapshot | null>(null);
  const finishSwap = useCallback(() => {
    setConfirmedSwap(null);
  }, []);
  const insets = useSafeAreaInsets();
  const { session, restPermissionDenied } = useWorkoutSessionRuntime();
  const whisper = useQuery(
    api.reed.getSessionWhisper,
    committedSet && session
      ? { sessionId: session.session.sessionId, exerciseId: committedSet.exercise, now: committedSet.at }
      : 'skip',
  );
  const reactedSet = useRef<string | null>(null);
  useEffect(() => {
    if (!whisper || whisper.eventId === reactedSet.current) return;
    reactedSet.current = whisper.eventId;
    sessionMascot.react(whisper.kind === 'pr' ? 'surprised' : whisper.kind === 'caution' ? 'concerned' : 'happy');
    sessionMascot.act(whisper.kind === 'pr' ? 'hop' : 'tick');
    if (whisper.kind === 'pr') haptics.success();
  }, [sessionMascot, whisper]);
  const { view, openHistory, openDraft, openActive, openSession, showPage, applyIntent } = useWorkoutNavigation();
  const page = view.kind === 'active' ? view.page : 'timeline';
  const addExercise = useMutation(api.liveSessions.addExercise);
  const addExercises = useMutation(api.liveSessions.addExercises);
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
  const updateSessionNotes = useMutation(api.liveSessions.updateSessionNotes);
  const toggleFavorite = useMutation(api.exerciseCatalog.toggleFavorite);

  const captureOperation = useUserOperation('workout.capture', 'Could not save this change. Please try again.');
  const timelineOperation = useUserOperation('workout.timeline', 'Could not update the session. Please try again.');
  const isWorking = captureOperation.isWorking;
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isPickerInteracting, setIsPickerInteracting] = useState(false);
  const isTimelineMutationPending = timelineOperation.isWorking;
  const [localError, setErrorMessage] = useState<string | null>(null);
  const errorMessage = localError ?? captureOperation.errorMessage ?? timelineOperation.errorMessage;
  const [isConfirmingFinishSession, setIsConfirmingFinishSession] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isSessionNotesOpen, setIsSessionNotesOpen] = useState(false);
  const [isSavingSessionNotes, setIsSavingSessionNotes] = useState(false);
  const [liveCardioFinishSummary, setLiveCardioFinishSummary] = useState<LiveCardioFinishSummary | null>(null);
  const [statusStripHeight, setStatusStripHeight] = useState(60);
  const {
    data: sessionInsights,
    error: sessionInsightsError,
    isLoading: isSessionInsightsLoading,
    refresh: refreshSessionInsights,
  } = usePrefetchedSessionInsights(session?.session.sessionId ?? null, session?.session.manualDurationSeconds);
  const captureCard = session?.activeCard.capture ?? null;
  const restCard = session?.activeCard.rest ?? null;
  const restRuntime = session?.restRuntime ?? null;
  const restExerciseId = session?.restRuntime?.sessionExerciseId;
  const restNextSetNumber = session?.restRuntime?.nextSetNumber;
  const liveCardioCard = session?.activeCard.liveCardio ?? null;
  const {
    activeSetEditor,
    editingSet,
    metricValues,
    setMetricValues,
    setOutcomeDetails,
    setSetOutcomeDetails,
    warmup,
    setWarmup,
    setEditingSet,
  } = useWorkoutSetEditor(captureCard);
  const captureKey = `${captureCard?.sessionExerciseId}|${captureCard?.currentSetNumber}|${captureCard?.exerciseCatalogId}|${editingSet?.setLogId}`;
  const restKey = `${restExerciseId}|${restNextSetNumber}`;
  const [previousCaptureKey, setPreviousCaptureKey] = useState(captureKey);
  const [previousRestKey, setPreviousRestKey] = useState(restKey);
  if (previousCaptureKey !== captureKey) {
    setPreviousCaptureKey(captureKey); setIsPickerInteracting(false); setErrorMessage(null);
  }
  if (previousRestKey !== restKey) {
    setPreviousRestKey(restKey);
    if (restExerciseId) { setIsPickerInteracting(false); setEditingSet(null); setErrorMessage(null); }
  }
  if (session === null && view.kind === 'active') {
    openHistory(); setEditingSet(null); setIsInsightsOpen(false);
  }
  const [handledIntent, setHandledIntent] = useState<WorkoutEntryIntent | null>(null);
  if (entryIntent !== handledIntent && session !== undefined) {
    setHandledIntent(entryIntent ?? null);
    if (entryIntent) {
      applyIntent(entryIntent, Boolean(session));
      setIsAddSheetOpen(false); setIsConfirmingFinishSession(false);
      setIsSessionNotesOpen(false); setErrorMessage(null);
    }
  }
  useEffect(() => {
    if (entryIntent && handledIntent === entryIntent) onEntryIntentHandled();
  }, [entryIntent, handledIntent, onEntryIntentHandled]);
  if (session && editingSet && !session.timeline.some(row =>
    row.sessionExerciseId === editingSet.sessionExerciseId && row.sets.some(setEntry => setEntry.setLogId === editingSet.setLogId))) setEditingSet(null);
  if (liveCardioFinishSummary && (liveCardioCard || page === 'timeline')) setLiveCardioFinishSummary(null);

  const fallbackStatus = useMemo<LiveSessionStatusStrip>(() => {
    const completedSets =
      session?.timeline.reduce((total: number, row: { setCount: number }) => total + row.setCount, 0) ?? 0;
    return {
      completedSetsLabel: `${completedSets} ${completedSets === 1 ? 'set' : 'sets'}`,
      durationLabel: session?.statusStrip?.durationLabel ?? '0m',
      microLineTokens: [],
      workSlotKind: 'active',
      workSlotLabel: 'Active',
    };
  }, [session?.statusStrip?.durationLabel, session?.timeline]);

  const insightsStatus = session?.statusStrip ? session.statusStrip : fallbackStatus;

  const closeAddSheet = () => {
    setIsAddSheetOpen(false);
  };

  async function runMutation<T>(action: () => Promise<T>) {
    setErrorMessage(null);
    timelineOperation.clearError();
    return captureOperation.run(action);
  }

  async function handleSaveSessionNotes(sessionId: Id<'liveSessions'>, notes: string) {
    setIsSavingSessionNotes(true);
    setErrorMessage(null);

    try {
      await updateSessionNotes({ notes, sessionId });
      setIsSessionNotesOpen(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingSessionNotes(false);
    }
  }

  async function runTimelineMutation<T>(action: () => Promise<T>) {
    setErrorMessage(null);
    captureOperation.clearError();
    return timelineOperation.run(action);
  }

  async function handleStartSession() {
    setErrorMessage(null);
    openDraft();
  }

  async function handleSelectExercise(sessionExerciseId: Id<'liveSessionExercises'>) {
    await runTimelineMutation(async () => {
      await selectExercise({ sessionExerciseId });
      setIsConfirmingFinishSession(false);
      setEditingSet(null);
      setLiveCardioFinishSummary(null);
      showPage('exercise');
    });
  }

  async function handleOpenSet(sessionExerciseId: Id<'liveSessionExercises'>, setEntry: TimelineSet) {
    await runTimelineMutation(async () => {
      await selectExercise({ sessionExerciseId });
      setIsConfirmingFinishSession(false);
      setEditingSet({
        metrics: setEntry.metrics,
        sessionExerciseId,
        setLogId: setEntry.setLogId,
        setNumber: setEntry.setNumber,
        setOutcomeDetails: setEntry.setOutcomeDetails,
        warmup: setEntry.warmup,
      });
      setLiveCardioFinishSummary(null);
      showPage('exercise');
    });
  }

  async function handleAddExercise(exerciseCatalogId: Id<'exerciseCatalog'>) {
    const shouldTrackSessionStarted = !session;
    setIsConfirmingFinishSession(false);
    closeAddSheet();
    await runTimelineMutation(async () => {
      await addExercise({ exerciseCatalogId });
      if (shouldTrackSessionStarted) {
        analytics.workoutSessionStarted();
      }
      analytics.exerciseAdded();
      openActive();
    });
  }

  async function handleAddExercisesBulk(exerciseCatalogIds: Id<'exerciseCatalog'>[]) {
    if (exerciseCatalogIds.length === 0) {
      return;
    }

    const shouldTrackSessionStarted = !session;
    setIsConfirmingFinishSession(false);
    closeAddSheet();
    await runTimelineMutation(async () => {
      await addExercises({ exerciseCatalogIds });
      if (shouldTrackSessionStarted) {
        analytics.workoutSessionStarted();
      }
      analytics.exerciseAdded({
        addMode: 'bulk',
        exerciseCount: exerciseCatalogIds.length,
      });
      openActive();
    });
  }

  async function handleRemoveExercise(sessionExerciseId: Id<'liveSessionExercises'>) {
    await runTimelineMutation(async () => {
      await removeExercise({ sessionExerciseId });
    });
  }

  async function handleReorderTimeline(orderedSessionExerciseIds: Id<'liveSessionExercises'>[]) {
    const result = await runTimelineMutation(async () => {
      await reorderExercises({ orderedSessionExerciseIds });
    });

    return result.status === 'success';
  }

  async function handleToggleFavorite(exerciseCatalogId: Id<'exerciseCatalog'>) {
    setErrorMessage(null);

    try {
      await toggleFavorite({ exerciseCatalogId });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
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
          setOutcomeDetails,
          warmup,
        });
        setEditingSet(null);
        return;
      }

      const committed = await logSet({
        metrics: metricValues,
        sessionExerciseId: captureCard.sessionExerciseId,
        setOutcomeDetails,
        warmup,
      });
      setCommittedSet({ id: committed.setLogId, exercise: captureCard.sessionExerciseId, at: committed.loggedAt });
      sessionMascot.act('tick');
      analytics.workoutSetLogged({
        setNumber: captureCard.currentSetNumber,
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

  async function handleFinishLiveCardio(elapsedSeconds: number) {
    if (!liveCardioCard) {
      return;
    }

    const nextExerciseId = getNextTimelineExerciseId(session?.timeline ?? [], liveCardioCard.sessionExerciseId);
    const result = await runMutation(async () => finishLiveCardio({}));
    if (result.status !== 'success') {
      return;
    }

    setEditingSet(null);
    setLiveCardioFinishSummary({
      elapsedSeconds,
      exerciseName: liveCardioCard.exerciseName,
      nextExerciseId,
      summary: result.value.summary,
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
      showPage('exercise');
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
    if (!session) {
      setIsConfirmingFinishSession(false);
      setEditingSet(null);
      setIsAddSheetOpen(false);
      openHistory();
      showPage('timeline');
      return;
    }

    await runMutation(async () => {
      const result = await finishSession({});
      const totalSets =
        session?.timeline.reduce((total: number, row: { setCount: number }) => total + row.setCount, 0) ?? 0;
      const exerciseCount = session?.timeline.length ?? 0;
      if (!result.deletedEmptySession) {
        analytics.workoutSessionFinished({
          exerciseCount,
          totalSets,
        });
      }
      setIsConfirmingFinishSession(false);
      setEditingSet(null);
      openHistory();
      showPage('timeline');
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
    });
  }

  async function handleAdjustRest(deltaSeconds: number) {
    setErrorMessage(null);
    try {
      await updateRestProcess({ deltaSeconds, mode: 'adjustBy' });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handlePresetRest(durationSeconds: number) {
    await runMutation(async () => {
      await updateRestProcess({ durationSeconds, mode: 'setDuration' });
    });
  }

  function openReed(fromWhisper: boolean) {
    if (!session) return;
    const exerciseId =
      fromWhisper && committedSet
        ? committedSet.exercise
        : (captureCard?.sessionExerciseId ?? restRuntime?.sessionExerciseId ?? liveCardioCard?.sessionExerciseId);
    const row = session.timeline.find((row) => row.sessionExerciseId === exerciseId);
    beforeSwap.current =
      row && exerciseId ? { exerciseId, title: row.exerciseName, metrics: { ...metricValues } } : null;
    const setNumber =
      fromWhisper && whisper
        ? whisper.setIndex + 1
        : (activeSetEditor?.setNumber ?? captureCard?.currentSetNumber ?? restRuntime?.nextSetNumber);
    setAskContext({
      message: {
        sessionId: session.session.sessionId,
        ...(exerciseId ? { exerciseId } : {}),
        ...(setNumber !== undefined ? { setIndex: setNumber - 1 } : {}),
      },
      label: row ? `${row.exerciseName}${setNumber ? ` · set ${setNumber}` : ''}` : 'Your session',
      ...(fromWhisper && whisper ? { whisper: whisper.text } : {}),
    });
    haptics.light();
    setIsReedOpen(true);
  }

  function renderSessionChrome({
    children,
    onBack,
    onOpenInsights,
    overlays,
    status,
    timing,
  }: {
    children: ReactNode;
    onBack: () => void;
    onOpenInsights?: () => void;
    overlays?: ReactNode;
    status: LiveSessionStatusStrip;
    timing?: WorkoutTiming;
  }) {
    return (
      <View style={styles.root}>
        <Animated.View style={[styles.activeWorkoutShell, stageStyle]}>
          <ReedSwapFeedback before={confirmedSwap} onFinished={finishSwap}>
            <View style={styles.activeWorkoutPage}>{children}</View>
          </ReedSwapFeedback>
          <View
            onLayout={(e) => setStatusStripHeight(e.nativeEvent.layout.height + insets.top + theme.spacing.lg + theme.spacing.sm)}
            style={[styles.statusStripFloating, { top: insets.top + theme.spacing.lg }]}
          >
            <WorkoutSessionStatusStrip
              onBack={onBack}
              reed={
                session ? (
                  <SessionHeaderMascot mascot={sessionMascot} hidden={isReedOpen} onTalk={() => openReed(false)} />
                ) : undefined
              }
              onOpenInsights={onOpenInsights}
              status={status}
              timing={timing ?? (view.kind === 'active' && session ? { ...session.session } : undefined)}
            />
          </View>
        </Animated.View>
        {session ? (
          <>
            <SessionWhisper
              value={whisper ?? null}
              top={statusStripHeight + theme.spacing.xs}
              allowed={!isReedOpen && !isPickerInteracting && !isWorking && page === 'exercise'}
              onOpen={() => openReed(true)}
            />
            <ReedSessionSheet
              open={isReedOpen}
              context={askContext}
              onClose={() => setIsReedOpen(false)}
              onApplied={(exerciseId) => {
                if (beforeSwap.current?.exerciseId === exerciseId) setConfirmedSwap(beforeSwap.current);
                sessionMascot.react('happy');
                sessionMascot.act('tick');
              }}
            />
          </>
        ) : null}
        {overlays}
      </View>
    );
  }

  if (session === undefined) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator color={String(theme.colors.accent)} />
      </View>
    );
  }

  if (session === null && view.kind === 'draft') {
    const draftStatus: LiveSessionStatusStrip = {
      completedSetsLabel: '0 sets',
      durationLabel: '0m',
      microLineTokens: [],
      workSlotKind: 'active',
      workSlotLabel: 'Open',
    };

    return renderSessionChrome({
      children: (
        <TimelinePage
          activeRestCard={null}
          contentTopInset={statusStripHeight}
          elapsedLabel={null}
          errorMessage={
            errorMessage ??
            (restPermissionDenied ? 'Enable notifications to get rest alerts when the app is in the background.' : null)
          }
          timeline={[]}
          editor={{
            kind: 'draft',
            isConfirmingFinishSession: isConfirmingFinishSession,
            isWorking: isTimelineMutationPending,
            onAddExercise: () => {
              setIsConfirmingFinishSession(false);
              setIsAddSheetOpen(true);
            },
            onClearFinishSessionConfirm: () => setIsConfirmingFinishSession(false),
            onFinishSession: handleFinishSession,
            onToggleFinishSessionConfirm: () => setIsConfirmingFinishSession((current) => !current),
          }}
        />
      ),
      onBack: () => {
        setIsConfirmingFinishSession(false);
        setIsAddSheetOpen(false);
        openHistory();
      },
      overlays: (
        <AddExerciseSheet
          isOpen={isAddSheetOpen}
          isWorking={isWorking || isTimelineMutationPending}
          onAddBulk={handleAddExercisesBulk}
          onAddSingle={handleAddExercise}
          onClose={closeAddSheet}
          onToggleFavorite={handleToggleFavorite}
        />
      ),
      status: draftStatus,
    });
  }

  if (session === null || view.kind !== 'active') {
    return <WorkoutHistoryScreen
      selectedEndedSessionId={view.kind === 'past-session' ? view.sessionId : null}
      onOpenSession={openSession}
      onShowHistory={openHistory}
      onResume={openActive}
      onStart={handleStartSession}
      onBack={onBack}
      contentTopInset={statusStripHeight}
      renderSessionChrome={renderSessionChrome}
    />;
  }

  const renderWorkoutPage = (targetPage: WorkoutPage) =>
    targetPage === 'timeline' ? (
      <TimelinePage
        activeRestCard={restRuntime}
        contentTopInset={statusStripHeight}
        elapsedLabel={null}
        sessionStartedAt={session.session.startedAt}
        errorMessage={
          errorMessage ??
          (restPermissionDenied ? 'Enable notifications to get rest alerts when the app is in the background.' : null)
        }
        hasNotes={Boolean(session.session.userNotes?.trim())}
        onOpenNotes={() => setIsSessionNotesOpen(true)}
        timeline={session.timeline}
        editor={{
          kind: 'active',
          isConfirmingFinishSession: isConfirmingFinishSession,
          isWorking: isTimelineMutationPending,
          onAddExercise: () => {
            setIsConfirmingFinishSession(false);
            setIsAddSheetOpen(true);
          },
          onClearFinishSessionConfirm: () => setIsConfirmingFinishSession(false),
          onFinishSession: handleFinishSession,
          onToggleFinishSessionConfirm: () => setIsConfirmingFinishSession((current) => !current),
          exercises: {
            onDeleteSet: handleDeleteSet,
            onOpenExercise: handleSelectExercise,
            onOpenSet: handleOpenSet,
            onReorderTimeline: handleReorderTimeline,
            onRemoveExercise: handleRemoveExercise,
          },
        }}
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
          onSetOutcomeDetailsChange: setSetOutcomeDetails,
          onPickerInteractionEnd: () => setIsPickerInteracting(false),
          onPickerInteractionStart: () => setIsPickerInteracting(true),
          onUpdateMetric: (key, nextValue) =>
            setMetricValues((current) => ({
              ...current,
              [key]: nextValue,
            })),
          onWarmupToggle: () => setWarmup((current) => !current),
          setOutcomeDetails,
          warmup,
        }}
        liveCardio={{
          card: liveCardioCard,
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
            showPage('timeline');
          },
        }}
        rest={{
          card: restCard,
          errorMessage,
          isWorking,
          onAdjust: handleAdjustRest,
          onPreset: handlePresetRest,
          onSwipeLeft: handleRestSwipeLeft,
          onSwipeRight: handleRestSwipeRight,
          onToggleRunning: handleToggleRestRunning,
        }}
      />
    );

  function handleStatusStripBack() {
    // Workout has a local landing level plus the active session level.
    // Nested exercise/rest/live-cardio surfaces return to the session timeline first.
    if (page === 'timeline') {
      openHistory();
      setIsConfirmingFinishSession(false);
      setIsInsightsOpen(false);
      setIsSessionNotesOpen(false);
      return;
    }

    setEditingSet(null);
    setLiveCardioFinishSummary(null);
    showPage('timeline');
  }

  return renderSessionChrome({
    children: renderWorkoutPage(page),
    onBack: handleStatusStripBack,
    onOpenInsights: () => {
      setIsInsightsOpen(true);
      void refreshSessionInsights();
    },
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

        <WorkoutSessionInsightsSheet
          errorMessage={sessionInsightsError}
          insights={sessionInsights}
          isLoading={isSessionInsightsLoading}
          isOpen={isInsightsOpen}
          onClose={() => setIsInsightsOpen(false)}
          onRetry={() => {
            void refreshSessionInsights();
          }}
        />

        <WorkoutSessionNotesSheet
          initialNotes={session.session.userNotes ?? ''}
          isOpen={isSessionNotesOpen}
          isSaving={isSavingSessionNotes}
          onClose={() => setIsSessionNotesOpen(false)}
          onSave={(notes) => handleSaveSessionNotes(session.session.sessionId, notes)}
        />
      </>
    ),
    status: insightsStatus,
  });
}

function getNextTimelineExerciseId(
  timeline: TimelineRow[],
  currentId: Id<'liveSessionExercises'>,
): Id<'liveSessionExercises'> | null {
  const currentIndex = timeline.findIndex((row) => row.sessionExerciseId === currentId);

  if (currentIndex < 0) {
    return null;
  }

  const nextRow = timeline[currentIndex + 1];
  return nextRow?.sessionExerciseId ?? null;
}

export function WorkoutSurface(props: WorkoutSurfaceProps) {
  return (
    <StageRecedeProvider>
      <SessionMascotProvider>
        <WorkoutSurfaceContent {...props} />
      </SessionMascotProvider>
    </StageRecedeProvider>
  );
}

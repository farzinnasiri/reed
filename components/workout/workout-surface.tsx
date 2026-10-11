import { WorkoutDurationEditor } from './workout-duration';
import { normalizeMetricValueForField } from '@/domains/workout/metric-formatting';
import { clampSeconds, getRestSnapshot } from '@/domains/workout/rest';
import { SessionDockMascot } from '@/components/reed/session/session-dock-mascot';
import { SessionMascotProvider } from '@/components/reed/session/session-mascot';
import { SessionWhisper } from '@/components/reed/session/session-whisper';
import { ReedSessionSheet, type SessionAskContext } from '@/components/reed/session/reed-session-sheet';
import { useMascot } from '@/components/reed/mascot';
import { StageRecedeProvider, useStageRecedeStyle } from '@/design/stage-recede';
import { reedSprings } from '@/design/motion';
import { reedSessionMetrics } from '@/design/system';
import * as haptics from '@/design/haptics';
import * as sounds from '@/design/sounds';
import Animated from 'react-native-reanimated';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
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
import { WorkoutSessionNotesSheet } from './workout-session-notes-sheet';
import { SessionClock, SessionStripActions, WorkoutSessionStrip } from './workout-session-status-strip';
import { SESSION_STRIP_ACTIONS_HEIGHT, SESSION_STRIP_HEIGHT } from './workout-session-status-strip.styles';
import { SessionDock } from './session-dock';
import { DOCK_ROW_HEIGHT, useExerciseDockSize } from './session-dock.styles';
import { FinishSessionSheet } from './finish-session-sheet';
import { SessionPanel } from './session-panel';
import { deriveNextAction } from './session-next-action';
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
  const exerciseDockSize = useExerciseDockSize();
  const stageStyle = useStageRecedeStyle();
  const sessionMascot = useMascot('watching');
  const [isReedOpen, setIsReedOpen] = useState(false);
  // Reed leaves the conversation sheet as it starts to close, not when it has finished, so she is back by the time it is gone.
  const [isReedClosing, setIsReedClosing] = useState(false);
  const [askContext, setAskContext] = useState<SessionAskContext | null>(null);
  const [committedSet, setCommittedSet] = useState<{
    id: Id<'activityLogs'>;
    exercise: Id<'liveSessionExercises'>;
    at: number;
  } | null>(null);
  const beforeSwap = useRef<ReedSwapSnapshot | null>(null);
  const [durationOpenedAt, setDurationOpenedAt] = useState<number | null>(null);
  const panelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (panelTimer.current) clearTimeout(panelTimer.current); }, []);
  // Sheets open once the session panel has settled, so the two never fight over the stage.
  const afterPanel = useCallback((action: () => void) => {
    if (panelTimer.current) clearTimeout(panelTimer.current);
    panelTimer.current = setTimeout(action, reedSprings.morph.duration);
  }, []);
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
  const setSessionDuration = useMutation(api.liveSessions.setSessionDuration);
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
  const [addSheetMode, setAddSheetMode] = useState<'queue' | null>(null);
  const isAddSheetOpen = addSheetMode !== null;
  const [isPickerInteracting, setIsPickerInteracting] = useState(false);
  const isTimelineMutationPending = timelineOperation.isWorking;
  const [localError, setErrorMessage] = useState<string | null>(null);
  const errorMessage = localError ?? captureOperation.errorMessage ?? timelineOperation.errorMessage;
  const [isSessionNotesOpen, setIsSessionNotesOpen] = useState(false);
  const [isFinishOpen, setIsFinishOpen] = useState(false);
  // The session just finished, so its recap celebrates once; leaving the recap clears it.
  const [justFinishedId, setJustFinishedId] = useState<Id<'liveSessions'> | null>(null);
  const [isSavingSessionNotes, setIsSavingSessionNotes] = useState(false);
  const [liveCardioFinishSummary, setLiveCardioFinishSummary] = useState<LiveCardioFinishSummary | null>(null);
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
    openHistory(); setEditingSet(null);
  }
  const [handledIntent, setHandledIntent] = useState<WorkoutEntryIntent | null>(null);
  if (entryIntent !== handledIntent && session !== undefined) {
    setHandledIntent(entryIntent ?? null);
    if (entryIntent) {
      applyIntent(entryIntent, Boolean(session));
      setAddSheetMode(null);
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
    setAddSheetMode(null);
  };

  async function runMutation<T>(action: () => Promise<T>) {
    setErrorMessage(null);
    timelineOperation.clearError();
    const result = await captureOperation.run(action);
    if (result.status === 'error') haptics.warning();
    return result;
  }

  async function handleSaveSessionNotes(sessionId: Id<'liveSessions'>, notes: string) {
    setIsSavingSessionNotes(true);
    setErrorMessage(null);

    try {
      await updateSessionNotes({ notes, sessionId });
      haptics.saved();
      setIsSessionNotesOpen(false);
    } catch (error) {
      haptics.warning();
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingSessionNotes(false);
    }
  }

  async function runTimelineMutation<T>(action: () => Promise<T>) {
    setErrorMessage(null);
    captureOperation.clearError();
    const result = await timelineOperation.run(action);
    if (result.status === 'error') haptics.warning();
    return result;
  }

  async function handleStartSession() {
    setErrorMessage(null);
    openDraft();
  }

  async function handleSelectExercise(sessionExerciseId: Id<'liveSessionExercises'>) {
    await runTimelineMutation(async () => {
      await selectExercise({ sessionExerciseId });
      setEditingSet(null);
      setLiveCardioFinishSummary(null);
      showPage('exercise');
    });
  }

  async function handleOpenSet(sessionExerciseId: Id<'liveSessionExercises'>, setEntry: TimelineSet) {
    await runTimelineMutation(async () => {
      await selectExercise({ sessionExerciseId });
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
    closeAddSheet();
    await runTimelineMutation(async () => {
      await addExercise({ exerciseCatalogId });
      if (shouldTrackSessionStarted) {
        analytics.workoutSessionStarted();
        sounds.workoutStarted();
      }
      if (shouldTrackSessionStarted) haptics.light(); else haptics.saved();
      analytics.exerciseAdded();
      openActive();
    });
  }

  async function handleAddExercisesBulk(exerciseCatalogIds: Id<'exerciseCatalog'>[]) {
    if (exerciseCatalogIds.length === 0) {
      return;
    }

    const shouldTrackSessionStarted = !session;
    closeAddSheet();
    await runTimelineMutation(async () => {
      await addExercises({ exerciseCatalogIds });
      if (shouldTrackSessionStarted) {
        analytics.workoutSessionStarted();
        sounds.workoutStarted();
      }
      if (shouldTrackSessionStarted) haptics.light(); else haptics.saved();
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
      haptics.saved();
    });
  }

  async function handleReorderTimeline(orderedSessionExerciseIds: Id<'liveSessionExercises'>[]) {
    const result = await runTimelineMutation(async () => {
      await reorderExercises({ orderedSessionExerciseIds });
      haptics.selection();
    });

    return result.status === 'success';
  }

  async function handleToggleFavorite(exerciseCatalogId: Id<'exerciseCatalog'>) {
    setErrorMessage(null);

    try {
      await toggleFavorite({ exerciseCatalogId });
      haptics.selection();
    } catch (error) {
      haptics.warning();
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleCaptureSwipeRight(afterSet: 'rest' | 'nextExercise' = 'rest') {
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
        haptics.saved();
        setEditingSet(null);
        return;
      }

      const committed = await logSet({
        afterSet,
        metrics: metricValues,
        sessionExerciseId: captureCard.sessionExerciseId,
        setOutcomeDetails,
        warmup,
      });
      haptics.saved();
      setCommittedSet({ id: committed.setLogId, exercise: captureCard.sessionExerciseId, at: committed.loggedAt });
      sessionMascot.act('tick');
      // Finishing an exercise with nothing queued lands on the timeline, where adding or finishing is one tap.
      if (afterSet === 'nextExercise' && !committed.nextSessionExerciseId) showPage('timeline');
      analytics.workoutSetLogged({
        setNumber: captureCard.currentSetNumber,
        warmup,
      });
    });
  }

  async function handleStartLiveCardio(sessionExerciseId: Id<'liveSessionExercises'>) {
    await runMutation(async () => {
      await startLiveCardio({ sessionExerciseId });
      haptics.toggle(true);
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
        haptics.toggle(false);
      } else {
        await resumeLiveCardio({});
        haptics.toggle(true);
      }
    });
  }

  async function handleAdjustLiveCardioMetric(key: string, delta: number) {
    const field = liveCardioCard?.trackedFields.find(field => field.key === key);
    if (!field || !liveCardioCard) return;
    const current = liveCardioCard.trackedMetrics[key] ?? field.defaultValue;
    const changed = normalizeMetricValueForField(field, current + delta) !== current;
    await runMutation(async () => {
      await adjustLiveCardioMetric({ delta, key });
      if (changed) haptics.selection();
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
    haptics.saved();
    setLiveCardioFinishSummary({
      imageUrl: liveCardioCard.imageUrl,
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
      haptics.saved();
      if (editingSet?.setLogId === setLogId) {
        setEditingSet(null);
      }
    });
  }

  /** `durationSeconds` is the length the user chose over the clock's, for a session left open too long. */
  async function handleFinishSession(durationSeconds?: number) {
    if (!session) {
      setEditingSet(null);
      setAddSheetMode(null);
      openHistory();
      showPage('timeline');
      return;
    }

    const sessionId = session.session.sessionId;
    await runMutation(async () => {
      if (durationSeconds !== undefined) await setSessionDuration({ sessionId, durationSeconds });
      const result = await finishSession({});
      const totalSets =
        session?.timeline.reduce((total: number, row: { setCount: number }) => total + row.setCount, 0) ?? 0;
      const exerciseCount = session?.timeline.length ?? 0;
      if (!result.deletedEmptySession) {
        if (totalSets > 0) { haptics.success(); sounds.workoutCompleted(sessionId); }
        analytics.workoutSessionFinished({
          exerciseCount,
          totalSets,
        });
      }
      setIsFinishOpen(false);
      setEditingSet(null);
      // A finished session ends on its recap; an empty one was never saved, so there is nothing to show.
      if (result.deletedEmptySession) openHistory();
      else { setJustFinishedId(sessionId); openSession(sessionId); }
      showPage('timeline');
    });
  }

  async function handleRestSwipeRight() {
    await runMutation(async () => {
      await endRest({});
      haptics.light();
      // Stay on the exercise page; next-set capture card appears via getCurrent.
    });
  }

  /** Done with this exercise from rest: open the next queued one, or land on the timeline. */
  async function handleRestMoveOn() {
    const nextExerciseId = restCard ? getNextTimelineExerciseId(session?.timeline ?? [], restCard.sessionExerciseId) : null;
    const result = await runMutation(async () => {
      await endRest({});
      if (nextExerciseId) await selectExercise({ sessionExerciseId: nextExerciseId });
      haptics.light();
    });
    if (result.status === 'success' && !nextExerciseId) showPage('timeline');
  }

  async function handleRestSwipeLeft() {
    await runMutation(async () => {
      await endRest({});
      haptics.light();
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
      haptics.toggle(!getRestSnapshot(restCard).isRunning);
    });
  }

  async function handleAdjustRest(deltaSeconds: number) {
    const remaining = restCard ? getRestSnapshot(restCard).remainingSeconds : null;
    const changed = remaining !== null && clampSeconds(remaining + deltaSeconds, 15, 240) !== remaining;
    setErrorMessage(null);
    try {
      await updateRestProcess({ deltaSeconds, mode: 'adjustBy' });
      if (changed) haptics.selection();
    } catch (error) {
      haptics.warning();
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handlePresetRest(durationSeconds: number) {
    const remaining = restCard ? getRestSnapshot(restCard).remainingSeconds : null;
    await runMutation(async () => {
      await updateRestProcess({ durationSeconds, mode: 'setDuration' });
      if (remaining !== durationSeconds || restCard?.durationSeconds !== durationSeconds) haptics.selection();
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
    setIsReedClosing(false);
    setIsReedOpen(true);
  }

  // Content starts below the session strip; the strip itself is placed by `WorkoutSessionStrip`.
  // A live session's timeline has Finish and Notes in a second row of the strip, so its content starts lower.
  const hasStripActions = view.kind === 'active' && page === 'timeline';
  const contentTopInset = insets.top + theme.spacing.lg + SESSION_STRIP_HEIGHT + (hasStripActions ? SESSION_STRIP_ACTIONS_HEIGHT : 0) + theme.spacing.sm;
  const dockBottom = insets.bottom + theme.spacing.xs;

  function renderSessionChrome({
    children,
    dock,
    overlays,
    strip,
  }: {
    children: ReactNode;
    dock?: ReactNode;
    overlays?: ReactNode;
    strip: ComponentProps<typeof WorkoutSessionStrip>;
  }) {
    return (
      <View style={styles.root}>
        <Animated.View style={[styles.activeWorkoutShell, stageStyle]}>
          <ReedSwapFeedback before={confirmedSwap} onFinished={finishSwap}>
            <View style={styles.activeWorkoutPage}>{children}</View>
          </ReedSwapFeedback>
          {dock}
        </Animated.View>
        <WorkoutSessionStrip {...strip} />
        {session ? (
          <>
            <SessionWhisper
              value={whisper ?? null}
              bottom={dockBottom + DOCK_ROW_HEIGHT + theme.spacing.xs}
              left={theme.spacing.chromeGutter + (page === 'exercise' ? exerciseDockSize : reedSessionMetrics.dock) * 0.7}
              allowed={!isReedOpen && !isPickerInteracting && !isWorking && page === 'exercise'}
              onOpen={() => openReed(true)}
            />
            <ReedSessionSheet
              open={isReedOpen}
              context={askContext}
              onClose={() => { setIsReedOpen(false); setIsReedClosing(false); }}
              onClosing={() => setIsReedClosing(true)}
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

  const addExerciseSheet = (
    <AddExerciseSheet
      isOpen={isAddSheetOpen}
      isWorking={isWorking || isTimelineMutationPending}
      onAddBulk={handleAddExercisesBulk}
      onAddSingle={handleAddExercise}
      onClose={closeAddSheet}
      onToggleFavorite={handleToggleFavorite}
    />
  );

  if (session === null && view.kind === 'draft') {
    return renderSessionChrome({
      children: (
        <TimelinePage
          activeRestCard={null}
          contentTopInset={contentTopInset}
          errorMessage={
            errorMessage ??
            (restPermissionDenied ? 'Enable notifications to get rest alerts when the app is in the background.' : null)
          }
          exercises={null}
          isWorking={isTimelineMutationPending}
          timeline={[]}
        />
      ),
      dock: (
        <SessionDock
          disabled={isTimelineMutationPending}
          mascot={<SessionDockMascot hidden={false} mascot={sessionMascot} />}
          next={{ kind: 'add' }}
          onAdd={() => setAddSheetMode('queue')}
          onNext={() => setAddSheetMode('queue')}
          page="timeline"
          restCard={null}
        />
      ),
      overlays: addExerciseSheet,
      strip: {
        lead: <SessionClock fallback="New" />,
        onBack: () => {
          setAddSheetMode(null);
          openHistory();
        },
        sets: '0 sets',
      },
    });
  }

  if (session === null || view.kind !== 'active') {
    return <WorkoutHistoryScreen
      selectedEndedSessionId={view.kind === 'past-session' ? view.sessionId : null}
      onOpenSession={openSession}
      onShowHistory={() => { setJustFinishedId(null); openHistory(); }}
      onResume={openActive}
      onFinishOld={() => { openActive(); setIsFinishOpen(true); }}
      justFinishedId={justFinishedId}
      onStart={handleStartSession}
      onBack={onBack}
      contentTopInset={contentTopInset}
      mascot={sessionMascot}
      renderSessionChrome={renderSessionChrome}
    />;
  }

  const nextAction = deriveNextAction({
    capture: captureCard,
    liveCardio: liveCardioCard,
    rest: restCard,
    timeline: session.timeline,
  });
  const position = captureCard
    ? `${captureCard.exerciseName} · set ${captureCard.currentSetNumber}`
    : (restCard?.exerciseName ?? liveCardioCard?.exerciseName ?? null);
  const lastSetAt = latestSetTime(session.timeline);
  const discardsOnFinish = session.timeline.length === 0 || (session.session.fromPlan && lastSetAt === null);

  const renderWorkoutPage = (targetPage: WorkoutPage) =>
    targetPage === 'timeline' ? (
      <TimelinePage
        activeRestCard={restRuntime}
        contentTopInset={contentTopInset}
        errorMessage={
          errorMessage ??
          (restPermissionDenied ? 'Enable notifications to get rest alerts when the app is in the background.' : null)
        }
        exercises={{
          onDeleteSet: handleDeleteSet,
          onOpenExercise: handleSelectExercise,
          onOpenSet: handleOpenSet,
          onReorderTimeline: handleReorderTimeline,
          onRemoveExercise: handleRemoveExercise,
        }}
        isWorking={isTimelineMutationPending}
        timeline={session.timeline}
      />
    ) : (
      <ExercisePage
        history={{
          exercise: session.timeline.find(row => row.sessionExerciseId === (captureCard?.sessionExerciseId ?? restCard?.sessionExerciseId ?? liveCardioCard?.sessionExerciseId)) ?? null,
          onCancelEdit: () => setEditingSet(null),
        }}
        contentTopInset={contentTopInset}
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
          isWorking: isWorking || isTimelineMutationPending,
          onAdjust: handleAdjustRest,
          onMoveOn: handleRestMoveOn,
          nextExerciseName: restCard ? session.timeline.find(row => row.sessionExerciseId === getNextTimelineExerciseId(session.timeline, restCard.sessionExerciseId))?.exerciseName ?? null : null,
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
      setIsSessionNotesOpen(false);
      return;
    }

    setEditingSet(null);
    setLiveCardioFinishSummary(null);
    showPage('timeline');
  }

  const mascot = <SessionDockMascot hidden={isReedOpen && !isReedClosing} mascot={sessionMascot} onTalk={() => openReed(false)} size={page === 'exercise' ? exerciseDockSize : reedSessionMetrics.dock} />;

  const panelExerciseId = captureCard?.sessionExerciseId ?? restCard?.sessionExerciseId ?? liveCardioCard?.sessionExerciseId ?? null;
  const panelSetCount = session.timeline.find(row => row.sessionExerciseId === panelExerciseId)?.sets.length ?? 0;
  const hasLoggedSets = session.timeline.some(row => row.sets.length > 0);
  const panelPeekHeight = page === 'timeline'
    ? reedSessionMetrics.panelPeekBase + (hasLoggedSets ? reedSessionMetrics.panelGlanceBody : 0)
    : reedSessionMetrics.panelPeekBase
      + Math.min(4, session.timeline.length) * reedSessionMetrics.panelExerciseRow
      + (panelSetCount ? reedSessionMetrics.panelExerciseRow + Math.min(4, panelSetCount) * reedSessionMetrics.panelSetRow : 0);

  return renderSessionChrome({
    children: renderWorkoutPage(page),
    dock: page === 'timeline' ? (
      <SessionDock
        disabled={isTimelineMutationPending}
        mascot={mascot}
        next={nextAction}
        onAdd={() => setAddSheetMode('queue')}
        onNext={() => {
          if (nextAction.kind === 'start') void handleSelectExercise(nextAction.exerciseId);
          else showPage('exercise');
        }}
        page="timeline"
        restCard={nextAction.kind === 'open' ? restRuntime : null}
      />
    ) : (
      <SessionDock mascot={mascot} page="exercise" />
    ),
    overlays: (
      <>
        {addExerciseSheet}
        <WorkoutDurationEditor openedAt={durationOpenedAt} onClose={() => setDurationOpenedAt(null)} timing={{ ...session.session }} />
        <FinishSessionSheet
          discardsOnFinish={discardsOnFinish}
          exerciseCount={session.timeline.length}
          fromPlan={session.session.fromPlan}
          isWorking={isWorking}
          lastSetAt={lastSetAt}
          manualDurationSeconds={session.session.manualDurationSeconds}
          onClose={() => setIsFinishOpen(false)}
          onFinish={durationSeconds => void handleFinishSession(durationSeconds)}
          open={isFinishOpen}
          startedAt={session.session.startedAt}
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
    strip: {
      actions: page === 'timeline' ? (
        <SessionStripActions
          hasNotes={Boolean(session.session.userNotes?.trim())}
          onFinish={() => setIsFinishOpen(true)}
          onNotes={() => setIsSessionNotesOpen(true)}
        />
      ) : undefined,
      lead: <SessionClock manualDurationSeconds={session.session.manualDurationSeconds} startedAt={session.session.startedAt} />,
      onBack: handleStatusStripBack,
      panelPeekHeight,
      panelFullHeight: session.timeline.some(row => row.sets.length) ? undefined : reedSessionMetrics.panelFullBase,
      panel: controls => (
        <SessionPanel
          controls={controls}
          workout={{
            page,
            timeline: session.timeline,
            activeExerciseId: panelExerciseId,
            onOpenExercise: exercise => { controls.close(); afterPanel(() => void handleSelectExercise(exercise.sessionExerciseId)); },
            onOpenSet: (exercise, set) => { controls.close(); afterPanel(() => void handleOpenSet(exercise.sessionExerciseId, set)); },
          }}
          session={{
            durationFallback: insightsStatus.durationLabel,
            discardsOnFinish,
            exerciseCount: session.timeline.length,
            insights: sessionInsights,
            insightsError: sessionInsightsError,
            insightsLoading: isSessionInsightsLoading,
            isWorking,
            notes: session.session.userNotes ?? '',
            timing: { ...session.session },
          }}
          actions={{
            onFinish: () => { controls.close(); afterPanel(() => setIsFinishOpen(true)); },
            onOpenNotes: () => { controls.close(); afterPanel(() => setIsSessionNotesOpen(true)); },
            onEditDuration: () => { controls.close(); afterPanel(() => setDurationOpenedAt(Date.now())); },
            onRefreshInsights: refreshSessionInsights,
          }}
        />
      ),
      position,
      sets: insightsStatus.completedSetsLabel,
    },
  });
}

/** When the most recent set in the session was logged, or null if none was. */
function latestSetTime(timeline: TimelineRow[]) {
  let latest: number | null = null;
  for (const row of timeline) for (const setEntry of row.sets) if (latest === null || setEntry.loggedAt > latest) latest = setEntry.loggedAt;
  return latest;
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

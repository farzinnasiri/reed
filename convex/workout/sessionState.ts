import type { Doc, Id } from '../_generated/dataModel';
import { getLiveCardioSnapshot } from '../../domains/workout/liveCardio';
import { getRestSnapshot } from '../../domains/workout/rest';
import { formatSetOutcomeDetails } from '../../domains/workout/modifier-formatting';
import {
  emptyExerciseModifierCapabilities,
  normalizeExerciseModifierCapabilities,
} from '../../domains/workout/modifier-capabilities';
import {
  getLiveCardioTrackedFields,
  getRecipeDefinition,
  prepareRecipeCaptureInput,
  summarizeMetrics,
} from '../../domains/workout/recipes';
import type { RestProcess } from './processes';

type ActiveSession = Doc<'liveSessions'> & { status: 'active' };
type SessionExerciseWithRecipe = Doc<'liveSessionExercises'> & {
  recipeKey: NonNullable<Doc<'liveSessionExercises'>['recipeKey']>;
};

export function getRequestedActiveSessionExerciseId(session: ActiveSession, firstExerciseId: Id<'liveSessionExercises'> | null) {
  return (session.activeProcess?.kind === 'live_cardio' ? session.activeProcess.sessionExerciseId : null)
    ?? session.activeSessionExerciseId ?? firstExerciseId;
}

export function resolveCurrentSessionExercise<T extends Pick<Doc<'liveSessionExercises'>, '_id'>>(
  session: ActiveSession,
  sessionExercises: T[],
) {
  const requestedId = getRequestedActiveSessionExerciseId(session, sessionExercises[0]?._id ?? null);
  return sessionExercises.find(entry => entry._id === requestedId) ?? sessionExercises[0] ?? null;
}

export function getNextSessionSetNumber(loggedSets: readonly Pick<Doc<'activityLogs'>, '_id'>[]) {
  return loggedSets.length + 1;
}

function sessionSummary(session: ActiveSession) {
  return {
    fromPlan: session.sourcePlannedSessionId !== undefined,
    manualDurationSeconds: session.manualDurationSeconds,
    sessionId: session._id,
    startedAt: session.startedAt,
    status: session.status,
    userNotes: session.userNotes ?? '',
    userNotesUpdatedAt: session.userNotesUpdatedAt ?? null,
  };
}

export function buildCurrentLiveSessionState(args: {
  imageUrls?: ReadonlyMap<Id<'exerciseCatalog'>, string | null>;
  logsByExercise: Map<Id<'liveSessionExercises'>, Doc<'activityLogs'>[]>;
  session: ActiveSession;
  sessionExercises: SessionExerciseWithRecipe[];
}) {
  const { imageUrls, logsByExercise, session, sessionExercises } = args;
  const restProcess = session.activeProcess?.kind === 'rest' ? session.activeProcess : null;
  const liveCardioProcess = session.activeProcess?.kind === 'live_cardio' ? session.activeProcess : null;
  const requestedActiveSessionExerciseId = getRequestedActiveSessionExerciseId(session, sessionExercises[0]?._id ?? null);

  const timeline = sessionExercises.map(sessionExercise => {
    const logs = logsByExercise.get(sessionExercise._id) ?? [];
    const lastLog = logs.at(-1);
    const isLiveCardioRecipe = getRecipeDefinition(sessionExercise.recipeKey).processKind === 'live_cardio';
    const state: 'idle' | 'capture' | 'rest' | 'logged' | 'live_tracking' =
      liveCardioProcess?.sessionExerciseId === sessionExercise._id
        ? 'live_tracking'
        : restProcess?.sessionExerciseId === sessionExercise._id
          ? 'rest'
          : requestedActiveSessionExerciseId === sessionExercise._id && !(isLiveCardioRecipe && logs.length > 0)
            ? 'capture'
            : logs.length > 0
              ? 'logged'
              : 'idle';

    return {
      imageUrl: imageUrls?.get(sessionExercise.exerciseCatalogId) ?? null,
      exerciseName: sessionExercise.exerciseName,
      exerciseSetupModifiers: sessionExercise.setupModifiers ?? {},
      lastLoggedSummary: lastLog ? summarizeActivityLog(lastLog) : null,
      sessionExerciseId: sessionExercise._id,
      sets: logs.map(log => ({
        derivedBodyweightKg: log.derivedBodyweightKg ?? null,
        derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
        loggedAt: log.loggedAt,
        metrics: log.metrics,
        restSeconds: log.restSeconds ?? null,
        setLogId: log._id,
        setOutcomeDetails: log.setOutcomeDetails ?? null,
        setNumber: log.setNumber,
        summary: summarizeActivityLog(log),
        warmup: log.warmup,
      })),
      setCount: logs.length,
      state,
    };
  });

  const activeSessionExercise = resolveCurrentSessionExercise(session, sessionExercises);

  if (!activeSessionExercise) {
    return {
      activeCard: { capture: null, liveCardio: null, rest: null },
      cardMode: 'capture',
      restRuntime: null,
      session: sessionSummary(session),
      timeline,
    };
  }

  const activeLogs = logsByExercise.get(activeSessionExercise._id) ?? [];
  const previousSet = activeLogs.at(-1);
  const activeRecipeDefinition = getRecipeDefinition(activeSessionExercise.recipeKey);
  const restRuntime = restProcess ? buildRestCard(restProcess, sessionExercises, logsByExercise, imageUrls) : null;

  if (liveCardioProcess && liveCardioProcess.sessionExerciseId === activeSessionExercise._id) {
    const liveCardioSnapshot = getLiveCardioSnapshot(liveCardioProcess);
    return {
      activeCard: {
        capture: null,
        liveCardio: {
          imageUrl: imageUrls?.get(activeSessionExercise.exerciseCatalogId) ?? null,
          elapsedSeconds: liveCardioSnapshot.elapsedSeconds,
          exerciseName: activeSessionExercise.exerciseName,
          isRunning: liveCardioSnapshot.isRunning,
          lastResumedAt: liveCardioProcess.lastResumedAt,
          layoutKind: activeRecipeDefinition.layoutKind,
          nextSetNumber: getNextSessionSetNumber(activeLogs),
          previousSetSummary: previousSet ? summarizeActivityLog(previousSet) : null,
          processKind: activeRecipeDefinition.processKind,
          recipeKey: liveCardioProcess.recipeKey,
          sessionExerciseId: activeSessionExercise._id,
          startedAt: liveCardioProcess.startedAt,
          trackedFields: getLiveCardioTrackedFields(liveCardioProcess.recipeKey),
          trackedMetrics: liveCardioProcess.trackedMetrics,
        },
        rest: null,
      },
      cardMode: 'live_cardio',
      restRuntime,
      session: sessionSummary(session),
      timeline,
    };
  }

  const setupSeedMetrics =
    !previousSet && activeSessionExercise.recipeKey === 'assist_bodyweight'
      ? { assistLoad: activeSessionExercise.setupModifiers?.assistanceSupportKg ?? 0 }
      : null;
  const captureInput = prepareRecipeCaptureInput(
    activeSessionExercise.recipeKey,
    previousSet?.metrics ?? setupSeedMetrics,
  );
  const targetMetrics = activeSessionExercise.targetDefaults?.[activeLogs.length]?.metrics;
  const captureCard = {
    imageUrl: imageUrls?.get(activeSessionExercise.exerciseCatalogId) ?? null,
    exerciseCatalogId: activeSessionExercise.exerciseCatalogId,
    currentSetNumber: getNextSessionSetNumber(activeLogs),
    exerciseName: activeSessionExercise.exerciseName,
    exerciseSetupModifiers: activeSessionExercise.setupModifiers ?? {},
    fields: captureInput.fields,
    initialMetrics: targetMetrics
      ? prepareRecipeCaptureInput(activeSessionExercise.recipeKey, targetMetrics).initialMetrics
      : captureInput.initialMetrics,
    layoutKind: captureInput.layoutKind,
    modifierCapabilities: normalizeExerciseModifierCapabilities(
      activeSessionExercise.modifierCapabilities ?? emptyExerciseModifierCapabilities,
    ),
    previousMetrics: captureInput.previousMetrics,
    initialSetOutcomeDetails: previousSet?.setOutcomeDetails?.inclineAngleDegrees === undefined ? {} : { inclineAngleDegrees: previousSet.setOutcomeDetails.inclineAngleDegrees },
    previousSetSummary: previousSet ? summarizeActivityLog(previousSet) : null,
    processKind: captureInput.processKind,
    recipeKey: captureInput.recipeKey,
    sessionExerciseId: activeSessionExercise._id,
  };

  if (!restProcess || !restRuntime || restProcess.sessionExerciseId !== activeSessionExercise._id) {
    return {
      activeCard: {
        capture: captureCard,
        liveCardio: null,
        rest: null,
      },
      cardMode: 'capture',
      restRuntime,
      session: sessionSummary(session),
      timeline,
    };
  }

  return {
    activeCard: {
      capture: null,
      liveCardio: null,
      rest: restRuntime,
    },
    cardMode: 'rest',
    restRuntime,
    session: sessionSummary(session),
    timeline,
  };
}

function buildRestCard(
  restProcess: RestProcess,
  sessionExercises: SessionExerciseWithRecipe[],
  logsByExercise: Map<Id<'liveSessionExercises'>, Doc<'activityLogs'>[]>,
  imageUrls?: ReadonlyMap<Id<'exerciseCatalog'>, string | null>,
) {
  const restExercise = sessionExercises.find(entry => entry._id === restProcess.sessionExerciseId);
  if (!restExercise) {
    return null;
  }

  const restLogs = logsByExercise.get(restExercise._id) ?? [];
  const previousSet = restLogs.at(-1);
  // Keep base duration and start together. Clients calculate elapsed time from this pair.
  const restSnapshot = getRestSnapshot(restProcess);

  return {
    imageUrl: imageUrls?.get(restExercise.exerciseCatalogId) ?? null,
    durationSeconds: restSnapshot.durationSeconds,
    exerciseName: restExercise.exerciseName,
    isComplete: restSnapshot.isComplete,
    isRunning: restProcess.isRunning,
    nextSetNumber: restProcess.nextSetNumber,
    previousSetSummary: previousSet ? summarizeActivityLog(previousSet) : null,
    remainingSeconds: restProcess.remainingSeconds,
    startedAt: restProcess.startedAt,
    sessionExerciseId: restExercise._id,
  };
}

function summarizeActivityLog(log: Doc<'activityLogs'>) {
  const baseSummary = summarizeMetrics(log.recipeKey, log.metrics);
  const details = formatSetOutcomeDetails(log.setOutcomeDetails ?? null, log.metrics);
  return details ? `${baseSummary} · ${details}` : baseSummary;
}

import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';
import {
  requireLiveCardioProcess,
  requireRestProcess,
  writeRestSecondsToCurrentSetLog,
} from './liveSessionProcesses';
import { getLiveCardioElapsedSeconds, getLiveCardioSnapshot } from '../domains/workout/liveCardio';
import { getRestSnapshot, clampSeconds } from '../domains/workout/rest';
import {
  getLiveCardioTrackedFields,
  getRecipeDefinition,
  getRecipeFieldDefinitions,
  getRecipeInitialMetrics,
  isLiveCardioRecipeKey,
  roundMetric,
  summarizeMetrics,
  validateRecipeMetrics,
} from '../domains/workout/recipes';
import { setMetricsValidator } from './workoutValidators';

const DEFAULT_REST_SECONDS = 90;

type ActiveSession = Doc<'liveSessions'> & { status: 'active' };
type SessionExerciseWithRecipe = Doc<'liveSessionExercises'> & {
  recipeKey: NonNullable<Doc<'liveSessionExercises'>['recipeKey']>;
};

export const getCurrent = query({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const session = await getActiveSession(ctx, profile._id);

    if (!session) {
      return null;
    }

    const sessionExercises = (await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
      .collect()) as SessionExerciseWithRecipe[];

    const allLogs = await Promise.all(
      sessionExercises.map(sessionExercise =>
        ctx.db
          .query('liveSetLogs')
          .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', sessionExercise._id))
          .collect(),
      ),
    );
    const logsByExercise = new Map<Id<'liveSessionExercises'>, Doc<'liveSetLogs'>[]>(
      sessionExercises.map((sessionExercise, index) => [sessionExercise._id, allLogs[index]]),
    );

    const restProcess = session.activeProcess?.kind === 'rest' ? session.activeProcess : null;
    const liveCardioProcess = session.activeProcess?.kind === 'live_cardio' ? session.activeProcess : null;
    const processOwnedExerciseId =
      liveCardioProcess?.sessionExerciseId ?? restProcess?.sessionExerciseId ?? null;
    const requestedActiveSessionExerciseId =
      processOwnedExerciseId ?? session.activeSessionExerciseId ?? sessionExercises[0]?._id ?? null;

    const timeline = sessionExercises.map(sessionExercise => {
      const logs = logsByExercise.get(sessionExercise._id) ?? [];
      const lastLog = logs.at(-1);
      const isLiveCardioRecipe = getRecipeDefinition(sessionExercise.recipeKey).processKind === 'live_cardio';
      const state: 'idle' | 'capture' | 'rest' | 'logged' | 'live_tracking' =
        liveCardioProcess?.sessionExerciseId === sessionExercise._id
          ? 'live_tracking'
          : restProcess?.sessionExerciseId === sessionExercise._id
            ? 'rest'
            : requestedActiveSessionExerciseId === sessionExercise._id &&
                !(isLiveCardioRecipe && logs.length > 0)
              ? 'capture'
              : logs.length > 0
                ? 'logged'
                : 'idle';

      return {
        exerciseName: sessionExercise.exerciseName,
        lastLoggedSummary: lastLog ? summarizeMetrics(lastLog.recipeKey, lastLog.metrics) : null,
        sessionExerciseId: sessionExercise._id,
        sets: logs.map(log => ({
          metrics: log.metrics,
          restSeconds: log.restSeconds ?? null,
          setLogId: log._id,
          setNumber: log.setNumber,
          summary: summarizeMetrics(log.recipeKey, log.metrics),
          warmup: log.warmup,
        })),
        setCount: logs.length,
        state,
      };
    });

    const activeSessionExercise =
      (requestedActiveSessionExerciseId
        ? sessionExercises.find(entry => entry._id === requestedActiveSessionExerciseId) ?? null
        : null) ?? sessionExercises[0] ?? null;

    if (!activeSessionExercise) {
      return {
        activeCard: { capture: null, liveCardio: null, rest: null },
        cardMode: 'capture',
        session: {
          startedAt: session.startedAt,
          status: session.status,
        },
        timeline,
      };
    }

    const activeLogs = logsByExercise.get(activeSessionExercise._id) ?? [];
    const previousSet = activeLogs.at(-1);
    const activeRecipeDefinition = getRecipeDefinition(activeSessionExercise.recipeKey);

    if (liveCardioProcess && liveCardioProcess.sessionExerciseId === activeSessionExercise._id) {
      const liveCardioSnapshot = getLiveCardioSnapshot(liveCardioProcess);
      return {
        activeCard: {
          capture: null,
          liveCardio: {
            elapsedSeconds: liveCardioSnapshot.elapsedSeconds,
            exerciseName: activeSessionExercise.exerciseName,
            isRunning: liveCardioSnapshot.isRunning,
            layoutKind: activeRecipeDefinition.layoutKind,
            nextSetNumber: activeLogs.length + 1,
            previousSetSummary: previousSet ? summarizeMetrics(previousSet.recipeKey, previousSet.metrics) : null,
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
        session: {
          startedAt: session.startedAt,
          status: session.status,
        },
        timeline,
      };
    }

    const captureCard = {
      currentSetNumber: activeLogs.length + 1,
      exerciseName: activeSessionExercise.exerciseName,
      fields: getRecipeFieldDefinitions(activeSessionExercise.recipeKey),
      initialMetrics: getRecipeInitialMetrics(activeSessionExercise.recipeKey, previousSet?.metrics ?? null),
      layoutKind: activeRecipeDefinition.layoutKind,
      previousMetrics: previousSet?.metrics ?? null,
      previousSetSummary: previousSet ? summarizeMetrics(previousSet.recipeKey, previousSet.metrics) : null,
      processKind: activeRecipeDefinition.processKind,
      recipeKey: activeSessionExercise.recipeKey,
      sessionExerciseId: activeSessionExercise._id,
    };

    if (!restProcess || restProcess.sessionExerciseId !== activeSessionExercise._id) {
      return {
        activeCard: {
          capture: captureCard,
          liveCardio: null,
          rest: null,
        },
        cardMode: 'capture',
        session: {
          startedAt: session.startedAt,
          status: session.status,
        },
        timeline,
      };
    }

    const restSnapshot = getRestSnapshot(restProcess);

    return {
      activeCard: {
        capture: null,
        liveCardio: null,
        rest: {
          durationSeconds: restSnapshot.durationSeconds,
          exerciseName: activeSessionExercise.exerciseName,
          isComplete: restSnapshot.isComplete,
          isRunning: restSnapshot.isRunning,
          nextSetNumber: restProcess.nextSetNumber,
          previousSetSummary: previousSet ? summarizeMetrics(previousSet.recipeKey, previousSet.metrics) : null,
          remainingSeconds: restSnapshot.remainingSeconds,
          sessionExerciseId: activeSessionExercise._id,
        },
      },
      cardMode: 'rest',
      session: {
        startedAt: session.startedAt,
        status: session.status,
      },
      timeline,
    };
  },
});

export const getLatestEndedSummary = query({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const endedSessions = await ctx.db
      .query('liveSessions')
      .withIndex('by_profile_id_and_status', q => q.eq('profileId', profile._id).eq('status', 'ended'))
      .collect();

    if (endedSessions.length === 0) {
      return null;
    }

    const sortedEndedSessions = [...endedSessions].sort(
      (left, right) => (right.endedAt ?? right.startedAt) - (left.endedAt ?? left.startedAt),
    );

    for (const endedSession of sortedEndedSessions) {
      const summary = await buildEndedSessionSummary(ctx, endedSession._id);

      if (summary.exerciseCount === 0) {
        continue;
      }

      return {
        ...summary,
        endedAt: endedSession.endedAt ?? endedSession.startedAt,
      };
    }

    return null;
  },
});

export const removeExercise = mutation({
  args: { sessionExerciseId: v.id('liveSessionExercises') },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);
    const sessionExercise = await ctx.db.get(args.sessionExerciseId);

    if (!sessionExercise || sessionExercise.profileId !== profile._id || sessionExercise.sessionId !== session._id) {
      throw new ConvexError('That exercise is not part of the current session.');
    }

    const sessionExercises = (await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
      .collect()) as Doc<'liveSessionExercises'>[];
    const remainingExercises = sessionExercises.filter(entry => entry._id !== sessionExercise._id);

    const logs = await ctx.db
      .query('liveSetLogs')
      .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', sessionExercise._id))
      .collect();

    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    await ctx.db.delete(sessionExercise._id);

    for (const entry of remainingExercises) {
      if (entry.position > sessionExercise.position) {
        await ctx.db.patch(entry._id, { position: entry.position - 1 });
      }
    }

    let nextActiveSessionExerciseId: Id<'liveSessionExercises'> | undefined;
    const currentActiveStillExists =
      session.activeSessionExerciseId &&
      session.activeSessionExerciseId !== sessionExercise._id &&
      remainingExercises.some(entry => entry._id === session.activeSessionExerciseId);

    if (currentActiveStillExists) {
      nextActiveSessionExerciseId = session.activeSessionExerciseId;
    } else if (remainingExercises.length > 0) {
      const nextExercise =
        remainingExercises.find(entry => entry.position >= sessionExercise.position) ??
        remainingExercises[remainingExercises.length - 1];
      nextActiveSessionExerciseId = nextExercise._id;
    }

    const activeProcess =
      session.activeProcess &&
      (session.activeProcess.kind === 'rest' || session.activeProcess.kind === 'live_cardio') &&
      session.activeProcess.sessionExerciseId === sessionExercise._id
        ? null
        : session.activeProcess;

    await ctx.db.patch(session._id, {
      activeProcess,
      activeSessionExerciseId: nextActiveSessionExerciseId,
    });
    return { removedSessionExerciseId: sessionExercise._id };
  },
});

export const start = mutation({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const existing = await getActiveSession(ctx, profile._id);

    if (existing) {
      return { sessionId: existing._id };
    }

    const sessionId = await ctx.db.insert('liveSessions', {
      activeProcess: null,
      profileId: profile._id,
      startedAt: Date.now(),
      status: 'active',
    });

    return { sessionId };
  },
});

export const finishSession = mutation({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);
    const sessionExercises = await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
      .collect();

    if (sessionExercises.length === 0) {
      // Defensive: delete any orphan set logs that may have been created
      // through a race before the exercise row was removed.
      const orphanLogs = await ctx.db
        .query('liveSetLogs')
        .withIndex('by_session_id_and_set_number', q => q.eq('sessionId', session._id))
        .collect();
      for (const log of orphanLogs) {
        await ctx.db.delete(log._id);
      }
      await ctx.db.delete(session._id);
      return { deletedEmptySession: true };
    }

    await ctx.db.patch(session._id, {
      activeProcess: null,
      endedAt: Date.now(),
      status: 'ended',
    });

    return { deletedEmptySession: false };
  },
});

export const addExercise = mutation({
  args: { exerciseCatalogId: v.id('exerciseCatalog') },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);
    const catalogExercise = await ctx.db.get(args.exerciseCatalogId);

    if (!catalogExercise || !catalogExercise.recipeKey || !catalogExercise.isSupportedInLiveSession) {
      throw new ConvexError('This exercise is not available in the live session flow yet.');
    }

    const existingEntries = await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
      .collect();
    const sessionExerciseId = await ctx.db.insert('liveSessionExercises', {
      addedAt: Date.now(),
      defaultSummaryFormat: catalogExercise.defaultSummaryFormat,
      exerciseCatalogId: catalogExercise._id,
      exerciseClass: catalogExercise.exerciseClass,
      exerciseName: catalogExercise.name,
      position: existingEntries.length,
      profileId: profile._id,
      recipeKey: catalogExercise.recipeKey,
      sessionId: session._id,
    });

    if (!session.activeSessionExerciseId) {
      await ctx.db.patch(session._id, { activeSessionExerciseId: sessionExerciseId });
    }

    return { sessionExerciseId };
  },
});

export const selectExercise = mutation({
  args: { sessionExerciseId: v.id('liveSessionExercises') },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);
    const sessionExercise = await ctx.db.get(args.sessionExerciseId);

    if (!sessionExercise || sessionExercise.profileId !== profile._id || sessionExercise.sessionId !== session._id) {
      throw new ConvexError('That exercise is not part of the current session.');
    }

    if (
      session.activeProcess?.kind === 'live_cardio' &&
      session.activeProcess.sessionExerciseId !== sessionExercise._id
    ) {
      // Live cardio owns the active exercise while running/paused so the
      // runtime card cannot be detached from its tracked exercise.
      throw new ConvexError('Finish live cardio before switching to another exercise.');
    }

    await ctx.db.patch(session._id, {
      activeSessionExerciseId: sessionExercise._id,
    });
    return null;
  },
});

export const logSet = mutation({
  args: {
    metrics: setMetricsValidator,
    sessionExerciseId: v.id('liveSessionExercises'),
    warmup: v.boolean(),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);

    if (session.activeProcess) {
      throw new ConvexError('Resolve the active runtime card before logging another set.');
    }

    const sessionExercise = await requireSessionExercise(ctx, session, profile._id, args.sessionExerciseId);
    const recipeDefinition = getRecipeDefinition(sessionExercise.recipeKey);

    if (recipeDefinition.processKind === 'live_cardio') {
      throw new ConvexError('Use live cardio tracking for this exercise.');
    }

    const normalizedMetrics = normalizeMetricsOrThrow(sessionExercise.recipeKey, args.metrics);
    const existingLogs = await ctx.db
      .query('liveSetLogs')
      .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', sessionExercise._id))
      .collect();
    const setNumber = existingLogs.length + 1;
    const shouldOpenRest = recipeDefinition.processKind === 'rest_after_log';

    await ctx.db.insert('liveSetLogs', {
      loggedAt: Date.now(),
      metrics: normalizedMetrics,
      profileId: profile._id,
      recipeKey: sessionExercise.recipeKey,
      restSeconds: shouldOpenRest ? DEFAULT_REST_SECONDS : undefined,
      sessionExerciseId: sessionExercise._id,
      sessionId: session._id,
      setNumber,
      warmup: args.warmup,
    });

    await ctx.db.patch(session._id, {
      activeProcess: shouldOpenRest
        ? {
            durationSeconds: DEFAULT_REST_SECONDS,
            isRunning: false,
            kind: 'rest',
            nextSetNumber: setNumber + 1,
            remainingSeconds: DEFAULT_REST_SECONDS,
            sessionExerciseId: sessionExercise._id,
            startedAt: null,
          }
        : null,
      activeSessionExerciseId: sessionExercise._id,
    });

    return {
      enteredRest: shouldOpenRest,
      nextSetNumber: setNumber + 1,
      summary: summarizeMetrics(sessionExercise.recipeKey, normalizedMetrics),
    };
  },
});

export const updateSet = mutation({
  args: {
    metrics: setMetricsValidator,
    setLogId: v.id('liveSetLogs'),
    warmup: v.boolean(),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);

    if (session.activeProcess) {
      throw new ConvexError('Finish the active runtime card before editing sets.');
    }

    const setLog = await ctx.db.get(args.setLogId);

    if (!setLog || setLog.profileId !== profile._id || setLog.sessionId !== session._id) {
      throw new ConvexError('That set is not part of the current session.');
    }

    const sessionExercise = await requireSessionExercise(ctx, session, profile._id, setLog.sessionExerciseId);
    const normalizedMetrics = normalizeMetricsOrThrow(sessionExercise.recipeKey, args.metrics);

    await ctx.db.patch(setLog._id, {
      loggedAt: Date.now(),
      metrics: normalizedMetrics,
      warmup: args.warmup,
    });

    await ctx.db.patch(session._id, {
      activeSessionExerciseId: sessionExercise._id,
    });

    return {
      setNumber: setLog.setNumber,
      summary: summarizeMetrics(sessionExercise.recipeKey, normalizedMetrics),
    };
  },
});

export const deleteSet = mutation({
  args: { setLogId: v.id('liveSetLogs') },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);

    if (session.activeProcess) {
      throw new ConvexError('Finish the active runtime card before deleting sets.');
    }

    const setLog = await ctx.db.get(args.setLogId);

    if (!setLog || setLog.profileId !== profile._id || setLog.sessionId !== session._id) {
      throw new ConvexError('That set is not part of the current session.');
    }

    await requireSessionExercise(ctx, session, profile._id, setLog.sessionExerciseId);

    const siblingLogs = await ctx.db
      .query('liveSetLogs')
      .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', setLog.sessionExerciseId))
      .collect();

    for (const sibling of siblingLogs) {
      if (sibling._id === setLog._id) {
        continue;
      }
      if (sibling.setNumber > setLog.setNumber) {
        await ctx.db.patch(sibling._id, { setNumber: sibling.setNumber - 1 });
      }
    }

    await ctx.db.delete(setLog._id);

    await ctx.db.patch(session._id, {
      activeSessionExerciseId: setLog.sessionExerciseId,
    });

    return {
      deletedSetNumber: setLog.setNumber,
      sessionExerciseId: setLog.sessionExerciseId,
    };
  },
});

/**
 * Ends the current rest card (swipe-right = proceed to next set,
 * swipe-left = return to timeline). Both flows clear activeProcess and
 * keep the user on the same exercise; the client is responsible for
 * navigating to the timeline when the user swiped left.
 */
export const endRest = mutation({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);
    const restProcess = requireRestProcess(session);

    await ctx.db.patch(session._id, {
      activeProcess: null,
      activeSessionExerciseId: restProcess.sessionExerciseId,
    });

    return null;
  },
});

export const updateRestProcess = mutation({
  args: {
    deltaSeconds: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    mode: v.union(v.literal('toggleRunning'), v.literal('adjustBy'), v.literal('setDuration')),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);
    const restProcess = requireRestProcess(session);
    const restSnapshot = getRestSnapshot(restProcess);

    if (args.mode === 'toggleRunning') {
      const nextRemaining =
        restSnapshot.remainingSeconds > 0 ? restSnapshot.remainingSeconds : restProcess.durationSeconds;

      await ctx.db.patch(session._id, {
        activeProcess: restSnapshot.isRunning
          ? {
              ...restProcess,
              isRunning: false,
              remainingSeconds: restSnapshot.remainingSeconds,
              startedAt: null,
            }
          : {
              ...restProcess,
              isRunning: true,
              remainingSeconds: nextRemaining,
              startedAt: Date.now(),
            },
      });

      return null;
    }

    if (args.mode === 'adjustBy') {
      if (args.deltaSeconds === undefined) {
        throw new ConvexError('deltaSeconds is required for rest adjustments.');
      }

      const nextRemaining = clampSeconds(restSnapshot.remainingSeconds + args.deltaSeconds, 15, 240);

      await ctx.db.patch(session._id, {
        activeProcess: {
          ...restProcess,
          isRunning: restSnapshot.isRunning,
          remainingSeconds: nextRemaining,
          startedAt: restSnapshot.isRunning ? Date.now() : null,
        },
      });

      return null;
    }

    if (args.durationSeconds === undefined) {
      throw new ConvexError('durationSeconds is required when setting a rest preset.');
    }

    const presetSeconds = clampSeconds(args.durationSeconds, 15, 240);
    await writeRestSecondsToCurrentSetLog(ctx, restProcess, presetSeconds);
    await ctx.db.patch(session._id, {
      activeProcess: {
        ...restProcess,
        durationSeconds: presetSeconds,
        isRunning: restSnapshot.isRunning,
        remainingSeconds: presetSeconds,
        startedAt: restSnapshot.isRunning ? Date.now() : null,
      },
    });

    return null;
  },
});

export const startLiveCardio = mutation({
  args: {
    sessionExerciseId: v.id('liveSessionExercises'),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);

    if (session.activeProcess) {
      throw new ConvexError('Finish the active runtime card before starting live cardio.');
    }

    const sessionExercise = await requireSessionExercise(ctx, session, profile._id, args.sessionExerciseId);
    const recipeDefinition = getRecipeDefinition(sessionExercise.recipeKey);

    if (recipeDefinition.processKind !== 'live_cardio') {
      throw new ConvexError('This exercise does not support live cardio tracking.');
    }
    if (!isLiveCardioRecipeKey(sessionExercise.recipeKey)) {
      throw new ConvexError('This exercise does not support live cardio tracking.');
    }

    const trackedFields = getLiveCardioTrackedFields(sessionExercise.recipeKey);
    if (trackedFields.length === 0) {
      throw new ConvexError('Live cardio tracking fields are not configured for this exercise.');
    }

    const now = Date.now();
    const initialMetrics = getRecipeInitialMetrics(sessionExercise.recipeKey);
    const trackedMetrics = Object.fromEntries(
      trackedFields.map(field => [field.key, initialMetrics[field.key] ?? field.defaultValue]),
    );

    await ctx.db.patch(session._id, {
      activeProcess: {
        elapsedSeconds: 0,
        isRunning: true,
        kind: 'live_cardio',
        lastResumedAt: now,
        recipeKey: sessionExercise.recipeKey,
        sessionExerciseId: sessionExercise._id,
        startedAt: now,
        trackedMetrics,
      },
      activeSessionExerciseId: sessionExercise._id,
    });

    return null;
  },
});

export const pauseLiveCardio = mutation({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);
    const liveProcess = requireLiveCardioProcess(session);

    if (!liveProcess.isRunning) {
      return null;
    }

    const elapsedSeconds = getLiveCardioElapsedSeconds(liveProcess);
    await ctx.db.patch(session._id, {
      activeProcess: {
        ...liveProcess,
        elapsedSeconds,
        isRunning: false,
        lastResumedAt: null,
      },
    });

    return null;
  },
});

export const resumeLiveCardio = mutation({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);
    const liveProcess = requireLiveCardioProcess(session);

    if (liveProcess.isRunning) {
      return null;
    }

    await ctx.db.patch(session._id, {
      activeProcess: {
        ...liveProcess,
        isRunning: true,
        lastResumedAt: Date.now(),
      },
    });

    return null;
  },
});

export const adjustLiveCardioMetric = mutation({
  args: {
    delta: v.number(),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);
    const liveProcess = requireLiveCardioProcess(session);
    const trackedFields = getLiveCardioTrackedFields(liveProcess.recipeKey);
    const targetField = trackedFields.find(field => field.key === args.key);

    if (!targetField) {
      throw new ConvexError('That metric is not adjustable in live tracking mode.');
    }

    const currentValue = liveProcess.trackedMetrics[args.key] ?? targetField.defaultValue;
    const min = targetField.min ?? targetField.pickerMin;
    const max = targetField.max ?? targetField.pickerMax;
    const nextValue = roundMetric(Math.max(min, Math.min(max, currentValue + args.delta)));

    await ctx.db.patch(session._id, {
      activeProcess: {
        ...liveProcess,
        trackedMetrics: {
          ...liveProcess.trackedMetrics,
          [args.key]: nextValue,
        },
      },
    });

    return null;
  },
});

export const finishLiveCardio = mutation({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);
    const liveProcess = requireLiveCardioProcess(session);
    const sessionExercise = await requireSessionExercise(ctx, session, profile._id, liveProcess.sessionExerciseId);
    const elapsedSeconds = getLiveCardioElapsedSeconds(liveProcess);
    const metrics = {
      ...liveProcess.trackedMetrics,
      duration: elapsedSeconds,
    };
    const normalizedMetrics = normalizeMetricsOrThrow(sessionExercise.recipeKey, metrics);
    const existingLogs = await ctx.db
      .query('liveSetLogs')
      .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', sessionExercise._id))
      .collect();
    const setNumber = existingLogs.length + 1;

    await ctx.db.insert('liveSetLogs', {
      loggedAt: Date.now(),
      metrics: normalizedMetrics,
      profileId: profile._id,
      recipeKey: sessionExercise.recipeKey,
      sessionExerciseId: sessionExercise._id,
      sessionId: session._id,
      setNumber,
      warmup: false,
    });

    await ctx.db.patch(session._id, {
      activeProcess: null,
      activeSessionExerciseId: sessionExercise._id,
    });

    return {
      nextSetNumber: setNumber + 1,
      summary: summarizeMetrics(sessionExercise.recipeKey, normalizedMetrics),
    };
  },
});

async function getActiveSession(ctx: QueryCtx | MutationCtx, profileId: Id<'profiles'>) {
  return (await ctx.db
    .query('liveSessions')
    .withIndex('by_profile_id_and_status', q => q.eq('profileId', profileId).eq('status', 'active'))
    .unique()) as ActiveSession | null;
}

async function requireActiveSession(ctx: MutationCtx | QueryCtx, profileId: Id<'profiles'>) {
  const session = await getActiveSession(ctx, profileId);

  if (!session) {
    throw new ConvexError('Start a session before using the workout logger.');
  }

  return session;
}

async function requireSessionExercise(
  ctx: MutationCtx,
  session: ActiveSession,
  profileId: Id<'profiles'>,
  sessionExerciseId: Id<'liveSessionExercises'>,
) {
  const sessionExercise = await ctx.db.get(sessionExerciseId);

  if (!sessionExercise || sessionExercise.profileId !== profileId || sessionExercise.sessionId !== session._id) {
    throw new ConvexError('That exercise is not part of the current session.');
  }

  if (!sessionExercise.recipeKey) {
    throw new ConvexError('This exercise does not support live logging yet.');
  }

  return sessionExercise as SessionExerciseWithRecipe;
}

function normalizeMetricsOrThrow(
  recipeKey: SessionExerciseWithRecipe['recipeKey'],
  metrics: Record<string, number>,
) {
  return validateRecipeMetrics(recipeKey, metrics);
}

async function buildEndedSessionSummary(ctx: QueryCtx, sessionId: Id<'liveSessions'>) {
  const sessionExercises = (await ctx.db
    .query('liveSessionExercises')
    .withIndex('by_session_id_and_position', q => q.eq('sessionId', sessionId))
    .collect()) as Doc<'liveSessionExercises'>[];

  const allLogs = await Promise.all(
    sessionExercises.map(sessionExercise =>
      ctx.db
        .query('liveSetLogs')
        .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', sessionExercise._id))
        .collect(),
    ),
  );

  const exercises = sessionExercises.map((sessionExercise, index) => {
    const logs = allLogs[index];
    const lastLog = logs.at(-1);
    return {
      exerciseName: sessionExercise.exerciseName,
      lastLoggedSummary: lastLog ? summarizeMetrics(lastLog.recipeKey, lastLog.metrics) : null,
      setCount: logs.length,
    };
  });

  return {
    exerciseCount: exercises.length,
    exercises,
  };
}

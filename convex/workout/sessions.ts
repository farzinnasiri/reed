import { ConvexError, v } from 'convex/values';
import { mutation, query } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { requireViewerProfile } from '../profiles';
import {
  requireLiveCardioProcess,
  requireRestProcess,
  writeRestSecondsToCurrentSetLog,
} from './processes';
import { getLiveCardioElapsedSeconds } from '../../domains/workout/liveCardio';
import { getRestSnapshot, clampSeconds } from '../../domains/workout/rest';
import {
  getLiveCardioTrackedFields,
  getRecipeDefinition,
  isLiveCardioRecipeKey,
  prepareLiveCardioInput,
  resolveCatalogRecipeKey,
  roundMetric,
  summarizeMetrics,
} from '../../domains/workout/recipes';
import {
  deleteLiveSessionSetActivity,
  insertLiveSessionSetActivity,
  normalizeSetMetrics,
  patchLiveSessionSetActivity,
  summarizeSetMetrics,
} from './setLogging';
import { buildCurrentLiveSessionState } from './sessionState';
import { setMetricsValidator } from './validators';

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
          .query('activityLogs')
          .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', sessionExercise._id))
          .collect(),
      ),
    );
    const logsByExercise = new Map<Id<'liveSessionExercises'>, Doc<'activityLogs'>[]>(
      sessionExercises.map((sessionExercise, index) => [sessionExercise._id, allLogs[index]]),
    );

    return buildCurrentLiveSessionState({
      logsByExercise,
      session,
      sessionExercises,
    });
  },
});

export const getLatestEndedSummary = query({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const endedSessions = await ctx.db
      .query('liveSessions')
      .withIndex('by_profile_id_and_status_and_started_at', q =>
        q.eq('profileId', profile._id).eq('status', 'ended'),
      )
      .order('desc')
      .take(20);

    if (endedSessions.length === 0) {
      return null;
    }

    for (const endedSession of endedSessions) {
      const summary = await buildEndedSessionSummary(ctx, endedSession._id);

      if (summary.exerciseCount === 0) {
        continue;
      }

      return {
        ...summary,
        endedAt: endedSession.endedAt ?? endedSession.startedAt,
        sessionId: endedSession._id,
        startedAt: endedSession.startedAt,
      };
    }

    return null;
  },
});

export const getEndedTimeline = query({
  args: { sessionId: v.id('liveSessions') },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.profileId !== profile._id || session.status !== 'ended') {
      return null;
    }

    const sessionExercises = (await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
      .collect()) as SessionExerciseWithRecipe[];
    const allLogs = await Promise.all(
      sessionExercises.map(sessionExercise =>
        ctx.db
          .query('activityLogs')
          .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', sessionExercise._id))
          .collect(),
      ),
    );
    const logsByExercise = new Map<Id<'liveSessionExercises'>, Doc<'activityLogs'>[]>(
      sessionExercises.map((sessionExercise, index) => [sessionExercise._id, allLogs[index]]),
    );
    const state = buildCurrentLiveSessionState({
      logsByExercise,
      session: { ...session, activeProcess: null, activeSessionExerciseId: undefined, status: 'active' },
      sessionExercises,
    });

    return {
      endedAt: session.endedAt ?? session.startedAt,
      exerciseCount: state.timeline.length,
      startedAt: session.startedAt,
      timeline: state.timeline.map(item => ({
        ...item,
        state: item.setCount > 0 ? 'logged' as const : 'idle' as const,
      })),
    };
  },
});

export const listEndedSummaries = query({
  args: {
    beforeStartedAt: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const limit = Math.max(1, Math.min(args.limit ?? 5, 12));
    const beforeStartedAt = args.beforeStartedAt ?? Date.now() + 1;
    const endedSessions = await ctx.db
      .query('liveSessions')
      .withIndex('by_profile_id_and_status_and_started_at', q =>
        q
          .eq('profileId', profile._id)
          .eq('status', 'ended')
          .lt('startedAt', beforeStartedAt),
      )
      .order('desc')
      .take(limit + 1);
    const pageSessions = endedSessions.slice(0, limit);
    const summaries = [];

    for (const endedSession of pageSessions) {
      const summary = await buildEndedSessionSummary(ctx, endedSession._id);
      if (summary.exerciseCount === 0) {
        continue;
      }
      summaries.push({
        ...summary,
        endedAt: endedSession.endedAt ?? endedSession.startedAt,
        sessionId: endedSession._id,
        startedAt: endedSession.startedAt,
      });
    }

    return {
      nextBeforeStartedAt: endedSessions.length > limit ? pageSessions.at(-1)?.startedAt ?? null : null,
      summaries,
    };
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
      .query('activityLogs')
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

export const reorderExercises = mutation({
  args: { orderedSessionExerciseIds: v.array(v.id('liveSessionExercises')) },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);
    const sessionExercises = (await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
      .collect()) as Doc<'liveSessionExercises'>[];

    if (sessionExercises.length !== args.orderedSessionExerciseIds.length) {
      throw new ConvexError('The timeline reorder payload is out of date.');
    }

    const sessionExerciseIds = new Set(sessionExercises.map(entry => entry._id));
    const orderedIds = new Set(args.orderedSessionExerciseIds);

    if (sessionExerciseIds.size !== orderedIds.size) {
      throw new ConvexError('The timeline reorder payload is invalid.');
    }

    for (const sessionExerciseId of args.orderedSessionExerciseIds) {
      if (!sessionExerciseIds.has(sessionExerciseId)) {
        throw new ConvexError('The timeline reorder payload references an unknown exercise.');
      }
    }

    const currentPositions = new Map(sessionExercises.map(entry => [entry._id, entry.position]));

    await Promise.all(
      args.orderedSessionExerciseIds.map((sessionExerciseId, index) => {
        const currentPosition = currentPositions.get(sessionExerciseId);
        if (currentPosition === index) {
          return Promise.resolve();
        }

        return ctx.db.patch(sessionExerciseId, { position: index });
      }),
    );

    return null;
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
        .query('activityLogs')
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

    if (!catalogExercise) {
      throw new ConvexError('This exercise is not available in the live session flow yet.');
    }

    const resolvedRecipeKey = resolveCatalogRecipeKey({
      exerciseClass: catalogExercise.exerciseClass,
      isCardio: catalogExercise.isCardio,
      isHold: catalogExercise.isHold,
      laterality: catalogExercise.laterality,
      rawMetricRecipe: catalogExercise.rawMetricRecipe,
      recipeKey: catalogExercise.recipeKey,
      supportsLiveTracking: catalogExercise.supportsLiveTracking,
    });

    if (!resolvedRecipeKey) {
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
      recipeKey: resolvedRecipeKey,
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

    if (session.activeProcess?.kind === 'live_cardio') {
      throw new ConvexError('Finish live cardio before logging another set.');
    }

    const sessionExercise = await requireSessionExercise(ctx, session, profile._id, args.sessionExerciseId);
    const recipeDefinition = getRecipeDefinition(sessionExercise.recipeKey);

    if (recipeDefinition.processKind === 'live_cardio') {
      throw new ConvexError('Use live cardio tracking for this exercise.');
    }

    const normalizedMetrics = normalizeSetMetrics(sessionExercise.recipeKey, args.metrics);
    const existingLogs = await ctx.db
      .query('activityLogs')
      .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', sessionExercise._id))
      .collect();
    const setNumber = existingLogs.length + 1;
    const shouldOpenRest = recipeDefinition.processKind === 'rest_after_log';
    const loggedAt = Date.now();

    await insertLiveSessionSetActivity(ctx, {
      loggedAt,
      metrics: normalizedMetrics,
      profileId: profile._id,
      restSeconds: shouldOpenRest ? DEFAULT_REST_SECONDS : undefined,
      sessionExercise,
      sessionId: session._id,
      setNumber,
      warmup: args.warmup,
    });

    await ctx.db.patch(session._id, {
      activeProcess: shouldOpenRest
        ? {
            durationSeconds: DEFAULT_REST_SECONDS,
            isRunning: true,
            kind: 'rest',
            nextSetNumber: setNumber + 1,
            remainingSeconds: DEFAULT_REST_SECONDS,
            sessionExerciseId: sessionExercise._id,
            startedAt: Date.now(),
          }
        : null,
      activeSessionExerciseId: sessionExercise._id,
    });

    return {
      enteredRest: shouldOpenRest,
      nextSetNumber: setNumber + 1,
      summary: summarizeSetMetrics(sessionExercise.recipeKey, normalizedMetrics),
    };
  },
});

export const updateSet = mutation({
  args: {
    metrics: setMetricsValidator,
    setLogId: v.id('activityLogs'),
    warmup: v.boolean(),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);

    if (session.activeProcess?.kind === 'live_cardio') {
      throw new ConvexError('Finish live cardio before editing sets.');
    }

    const setLog = await ctx.db.get(args.setLogId);

    if (!setLog || setLog.profileId !== profile._id || setLog.sessionId !== session._id || !setLog.sessionExerciseId) {
      throw new ConvexError('That set is not part of the current session.');
    }

    const sessionExercise = await requireSessionExercise(ctx, session, profile._id, setLog.sessionExerciseId);
    const normalizedMetrics = normalizeSetMetrics(sessionExercise.recipeKey, args.metrics);
    const loggedAt = Date.now();

    await patchLiveSessionSetActivity(ctx, {
      loggedAt,
      metrics: normalizedMetrics,
      profileId: profile._id,
      sessionExercise,
      setLogId: setLog._id,
      warmup: args.warmup,
    });

    await ctx.db.patch(session._id, {
      activeSessionExerciseId: sessionExercise._id,
    });

    return {
      setNumber: setLog.setNumber,
      summary: summarizeSetMetrics(sessionExercise.recipeKey, normalizedMetrics),
    };
  },
});

export const deleteSet = mutation({
  args: { setLogId: v.id('activityLogs') },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await requireActiveSession(ctx, profile._id);

    if (session.activeProcess?.kind === 'live_cardio') {
      throw new ConvexError('Finish live cardio before deleting sets.');
    }

    const setLog = await ctx.db.get(args.setLogId);

    if (!setLog || setLog.profileId !== profile._id || setLog.sessionId !== session._id || !setLog.sessionExerciseId) {
      throw new ConvexError('That set is not part of the current session.');
    }

    await requireSessionExercise(ctx, session, profile._id, setLog.sessionExerciseId);

    const result = await deleteLiveSessionSetActivity(ctx, {
      ...setLog,
      sessionExerciseId: setLog.sessionExerciseId,
    });

    await ctx.db.patch(session._id, {
      activeSessionExerciseId: result.sessionExerciseId,
    });

    return result;
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

    if (session.activeProcess?.kind === 'live_cardio') {
      throw new ConvexError('Finish live cardio before starting another live tracker.');
    }

    const sessionExercise = await requireSessionExercise(ctx, session, profile._id, args.sessionExerciseId);
    const recipeDefinition = getRecipeDefinition(sessionExercise.recipeKey);

    if (recipeDefinition.processKind !== 'live_cardio') {
      throw new ConvexError('This exercise does not support live cardio tracking.');
    }
    if (!isLiveCardioRecipeKey(sessionExercise.recipeKey)) {
      throw new ConvexError('This exercise does not support live cardio tracking.');
    }

    const liveCardioInput = prepareLiveCardioInput(sessionExercise.recipeKey);
    if (liveCardioInput.trackedFields.length === 0) {
      throw new ConvexError('Live cardio tracking fields are not configured for this exercise.');
    }

    const now = Date.now();

    await ctx.db.patch(session._id, {
      activeProcess: {
        elapsedSeconds: 0,
        isRunning: true,
        kind: 'live_cardio',
        lastResumedAt: now,
        recipeKey: sessionExercise.recipeKey,
        sessionExerciseId: sessionExercise._id,
        startedAt: now,
        trackedMetrics: liveCardioInput.trackedMetrics,
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
    const normalizedMetrics = normalizeSetMetrics(sessionExercise.recipeKey, metrics);
    const existingLogs = await ctx.db
      .query('activityLogs')
      .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', sessionExercise._id))
      .collect();
    const setNumber = existingLogs.length + 1;
    const loggedAt = Date.now();

    await insertLiveSessionSetActivity(ctx, {
      loggedAt,
      metrics: normalizedMetrics,
      profileId: profile._id,
      sessionExercise,
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
      summary: summarizeSetMetrics(sessionExercise.recipeKey, normalizedMetrics),
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

async function buildEndedSessionSummary(ctx: QueryCtx, sessionId: Id<'liveSessions'>) {
  const sessionExercises = (await ctx.db
    .query('liveSessionExercises')
    .withIndex('by_session_id_and_position', q => q.eq('sessionId', sessionId))
    .collect()) as Doc<'liveSessionExercises'>[];

  const allLogs = await Promise.all(
    sessionExercises.map(sessionExercise =>
      ctx.db
        .query('activityLogs')
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

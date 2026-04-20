import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';
import { getRestSnapshot, clampSeconds } from '../domains/workout/rest';
import {
  getRecipeFieldDefinitions,
  getRecipeInitialMetrics,
  summarizeMetrics,
  validateRecipeMetrics,
} from '../domains/workout/recipes';
import { setMetricsValidator } from './workoutValidators';

const DEFAULT_REST_SECONDS = 90;

type ActiveSession = Doc<'liveSessions'> & { status: 'active' };
type SessionExerciseWithRecipe = Doc<'liveSessionExercises'> & {
  recipeKey: NonNullable<Doc<'liveSessionExercises'>['recipeKey']>;
};
type RestProcess = NonNullable<Doc<'liveSessions'>['activeProcess']>;

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
      sessionExercises.map(se =>
        ctx.db
          .query('liveSetLogs')
          .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', se._id))
          .collect(),
      ),
    );
    const logsByExercise = new Map<Id<'liveSessionExercises'>, Doc<'liveSetLogs'>[]>(
      sessionExercises.map((se, i) => [se._id, allLogs[i]]),
    );

    const restProcess = session.activeProcess?.kind === 'rest' ? session.activeProcess : null;
    const requestedActiveSessionExerciseId =
      restProcess?.sessionExerciseId ?? session.activeSessionExerciseId ?? sessionExercises[0]?._id ?? null;
    const timeline = sessionExercises.map(sessionExercise => {
      const logs = logsByExercise.get(sessionExercise._id) ?? [];
      const lastLog = logs.at(-1);
      const state =
        restProcess?.sessionExerciseId === sessionExercise._id
          ? 'resting'
          : requestedActiveSessionExerciseId === sessionExercise._id
            ? 'active'
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
        activeCard: { capture: null, rest: null },
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
    const captureCard = {
      currentSetNumber: activeLogs.length + 1,
      exerciseName: activeSessionExercise.exerciseName,
      fields: getRecipeFieldDefinitions(activeSessionExercise.recipeKey),
      initialMetrics: getRecipeInitialMetrics(activeSessionExercise.recipeKey, previousSet?.metrics ?? null),
      previousMetrics: previousSet?.metrics ?? null,
      previousSetSummary: previousSet ? summarizeMetrics(previousSet.recipeKey, previousSet.metrics) : null,
      recipeKey: activeSessionExercise.recipeKey,
      sessionExerciseId: activeSessionExercise._id,
    };

    if (!restProcess || restProcess.sessionExerciseId !== activeSessionExercise._id) {
      return {
        activeCard: {
          capture: captureCard,
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
      session.activeProcess?.kind === 'rest' && session.activeProcess.sessionExerciseId === sessionExercise._id
        ? null
        : session.activeProcess;

    const patch: Partial<Doc<'liveSessions'>> = {
      activeProcess,
      activeSessionExerciseId: nextActiveSessionExerciseId,
    };

    await ctx.db.patch(session._id, patch);
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
        .withIndex('by_profile_id_and_logged_at', q => q.eq('profileId', profile._id))
        .collect();
      for (const log of orphanLogs) {
        if (log.sessionId === session._id) {
          await ctx.db.delete(log._id);
        }
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

    // Only update the active exercise pointer; never clear an in-flight rest
    // so that the rest timer keeps running in the background while the user
    // browses other exercises on the timeline.
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
      throw new ConvexError('Resolve the current rest card before logging another set.');
    }

    const sessionExercise = await requireSessionExercise(ctx, session, profile._id, args.sessionExerciseId);
    const normalizedMetrics = normalizeMetricsOrThrow(sessionExercise.recipeKey, args.metrics);
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
      restSeconds: DEFAULT_REST_SECONDS,
      sessionExerciseId: sessionExercise._id,
      sessionId: session._id,
      setNumber,
      warmup: args.warmup,
    });

    await ctx.db.patch(session._id, {
      activeProcess: {
        durationSeconds: DEFAULT_REST_SECONDS,
        isRunning: false,
        kind: 'rest',
        nextSetNumber: setNumber + 1,
        remainingSeconds: DEFAULT_REST_SECONDS,
        sessionExerciseId: sessionExercise._id,
        startedAt: null,
      },
      activeSessionExerciseId: sessionExercise._id,
    });

    return {
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
      throw new ConvexError('Finish the rest card before editing sets.');
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
      throw new ConvexError('Finish the rest card before deleting sets.');
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
      const nextRemaining = restSnapshot.remainingSeconds > 0 ? restSnapshot.remainingSeconds : restProcess.durationSeconds;

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

      // Preserve how much time has already elapsed; only adjust the remaining
      // seconds, NOT durationSeconds, so the preset highlight stays accurate.
      const nextRemaining = clampSeconds(restSnapshot.remainingSeconds + args.deltaSeconds, 15, 240);

      await ctx.db.patch(session._id, {
        activeProcess: {
          ...restProcess,
          remainingSeconds: nextRemaining,
          isRunning: restSnapshot.isRunning,
          // Reset startedAt so the server snapshot ticks from the new remaining
          startedAt: restSnapshot.isRunning ? Date.now() : null,
        },
      });

      return null;
    }

    if (args.durationSeconds === undefined) {
      throw new ConvexError('durationSeconds is required when setting a rest preset.');
    }

    const presetSeconds = clampSeconds(args.durationSeconds, 15, 240);
    await patchCurrentRestDuration(ctx, restProcess, presetSeconds);
    await ctx.db.patch(session._id, {
      activeProcess: {
        ...restProcess,
        durationSeconds: presetSeconds,
        remainingSeconds: presetSeconds,
        isRunning: restSnapshot.isRunning,
        startedAt: restSnapshot.isRunning ? Date.now() : null,
      },
    });

    return null;
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

function requireRestProcess(session: ActiveSession) {
  if (!session.activeProcess || session.activeProcess.kind !== 'rest') {
    throw new ConvexError('No active rest card.');
  }

  return session.activeProcess as RestProcess;
}

function normalizeMetricsOrThrow(recipeKey: SessionExerciseWithRecipe['recipeKey'], metrics: Record<string, number>) {
  return validateRecipeMetrics(recipeKey, metrics);
}

async function patchCurrentRestDuration(ctx: MutationCtx, restProcess: RestProcess, restSeconds: number) {
  const afterSetNumber = restProcess.nextSetNumber - 1;

  if (afterSetNumber < 1) {
    return;
  }

  const setLog = await ctx.db
    .query('liveSetLogs')
    .withIndex('by_session_exercise_id_and_set_number', q =>
      q.eq('sessionExerciseId', restProcess.sessionExerciseId).eq('setNumber', afterSetNumber),
    )
    .unique();

  if (!setLog) {
    return;
  }

  await ctx.db.patch(setLog._id, { restSeconds });
}

async function buildEndedSessionSummary(ctx: QueryCtx, sessionId: Id<'liveSessions'>) {
  const sessionExercises = (await ctx.db
    .query('liveSessionExercises')
    .withIndex('by_session_id_and_position', q => q.eq('sessionId', sessionId))
    .collect()) as Doc<'liveSessionExercises'>[];

  const allLogs = await Promise.all(
    sessionExercises.map(se =>
      ctx.db
        .query('liveSetLogs')
        .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', se._id))
        .collect(),
    ),
  );

  const exercises = sessionExercises.map((se, i) => {
    const logs = allLogs[i];
    const lastLog = logs.at(-1);
    return {
      exerciseName: se.exerciseName,
      lastLoggedSummary: lastLog ? summarizeMetrics(lastLog.recipeKey, lastLog.metrics) : null,
      setCount: logs.length,
    };
  });

  return {
    exerciseCount: exercises.length,
    exercises,
  };
}

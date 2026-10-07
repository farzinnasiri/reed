import { validateManualWorkoutDuration } from '../../domains/workout/session-duration';
import { saveSessionWhisper } from '../reedSessionWhispers';
import { patchSessionStructure } from './structure';
import { closeChapterForSession } from '../reedChapters';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from '../_generated/server';
import { internal } from '../_generated/api';
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
  normalizeSetOutcomeDetails,
  patchLiveSessionSetActivity,
  summarizeSetMetrics,
} from './setLogging';
import { buildCurrentLiveSessionState, getNextSessionSetNumber, getRequestedActiveSessionExerciseId, resolveCurrentSessionExercise } from './sessionState';
import { buildLiveSessionStatusStrip } from '../../domains/workout/session-insights';
import { setMetricsValidator, setOutcomeDetailsValidator } from './validators';

const DEFAULT_REST_SECONDS = 90;
const SESSION_NOTES_MAX_LENGTH = 2000;

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

    const allLogs = await ctx.db
      .query('activityLogs')
      .withIndex('by_session_id_and_set_number', q => q.eq('sessionId', session._id))
      .take(2000);
    const logsByExercise = new Map<Id<'liveSessionExercises'>, Doc<'activityLogs'>[]>();
    for (const sessionExercise of sessionExercises) {
      logsByExercise.set(sessionExercise._id, []);
    }
    for (const log of allLogs) {
      if (!log.sessionExerciseId) continue;
      logsByExercise.get(log.sessionExerciseId)?.push(log);
    }

    const catalogRows = await Promise.all(sessionExercises.map(entry => ctx.db.get(entry.exerciseCatalogId)));
    const statusStrip = buildLiveSessionStatusStrip({
      logs: allLogs.flatMap(log => log.sessionExerciseId ? [{
        derivedBodyweightKg: log.derivedBodyweightKg ?? null,
        derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
        loggedAt: log.loggedAt,
        metrics: log.metrics,
        recipeKey: log.recipeKey,
        restSeconds: log.restSeconds ?? null,
        sessionExerciseId: log.sessionExerciseId as string,
        setOutcome: log.setOutcomeDetails ?? null,
        setLogId: log._id as string,
        setNumber: log.setNumber,
        warmup: log.warmup,
      }] : []),
      now: Date.now(),
      sessionExercises: sessionExercises.flatMap((entry, index) => {
        const catalog = catalogRows[index];
        if (!catalog) return [];
        return [{
          exerciseCatalogId: entry.exerciseCatalogId as string,
          exerciseClass: catalog.exerciseClass,
          exerciseName: entry.exerciseName,
          isCardio: catalog.isCardio,
          isHold: catalog.isHold,
          mainMuscleGroups: catalog.mainMuscleGroups,
          movementPatterns: catalog.movementPatterns,
          recipeKey: entry.recipeKey,
          sessionExerciseId: entry._id as string,
          setup: entry.setupModifiers ?? null,
        }];
      }),
      sessionStartedAt: session.startedAt,
      durationMs: session.manualDurationSeconds === undefined ? undefined : session.manualDurationSeconds * 1000,
    });
    const state = buildCurrentLiveSessionState({
      logsByExercise,
      session,
      sessionExercises,
    });
    return { ...state, statusStrip };
  },
});

export const getActiveStatus = query({
  args: {},
  returns: v.union(v.null(), v.object({
    sessionId: v.id('liveSessions'),
    startedAt: v.number(),
    manualDurationSeconds: v.optional(v.number()),
    currentExerciseName: v.union(v.string(), v.null()),
    currentSetNumber: v.union(v.number(), v.null()),
  })),
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const session = await getActiveSession(ctx, profile._id);
    if (!session) return null;

    const firstExercise = await ctx.db.query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id)).first();
    const requestedId = getRequestedActiveSessionExerciseId(session, firstExercise?._id ?? null);
    const requestedExercise = requestedId && requestedId !== firstExercise?._id ? await ctx.db.get(requestedId) : null;
    const exercise = resolveCurrentSessionExercise(session, [
      ...(firstExercise ? [firstExercise] : []),
      ...(requestedExercise?.sessionId === session._id ? [requestedExercise] : []),
    ]);
    const logs = exercise ? await ctx.db.query('activityLogs')
      .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', exercise._id))
      .take(2001) : [];

    return {
      sessionId: session._id,
      startedAt: session.startedAt,
      manualDurationSeconds: session.manualDurationSeconds,
      currentExerciseName: exercise?.exerciseName ?? null,
      // Keep the always-visible status usable when corrupt/imported data
      // exceeds the capture limit, without presenting a truncated count.
      currentSetNumber: exercise && logs.length <= 2000 ? getNextSessionSetNumber(logs) : null,
    };
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
        manualDurationSeconds: endedSession.manualDurationSeconds,
        userNotes: endedSession.userNotes ?? '',
        userNotesUpdatedAt: endedSession.userNotesUpdatedAt ?? null,
      };
    }

    return null;
  },
});

export const setSessionDuration = mutation({
  args: { sessionId: v.id('liveSessions'), durationSeconds: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.profileId !== profile._id) throw new ConvexError('Session not found.');
    let duration: number | null;
    try { duration = validateManualWorkoutDuration(args.durationSeconds); }
    catch { throw new ConvexError('Enter a duration between one second and 24 hours.'); }
    await ctx.db.patch(session._id, { manualDurationSeconds: duration ?? undefined });
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
      manualDurationSeconds: session.manualDurationSeconds,
      timeline: state.timeline.map(item => ({
        ...item,
        state: item.setCount > 0 ? 'logged' as const : 'idle' as const,
      })),
      userNotes: session.userNotes ?? '',
      userNotesUpdatedAt: session.userNotesUpdatedAt ?? null,
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
        manualDurationSeconds: endedSession.manualDurationSeconds,
        userNotes: endedSession.userNotes ?? '',
        userNotesUpdatedAt: endedSession.userNotesUpdatedAt ?? null,
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

    await patchSessionStructure(ctx, session, {
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

    if (args.orderedSessionExerciseIds.some((id, index) => currentPositions.get(id) !== index)) {
      await patchSessionStructure(ctx, session, {});
    }
    return null;
  },
});

export const updateSessionNotes = mutation({
  args: {
    notes: v.string(),
    sessionId: v.id('liveSessions'),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await ctx.db.get(args.sessionId);

    if (!session || session.profileId !== profile._id) {
      throw new ConvexError('Session not found.');
    }

    const notes = args.notes.trim();
    if (notes.length > SESSION_NOTES_MAX_LENGTH) {
      throw new ConvexError(`Session notes must be ${SESSION_NOTES_MAX_LENGTH} characters or fewer.`);
    }

    await ctx.db.patch(session._id, {
      userNotes: notes || undefined,
      userNotesUpdatedAt: notes ? Date.now() : undefined,
    });

    await ctx.scheduler.runAfter(0, internal.reedJourney.rebuildLatest, {
      profileId: profile._id,
      trigger: 'session_notes_updated',
    });

    return { notes };
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

    await closeChapterForSession(ctx, profile._id, sessionId, Date.now(), 'session_started');
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

    const firstPerformedLog = session.sourcePlannedSessionId
      ? await ctx.db.query('activityLogs')
        .withIndex('by_session_id_and_set_number', q => q.eq('sessionId', session._id)).first()
      : null;
    if (sessionExercises.length === 0 || (session.sourcePlannedSessionId && !firstPerformedLog)) {
      for (const exercise of sessionExercises) await ctx.db.delete(exercise._id);
      if (session.sourcePlannedSessionId) {
        const plan = await ctx.db.get(session.sourcePlannedSessionId);
        if (plan?.liveSessionId === session._id) {
          await ctx.db.patch(plan._id, {
            // Leaving an unlogged plan puts it back in the queue. Dismissal is a separate action.
            liveSessionId: undefined, status: 'ready', updatedAt: Date.now(),
          });
        }
      }
      // Defensive: delete any orphan set logs that may have been created
      // through a race before the exercise row was removed.
      const orphanLogs = await ctx.db
        .query('activityLogs')
        .withIndex('by_session_id_and_set_number', q => q.eq('sessionId', session._id))
        .collect();
      for (const log of orphanLogs) {
        await ctx.db.delete(log._id);
      }
      await closeChapterForSession(ctx, profile._id, session._id, Date.now(), 'session_ended');
      await ctx.db.delete(session._id);
      return { deletedEmptySession: true };
    }

    const endedAt = Date.now();
    await closeChapterForSession(ctx, profile._id, session._id, endedAt, 'session_ended');
    await patchSessionStructure(ctx, session, {
      activeProcess: null,
      endedAt,
      status: 'ended',
    });

    await ctx.scheduler.runAfter(0, internal.reedJourney.rebuildLatest, {
      profileId: profile._id,
      trigger: 'session_ended',
    });
    await ctx.scheduler.runAfter(0, internal.profileInsight.markStale, {
      profileId: profile._id,
      reason: 'session_ended',
    });
    await ctx.scheduler.runAfter(2 * 60 * 1000, internal.sessionFeedbackAgent.reviewEndedSession, {
      sessionId: session._id,
    });

    return { deletedEmptySession: false };
  },
});

export const addExercise = mutation({
  args: { exerciseCatalogId: v.id('exerciseCatalog') },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await getOrCreateActiveSession(ctx, profile._id);
    const existingEntries = await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
      .collect();
    const sessionExerciseId = await insertSessionExercise({
      ctx,
      exerciseCatalogId: args.exerciseCatalogId,
      position: existingEntries.length,
      profileId: profile._id,
      sessionId: session._id,
    });

    if (!session.activeSessionExerciseId) {
      await patchSessionStructure(ctx, session, { activeSessionExerciseId: sessionExerciseId });
    }

    return { sessionExerciseId };
  },
});

export const addExercises = mutation({
  args: { exerciseCatalogIds: v.array(v.id('exerciseCatalog')) },
  handler: async (ctx, args) => {
    if (args.exerciseCatalogIds.length === 0) {
      return { sessionExerciseIds: [] as Id<'liveSessionExercises'>[] };
    }

    const profile = await requireViewerProfile(ctx);
    const session = await getOrCreateActiveSession(ctx, profile._id);
    const existingEntries = await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
      .collect();
    const sessionExerciseIds: Id<'liveSessionExercises'>[] = [];

    for (const [index, exerciseCatalogId] of args.exerciseCatalogIds.entries()) {
      const sessionExerciseId = await insertSessionExercise({
        ctx,
        exerciseCatalogId,
        position: existingEntries.length + index,
        profileId: profile._id,
        sessionId: session._id,
      });
      sessionExerciseIds.push(sessionExerciseId);
    }

    if (!session.activeSessionExerciseId && sessionExerciseIds[0]) {
      await patchSessionStructure(ctx, session, { activeSessionExerciseId: sessionExerciseIds[0] });
    }

    return { sessionExerciseIds };
  },
});

async function insertSessionExercise({
  ctx,
  exerciseCatalogId,
  position,
  profileId,
  sessionId,
}: {
  ctx: MutationCtx;
  exerciseCatalogId: Id<'exerciseCatalog'>;
  position: number;
  profileId: Id<'profiles'>;
  sessionId: Id<'liveSessions'>;
}) {
  const catalogExercise = await ctx.db.get(exerciseCatalogId);

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

  const id = await ctx.db.insert('liveSessionExercises', {
    addedAt: Date.now(),
    defaultSummaryFormat: catalogExercise.defaultSummaryFormat,
    exerciseCatalogId: catalogExercise._id,
    exerciseClass: catalogExercise.exerciseClass,
    exerciseName: catalogExercise.name,
    modifierCapabilities: catalogExercise.modifierCapabilities,
    position,
    profileId,
    recipeKey: resolvedRecipeKey,
    sessionId,
  });
  await closeChapterForSession(ctx, profileId, sessionId, Date.now(), 'session_started');
  const session = await ctx.db.get(sessionId);
  if (session) await patchSessionStructure(ctx, session, {});
  return id;
}

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

    await patchSessionStructure(ctx, session, {
      activeSessionExerciseId: sessionExercise._id,
    });
    return null;
  },
});

export const logSet = mutation({
  args: {
    metrics: setMetricsValidator,
    setOutcomeDetails: v.optional(setOutcomeDetailsValidator),
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
    const normalizedSetOutcomeDetails = normalizeSetOutcomeDetails(sessionExercise, args.setOutcomeDetails);
    const existingLogs = await ctx.db
      .query('activityLogs')
      .withIndex('by_session_exercise_id_and_set_number', q => q.eq('sessionExerciseId', sessionExercise._id))
      .collect();
    const setNumber = existingLogs.length + 1;
    const shouldOpenRest = recipeDefinition.processKind === 'rest_after_log';
    const loggedAt = Date.now();
    const restSeconds = sessionExercise.targetDefaults?.[existingLogs.length]?.restSeconds ?? DEFAULT_REST_SECONDS;

    await patchAssistanceSetupFromMetrics(ctx, sessionExercise, normalizedMetrics);

    const setLogId = await insertLiveSessionSetActivity(ctx, {
      loggedAt,
      metrics: normalizedMetrics,
      profileId: profile._id,
      restSeconds: shouldOpenRest ? restSeconds : undefined,
      sessionExercise,
      setOutcomeDetails: normalizedSetOutcomeDetails,
      sessionId: session._id,
      setNumber,
      warmup: args.warmup,
    });

    const committedLog = await ctx.db.get(setLogId);
    if (committedLog) await saveSessionWhisper(ctx, committedLog, sessionExercise, session, existingLogs);

    await patchSessionStructure(ctx, session, {
      activeProcess: shouldOpenRest
        ? {
            durationSeconds: restSeconds,
            isRunning: true,
            kind: 'rest',
            nextSetNumber: setNumber + 1,
            remainingSeconds: restSeconds,
            sessionExerciseId: sessionExercise._id,
            startedAt: Date.now(),
          }
        : null,
      activeSessionExerciseId: sessionExercise._id,
    });

    return {
      setLogId,
      loggedAt,
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
    setOutcomeDetails: v.optional(setOutcomeDetailsValidator),
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
    const normalizedSetOutcomeDetails = normalizeSetOutcomeDetails(sessionExercise, args.setOutcomeDetails);
    const loggedAt = Date.now();

    await patchAssistanceSetupFromMetrics(ctx, sessionExercise, normalizedMetrics);

    await patchLiveSessionSetActivity(ctx, {
      loggedAt,
      metrics: normalizedMetrics,
      profileId: profile._id,
      sessionExercise,
      setLogId: setLog._id,
      setOutcomeDetails: normalizedSetOutcomeDetails,
      warmup: args.warmup,
    });

    await patchSessionStructure(ctx, session, {
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

    await patchSessionStructure(ctx, session, {
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

    await patchSessionStructure(ctx, session, {
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

      await patchSessionStructure(ctx, session, {
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

      await patchSessionStructure(ctx, session, {
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
    await patchSessionStructure(ctx, session, {
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

    await patchSessionStructure(ctx, session, {
      activeProcess: {
        elapsedSeconds: 0,
        isRunning: true,
        kind: 'live_cardio',
        lastResumedAt: now,
        recipeKey: sessionExercise.recipeKey,
        sessionExerciseId: sessionExercise._id,
        startedAt: now,
        trackedMetrics: Object.fromEntries(liveCardioInput.trackedFields.map(field => [
          field.key,
          sessionExercise.targetDefaults?.[0]?.metrics[field.key] ?? liveCardioInput.trackedMetrics[field.key],
        ])),
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
    await patchSessionStructure(ctx, session, {
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

    await patchSessionStructure(ctx, session, {
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

    await patchSessionStructure(ctx, session, {
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

    await patchSessionStructure(ctx, session, {
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

async function getOrCreateActiveSession(ctx: MutationCtx, profileId: Id<'profiles'>) {
  const existing = await getActiveSession(ctx, profileId);

  if (existing) {
    return existing;
  }

  const sessionId = await ctx.db.insert('liveSessions', {
    activeProcess: null,
    profileId,
    startedAt: Date.now(),
    status: 'active',
  });
  await closeChapterForSession(ctx, profileId, sessionId, Date.now(), 'session_started');
  const session = await ctx.db.get(sessionId);

  if (!session || session.status !== 'active') {
    throw new ConvexError('Could not create a session.');
  }

  return session as ActiveSession;
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

async function patchAssistanceSetupFromMetrics(
  ctx: MutationCtx,
  sessionExercise: SessionExerciseWithRecipe,
  metrics: Record<string, number>,
) {
  if (sessionExercise.recipeKey !== 'assist_bodyweight') {
    return;
  }

  if (!sessionExercise.modifierCapabilities?.setup.includes('assistanceSupport')) {
    return;
  }

  const assistanceSupportKg = metrics.assistLoad;
  if (typeof assistanceSupportKg !== 'number' || !Number.isFinite(assistanceSupportKg) || assistanceSupportKg < 0) {
    return;
  }

  await ctx.db.patch(sessionExercise._id, {
    setupModifiers: {
      ...(sessionExercise.setupModifiers ?? {}),
      assistanceSupportKg,
    },
  });
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

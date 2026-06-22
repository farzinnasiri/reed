import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
import type { Doc } from './_generated/dataModel';

const HISTORY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const RECENT_SESSION_LIMIT = 8;

export const snapshot = internalQuery({
  args: { sessionId: v.id('liveSessions') },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== 'ended') return null;

    const [profile, trainingProfile, sessionExercises, logs, journey] = await Promise.all([
      ctx.db.get(session.profileId),
      ctx.db.query('trainingProfiles').withIndex('by_profile_id', q => q.eq('profileId', session.profileId)).unique(),
      ctx.db
        .query('liveSessionExercises')
        .withIndex('by_session_id_and_position', q => q.eq('sessionId', session._id))
        .collect(),
      ctx.db
        .query('activityLogs')
        .withIndex('by_session_id_and_set_number', q => q.eq('sessionId', session._id))
        .collect(),
      ctx.db
        .query('reedJourneySnapshots')
        .withIndex('by_profile_id_and_created_at', q => q.eq('profileId', session.profileId))
        .order('desc')
        .first(),
    ]);

    if (!profile || logs.length === 0) return null;

    const historyStart = (session.endedAt ?? Date.now()) - HISTORY_WINDOW_MS;
    const recentSessions = await ctx.db
      .query('liveSessions')
      .withIndex('by_profile_id_and_status_and_started_at', q =>
        q.eq('profileId', session.profileId).eq('status', 'ended').gte('startedAt', historyStart),
      )
      .order('desc')
      .take(RECENT_SESSION_LIMIT + 1);

    const logsByExerciseId = groupLogsBySessionExercise(logs);

    return {
      journeyContext: journey?.renderedContext ?? null,
      profile: {
        displayName: profile.displayName ?? null,
        onboardingCompletedAt: profile.onboardingCompletedAt ?? null,
      },
      profileId: session.profileId,
      recentSessions: recentSessions
        .filter(recent => recent._id !== session._id)
        .slice(0, RECENT_SESSION_LIMIT)
        .map(recent => ({
          durationMinutes: durationMinutes(recent),
          endedAt: recent.endedAt ?? null,
          startedAt: recent.startedAt,
          userNotes: recent.userNotes ?? null,
        })),
      session: {
        durationMinutes: durationMinutes(session),
        endedAt: session.endedAt ?? null,
        exerciseCount: sessionExercises.length,
        exercises: sessionExercises.map(exercise => {
          const exerciseLogs = logsByExerciseId.get(exercise._id) ?? [];
          return {
            exerciseClass: exercise.exerciseClass,
            exerciseName: exercise.exerciseName,
            position: exercise.position,
            recipeKey: exercise.recipeKey,
            setCount: exerciseLogs.length,
            sets: exerciseLogs.map(log => ({
              effectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
              loggedAt: log.loggedAt,
              metrics: log.metrics,
              setNumber: log.setNumber,
              warmup: log.warmup,
            })),
          };
        }),
        loggedSetCount: logs.length,
        startedAt: session.startedAt,
        totalEffectiveLoadKg: Math.round(logs.reduce((total, log) => {
          const reps = typeof log.metrics.reps === 'number' ? log.metrics.reps : 1;
          return total + (log.derivedEffectiveLoadKg ?? 0) * reps;
        }, 0)),
        userNotes: session.userNotes ?? null,
      },
      trainingProfile,
    };
  },
});

function groupLogsBySessionExercise(logs: Doc<'activityLogs'>[]) {
  const groups = new Map<string, Doc<'activityLogs'>[]>();
  for (const log of logs) {
    if (!log.sessionExerciseId) continue;
    const key = log.sessionExerciseId;
    const existing = groups.get(key) ?? [];
    existing.push(log);
    groups.set(key, existing);
  }
  return groups;
}

function durationMinutes(session: Doc<'liveSessions'>) {
  if (!session.endedAt) return null;
  return Math.max(1, Math.round((session.endedAt - session.startedAt) / 60_000));
}

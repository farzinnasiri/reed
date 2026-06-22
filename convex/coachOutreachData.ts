import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
import type { Doc } from './_generated/dataModel';

const HISTORY_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
const SESSION_LIMIT = 12;
const TARGET_LIMIT = 8;

export const snapshot = internalQuery({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    const now = Date.now();
    const historyStart = now - HISTORY_WINDOW_MS;
    const [profile, trainingProfile, journey, sessions, targets, recentOutbound] = await Promise.all([
      ctx.db.get(args.profileId),
      ctx.db.query('trainingProfiles').withIndex('by_profile_id', q => q.eq('profileId', args.profileId)).unique(),
      ctx.db
        .query('reedJourneySnapshots')
        .withIndex('by_profile_id_and_created_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .first(),
      ctx.db
        .query('liveSessions')
        .withIndex('by_profile_id_and_status_and_started_at', q =>
          q.eq('profileId', args.profileId).eq('status', 'ended').gte('startedAt', historyStart),
        )
        .order('desc')
        .take(SESSION_LIMIT),
      ctx.db
        .query('trainingTargets')
        .withIndex('by_profile_id_and_status', q => q.eq('profileId', args.profileId).eq('status', 'active'))
        .take(TARGET_LIMIT),
      ctx.db
        .query('outboundMessages')
        .withIndex('by_profile_id_and_created_at', q => q.eq('profileId', args.profileId))
        .order('desc')
        .take(5),
    ]);
    if (!profile) return null;

    return {
      journeyContext: journey?.renderedContext ?? null,
      now,
      profile: {
        displayName: profile.displayName ?? null,
        onboardingCompletedAt: profile.onboardingCompletedAt ?? null,
      },
      profileId: args.profileId,
      recentCoachOutreach: recentOutbound
        .filter(message => message.source === 'coach_outreach_agent')
        .map(message => ({
          createdAt: message.createdAt,
          kind: message.kind,
          scheduledFor: message.scheduledFor,
          status: message.status,
        })),
      sessions: sessions.map(sessionSummary),
      targets: targets.map(target => ({
        endsAt: target.endsAt,
        previewText: target.previewText,
        progressSummary: target.progressSummary,
        title: target.title,
      })),
      trainingProfile,
      windowDays: Math.round(HISTORY_WINDOW_MS / (24 * 60 * 60 * 1000)),
    };
  },
});

function sessionSummary(session: Doc<'liveSessions'>) {
  return {
    durationMinutes: session.endedAt ? Math.max(1, Math.round((session.endedAt - session.startedAt) / 60_000)) : null,
    endedAt: session.endedAt ?? null,
    startedAt: session.startedAt,
    userNotes: session.userNotes ?? null,
  };
}

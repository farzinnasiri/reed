import { getConsistencyWindow, summarizeConsistency } from '../domains/trainingKnowledge/consistency';
import { query } from './_generated/server';
import { requireViewerProfile } from './profiles';

// Deprecated module shim.
// Keep this public function for compatibility while consistency lives in
// trainingKnowledge.
export const viewerConsistency = query({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const trainingProfile = await ctx.db
      .query('trainingProfiles')
      .withIndex('by_profile_id', q => q.eq('profileId', profile._id))
      .unique();
    const now = Date.now();
    const { gridEndAt, gridStartAt } = getConsistencyWindow(now);

    const logs = await ctx.db
      .query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q =>
        q.eq('profileId', profile._id).gte('loggedAt', gridStartAt).lt('loggedAt', Math.min(now + 1, gridEndAt)),
      )
      .collect();

    return summarizeConsistency({
      loggedAts: logs.map(log => log.loggedAt),
      now,
      weeklySessions: trainingProfile?.trainingReality.weeklySessions ?? null,
    });
  },
});

import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { validProfileTimeZone } from './profileTimeZone';

export const backfillProfileTimeZone = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ cursor: v.string(), isDone: v.boolean(), scanned: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query('profiles').paginate({ cursor: args.cursor, numItems: 100 });
    let updated = 0;
    for (const profile of page.page) {
      if (profile.timeZone !== undefined) continue;
      const preferences = await ctx.db.query('notificationPreferences')
        .withIndex('by_profile_id', q => q.eq('profileId', profile._id)).unique();
      const timeZone = validProfileTimeZone(preferences?.timeZone);
      if (!timeZone) continue;
      // This only materialises the existing resolved zone. No timestamps or
      // derived calendars change until a client reports a different zone.
      await ctx.db.patch(profile._id, { timeZone });
      updated += 1;
    }
    return { cursor: page.continueCursor, isDone: page.isDone, scanned: page.page.length, updated };
  },
});

import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireViewerProfile } from './profiles';
import {
  assertOptionalClockTime,
  assertOptionalTimeZone,
  parseClockMinutes,
  type NotificationKind,
} from './notificationTypes';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

export function defaultNotificationPreferences(profileId: Id<'profiles'>, now: number) {
  return {
    coachCatchups: true,
    digests: true,
    enabled: true,
    maxPerDay: 3,
    minGapMinutes: 120,
    profileId,
    reminders: true,
    rewards: true,
    updatedAt: now,
  };
}

export async function getOrCreateNotificationPreferences(ctx: MutationCtx, profileId: Id<'profiles'>, now: number) {
  const existing = await ctx.db
    .query('notificationPreferences')
    .withIndex('by_profile_id', q => q.eq('profileId', profileId))
    .unique();

  if (existing) return existing;

  const id = await ctx.db.insert('notificationPreferences', defaultNotificationPreferences(profileId, now));
  return await ctx.db.get(id);
}

export function isNotificationKindEnabled(
  preferences: {
    coachCatchups: boolean;
    digests: boolean;
    reminders: boolean;
    rewards: boolean;
  },
  kind: NotificationKind,
) {
  if (kind === 'coach_catchup') return preferences.coachCatchups;
  if (kind === 'digest') return preferences.digests;
  if (kind === 'reminder') return preferences.reminders;
  if (kind === 'reward') return preferences.rewards;
  return true;
}

export function isInsideNotificationQuietHours(now: number, preferences: {
  quietHoursEnd?: string;
  quietHoursStart?: string;
  timeZone?: string;
}) {
  const start = parseClockMinutes(preferences.quietHoursStart);
  const end = parseClockMinutes(preferences.quietHoursEnd);
  if (start === null || end === null || start === end) return false;

  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: preferences.timeZone ?? 'UTC',
  });
  const parts = formatter.formatToParts(new Date(now));
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? '0');
  const current = hour * 60 + minute;

  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export const viewerPreferences = query({
  args: {},
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    return await ctx.db
      .query('notificationPreferences')
      .withIndex('by_profile_id', q => q.eq('profileId', profile._id))
      .unique();
  },
});

export const updatePreferences = mutation({
  args: {
    coachCatchups: v.optional(v.boolean()),
    digests: v.optional(v.boolean()),
    enabled: v.optional(v.boolean()),
    maxPerDay: v.optional(v.number()),
    minGapMinutes: v.optional(v.number()),
    quietHoursEnd: v.optional(v.union(v.string(), v.null())),
    quietHoursStart: v.optional(v.union(v.string(), v.null())),
    reminders: v.optional(v.boolean()),
    rewards: v.optional(v.boolean()),
    timeZone: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const now = Date.now();
    const existing = await getOrCreateNotificationPreferences(ctx, profile._id, now);
    if (!existing) throw new ConvexError('Notification preferences could not be created.');
    assertOptionalClockTime(args.quietHoursStart, 'Quiet hours start');
    assertOptionalClockTime(args.quietHoursEnd, 'Quiet hours end');
    assertOptionalTimeZone(args.timeZone);

    await ctx.db.patch(existing._id, {
      coachCatchups: args.coachCatchups ?? existing.coachCatchups,
      digests: args.digests ?? existing.digests,
      enabled: args.enabled ?? existing.enabled,
      maxPerDay: args.maxPerDay === undefined ? existing.maxPerDay : Math.min(Math.max(Math.round(args.maxPerDay), 0), 20),
      minGapMinutes: args.minGapMinutes === undefined ? existing.minGapMinutes : Math.min(Math.max(Math.round(args.minGapMinutes), 0), 24 * 60),
      quietHoursEnd: args.quietHoursEnd === undefined ? existing.quietHoursEnd : args.quietHoursEnd ?? undefined,
      quietHoursStart: args.quietHoursStart === undefined ? existing.quietHoursStart : args.quietHoursStart ?? undefined,
      reminders: args.reminders ?? existing.reminders,
      rewards: args.rewards ?? existing.rewards,
      timeZone: args.timeZone === undefined ? existing.timeZone : args.timeZone ?? undefined,
      updatedAt: now,
    });

    return null;
  },
});

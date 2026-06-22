import { ConvexError, v } from 'convex/values';
import { internalMutation } from './_generated/server';
import {
  assertNotificationCopy,
  MAX_SEND_BATCH_SIZE,
  notificationDataValidator,
  notificationKindValidator,
  notificationPriorityValidator,
  type ClaimedNotificationIntent,
} from './notificationTypes';
import {
  getOrCreateNotificationPreferences,
  isInsideNotificationQuietHours,
  isNotificationKindEnabled,
} from './notificationPreferences';

export const enqueueIntent = internalMutation({
  args: {
    body: v.string(),
    createdBy: v.string(),
    data: v.optional(notificationDataValidator),
    dedupeKey: v.string(),
    expiresAt: v.optional(v.number()),
    kind: notificationKindValidator,
    priority: notificationPriorityValidator,
    profileId: v.id('profiles'),
    scheduledFor: v.number(),
    title: v.string(),
  },
  returns: v.id('notificationIntents'),
  handler: async (ctx, args) => {
    assertNotificationCopy(args.title, args.body);
    if (!args.dedupeKey.trim()) throw new ConvexError('Notification dedupe key is required.');
    if (args.expiresAt !== undefined && args.expiresAt <= args.scheduledFor) {
      throw new ConvexError('Notification expiry must be after the scheduled time.');
    }

    const now = Date.now();
    const existing = await ctx.db
      .query('notificationIntents')
      .withIndex('by_profile_id_and_dedupe_key', q =>
        q.eq('profileId', args.profileId).eq('dedupeKey', args.dedupeKey),
      )
      .first();

    const patch = {
      body: args.body.trim(),
      createdBy: args.createdBy,
      data: args.data ?? {},
      expiresAt: args.expiresAt,
      failureReason: undefined,
      kind: args.kind,
      lastAttemptAt: undefined,
      priority: args.priority,
      scheduledFor: args.scheduledFor,
      skipReason: undefined,
      status: 'pending' as const,
      title: args.title.trim(),
      updatedAt: now,
    };

    if (existing && (existing.status === 'pending' || existing.status === 'failed' || existing.status === 'skipped')) {
      await ctx.db.patch(existing._id, {
        ...patch,
        attemptCount: 0,
      });
      return existing._id;
    }

    return await ctx.db.insert('notificationIntents', {
      ...patch,
      attemptCount: 0,
      createdAt: now,
      dedupeKey: args.dedupeKey,
      profileId: args.profileId,
    });
  },
});

export const cancelIntent = internalMutation({
  args: {
    dedupeKey: v.string(),
    profileId: v.id('profiles'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.db
      .query('notificationIntents')
      .withIndex('by_profile_id_and_dedupe_key', q =>
        q.eq('profileId', args.profileId).eq('dedupeKey', args.dedupeKey),
      )
      .first();

    if (intent && intent.status === 'pending') {
      await ctx.db.patch(intent._id, {
        status: 'cancelled',
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

export const claimDueIntents = internalMutation({
  args: {
    now: v.number(),
  },
  returns: v.array(v.object({
    body: v.string(),
    data: notificationDataValidator,
    devices: v.array(v.object({
      _id: v.id('notificationDevices'),
      expoPushToken: v.string(),
    })),
    intentId: v.id('notificationIntents'),
    title: v.string(),
  })),
  handler: async (ctx, args) => {
    const intents = await ctx.db
      .query('notificationIntents')
      .withIndex('by_status_and_scheduled_for', q =>
        q.eq('status', 'pending').lte('scheduledFor', args.now),
      )
      .take(MAX_SEND_BATCH_SIZE);
    const claimed: ClaimedNotificationIntent[] = [];

    for (const intent of intents) {
      if (intent.expiresAt !== undefined && intent.expiresAt <= args.now) {
        await ctx.db.patch(intent._id, {
          skipReason: 'expired',
          status: 'skipped',
          updatedAt: args.now,
        });
        continue;
      }

      const preferences = await getOrCreateNotificationPreferences(ctx, intent.profileId, args.now);
      if (!preferences || !preferences.enabled || !isNotificationKindEnabled(preferences, intent.kind)) {
        await ctx.db.patch(intent._id, {
          skipReason: 'preferences_disabled',
          status: 'skipped',
          updatedAt: args.now,
        });
        continue;
      }

      if (isInsideNotificationQuietHours(args.now, preferences)) {
        await ctx.db.patch(intent._id, {
          scheduledFor: args.now + 30 * 60 * 1000,
          updatedAt: args.now,
        });
        continue;
      }

      const recentDeliveries = await ctx.db
        .query('notificationDeliveries')
        .withIndex('by_profile_id_and_status_and_sent_at', q =>
          q
            .eq('profileId', intent.profileId)
            .eq('status', 'ticket_ok')
            .gte('sentAt', args.now - 24 * 60 * 60 * 1000),
        )
        .collect();
      if (recentDeliveries.length >= preferences.maxPerDay) {
        await ctx.db.patch(intent._id, {
          skipReason: 'daily_limit',
          status: 'skipped',
          updatedAt: args.now,
        });
        continue;
      }

      const latestDeliveryAt = recentDeliveries.reduce((latest, delivery) => Math.max(latest, delivery.sentAt), 0);
      if (latestDeliveryAt > 0 && args.now - latestDeliveryAt < preferences.minGapMinutes * 60 * 1000) {
        await ctx.db.patch(intent._id, {
          scheduledFor: latestDeliveryAt + preferences.minGapMinutes * 60 * 1000,
          updatedAt: args.now,
        });
        continue;
      }

      const devices = await ctx.db
        .query('notificationDevices')
        .withIndex('by_profile_id_and_enabled', q =>
          q.eq('profileId', intent.profileId).eq('enabled', true),
        )
        .collect();

      if (devices.length === 0) {
        await ctx.db.patch(intent._id, {
          skipReason: 'no_enabled_devices',
          status: 'skipped',
          updatedAt: args.now,
        });
        continue;
      }

      await ctx.db.patch(intent._id, {
        attemptCount: intent.attemptCount + 1,
        lastAttemptAt: args.now,
        status: 'sending',
        updatedAt: args.now,
      });
      claimed.push({
        body: intent.body,
        data: intent.data,
        devices: devices.map(device => ({
          _id: device._id,
          expoPushToken: device.expoPushToken,
        })),
        intentId: intent._id,
        title: intent.title,
      });
    }

    return claimed;
  },
});

export const failIntentSend = internalMutation({
  args: {
    error: v.string(),
    intentId: v.id('notificationIntents'),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.intentId, {
      failureReason: args.error.slice(0, 500),
      status: 'failed',
      updatedAt: args.now,
    });
    return null;
  },
});

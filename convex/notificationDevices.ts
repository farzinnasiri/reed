import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { requireViewerProfile } from './profiles';

export const viewerStatus = query({
  args: {},
  returns: v.object({
    enabledDeviceCount: v.number(),
    hasEnabledDevice: v.boolean(),
    latestDevice: v.union(
      v.object({
        disabledAt: v.optional(v.number()),
        disableReason: v.optional(v.union(
          v.literal('device_not_registered'),
          v.literal('logout'),
          v.literal('permission_denied'),
          v.literal('replaced'),
          v.literal('user_disabled'),
        )),
        enabled: v.boolean(),
        lastRegisteredAt: v.number(),
        lastSeenAt: v.number(),
        platform: v.union(v.literal('android'), v.literal('ios')),
      }),
      v.null(),
    ),
  }),
  handler: async ctx => {
    const profile = await requireViewerProfile(ctx);
    const devices = await ctx.db
      .query('notificationDevices')
      .withIndex('by_profile_id', q => q.eq('profileId', profile._id))
      .collect();
    const latestDevice = devices.sort((left, right) => right.lastSeenAt - left.lastSeenAt)[0] ?? null;
    const enabledDeviceCount = devices.filter(device => device.enabled).length;

    return {
      enabledDeviceCount,
      hasEnabledDevice: enabledDeviceCount > 0,
      latestDevice: latestDevice
        ? {
            disabledAt: latestDevice.disabledAt,
            disableReason: latestDevice.disableReason,
            enabled: latestDevice.enabled,
            lastRegisteredAt: latestDevice.lastRegisteredAt,
            lastSeenAt: latestDevice.lastSeenAt,
            platform: latestDevice.platform,
          }
        : null,
    };
  },
});

export const registerDevice = mutation({
  args: {
    appVersion: v.optional(v.string()),
    clientInstallId: v.string(),
    expoPushToken: v.string(),
    platform: v.union(v.literal('android'), v.literal('ios')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const now = Date.now();
    if (!args.expoPushToken.startsWith('ExponentPushToken[') && !args.expoPushToken.startsWith('ExpoPushToken[')) {
      throw new ConvexError('Expo push token is invalid.');
    }
    if (!args.clientInstallId.trim()) {
      throw new ConvexError('Client install id is required.');
    }

    const existingForInstall = await ctx.db
      .query('notificationDevices')
      .withIndex('by_profile_id_and_client_install_id', q =>
        q.eq('profileId', profile._id).eq('clientInstallId', args.clientInstallId),
      )
      .first();
    const existingForToken = await ctx.db
      .query('notificationDevices')
      .withIndex('by_expo_push_token', q => q.eq('expoPushToken', args.expoPushToken))
      .first();

    if (existingForToken && existingForToken._id !== existingForInstall?._id) {
      await ctx.db.patch(existingForToken._id, {
        disabledAt: now,
        disableReason: 'replaced',
        enabled: false,
      });
    }

    const patch = {
      appVersion: args.appVersion,
      authUserId: profile.authUserId,
      disabledAt: undefined,
      disableReason: undefined,
      enabled: true,
      expoPushToken: args.expoPushToken,
      lastRegisteredAt: now,
      lastSeenAt: now,
      platform: args.platform,
    };

    if (existingForInstall) {
      await ctx.db.patch(existingForInstall._id, patch);
      await ctx.scheduler.runAfter(0, internal.outreachState.ensureScheduled, { profileId: profile._id });
      return null;
    }

    await ctx.db.insert('notificationDevices', {
      ...patch,
      clientInstallId: args.clientInstallId,
      profileId: profile._id,
    });
    await ctx.scheduler.runAfter(0, internal.outreachState.ensureScheduled, { profileId: profile._id });
    return null;
  },
});

export const disableCurrentDevice = mutation({
  args: {
    clientInstallId: v.string(),
    reason: v.union(v.literal('logout'), v.literal('permission_denied'), v.literal('user_disabled')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const device = await ctx.db
      .query('notificationDevices')
      .withIndex('by_profile_id_and_client_install_id', q =>
        q.eq('profileId', profile._id).eq('clientInstallId', args.clientInstallId),
      )
      .first();

    if (device) {
      await ctx.db.patch(device._id, {
        disabledAt: Date.now(),
        disableReason: args.reason,
        enabled: false,
      });
    }

    return null;
  },
});

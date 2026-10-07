import { onboardingComplete } from '../domains/profile/onboarding';
import { internalMutation, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import type { QueryCtx, MutationCtx } from './_generated/server';
import type { UserIdentity } from 'convex/server';
import { updateProfileTimeZone } from './profileTimeZone';

const profileValidator = v.object({
  _creationTime: v.number(),
  _id: v.id('profiles'),
  authUserId: v.string(),
  avatarUrl: v.optional(v.string()),
  displayName: v.optional(v.string()),
  email: v.string(),
  onboardingCompletedAt: v.optional(v.number()),
  onboardingVersion: v.optional(v.literal(2)),
  timeZone: v.optional(v.string()),
  updatedAt: v.number(),
});

function profilePatchFromAuthUser(user: {
  email: string;
  image?: string | null;
  name?: string | null;
  _id: string;
}) {
  return {
    authUserId: user._id,
    avatarUrl: user.image ?? undefined,
    displayName: user.name ?? undefined,
    email: user.email,
    updatedAt: Date.now(),
  };
}

function authUserFromIdentity(identity: UserIdentity) {
  if (!identity.email) {
    throw new ConvexError('Your Clerk account needs an email address before Reed can continue.');
  }

  return {
    _id: identity.tokenIdentifier,
    email: identity.email,
    image: identity.pictureUrl,
    name: identity.name,
  };
}

async function requireAuthUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError('Not authenticated.');
  }
  return authUserFromIdentity(identity);
}

function authSyncPatchForExistingProfile(
  profile: { avatarUrl?: string; displayName?: string; email: string; onboardingCompletedAt?: number },
  user: { email: string; image?: string | null; name?: string | null; _id: string },
) {
  const patch: {
    avatarUrl?: string;
    displayName?: string;
    email?: string;
    updatedAt?: number;
  } = {};
  const nextAvatarUrl = user.image ?? undefined;

  if (profile.email !== user.email) {
    patch.email = user.email;
  }

  if (profile.avatarUrl !== nextAvatarUrl) {
    patch.avatarUrl = nextAvatarUrl;
  }

  // Display name becomes app-owned once onboarding has run. The identity
  // provider's default name must not overwrite the user's chosen Reed name.
  if (!profile.onboardingCompletedAt && !profile.displayName && user.name) {
    patch.displayName = user.name;
  }

  if (Object.keys(patch).length > 0) {
    patch.updatedAt = Date.now();
  }

  return patch;
}

async function getProfileForAuthUser(ctx: QueryCtx | MutationCtx, authUser: { email: string; _id: string }) {
  return await ctx.db
    .query('profiles')
    .withIndex('by_auth_user_id', q => q.eq('authUserId', authUser._id))
    .unique();
}

export async function requireViewerProfile(ctx: QueryCtx | MutationCtx) {
  const authUser = await requireAuthUser(ctx);
  const profile = await getProfileForAuthUser(ctx, authUser);

  if (!profile) {
    throw new ConvexError('Viewer profile is missing. Reload the app and try again.');
  }

  return profile;
}

export const viewer = query({
  args: {},
  returns: v.union(v.null(), profileValidator),
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    const authUser = authUserFromIdentity(identity);
    return await getProfileForAuthUser(ctx, authUser);
  },
});

export const updateTimeZone = mutation({
  args: { timeZone: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    await updateProfileTimeZone(ctx, profile, args.timeZone);
    return null;
  },
});

export const viewerTrainingProfile = query({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const authUser = authUserFromIdentity(identity);
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_auth_user_id', q => q.eq('authUserId', authUser._id))
      .unique();
    if (!profile) {
      return null;
    }
    const trainingProfile = await ctx.db
      .query('trainingProfiles')
      .withIndex('by_profile_id', q => q.eq('profileId', profile._id))
      .unique();
    if (!trainingProfile) {
      return null;
    }

    const latestBodyMetrics = await loadLatestBodyMetrics(ctx, profile._id);
    const latestStrengthBenchmarks = await loadLatestStrengthBenchmarks(ctx, profile._id);
    const latestCardioBenchmarks = await loadLatestCardioBenchmarks(ctx, profile._id);

    return {
      latestBodyMetrics,
      latestCardioBenchmarks,
      latestStrengthBenchmarks,
      trainingProfile,
    };
  },
});

export const bodyWeightTrend = query({
  args: {
    rangeDays: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const authUser = authUserFromIdentity(identity);
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_auth_user_id', q => q.eq('authUserId', authUser._id))
      .unique();
    if (!profile) {
      return [];
    }
    const rangeDays = Math.min(Math.max(Math.round(args.rangeDays), 7), 365);
    const startAt = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query('bodyMeasurements')
      .withIndex('by_profile_id_and_metric_key_and_observed_at', q =>
        q.eq('profileId', profile._id).eq('metricKey', 'body_weight').gte('observedAt', startAt),
      )
      .order('asc')
      .collect();

    return rows.map(row => ({
      _id: row._id,
      observedAt: row.observedAt,
      source: row.source,
      unit: row.unit,
      value: row.value,
    }));
  },
});

export const upsertTodayBodyWeight = mutation({
  args: {
    dayEndAt: v.number(),
    dayStartAt: v.number(),
    observedAt: v.number(),
    valueKg: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const valueKg = roundMetric(args.valueKg);
    if (!isInRange(valueKg, 25, 300)) {
      throw new ConvexError('Weight must be between 25 and 300 kg.');
    }
    if (!(args.dayStartAt < args.observedAt && args.observedAt <= args.dayEndAt)) {
      throw new ConvexError('Weight log time is outside the selected day.');
    }
    if (args.dayEndAt - args.dayStartAt > 48 * 60 * 60 * 1000) {
      throw new ConvexError('Weight log day is invalid.');
    }

    const manualRowsToday = await ctx.db
      .query('bodyMeasurements')
      .withIndex('by_profile_id_and_metric_key_and_observed_at', q =>
        q
          .eq('profileId', profile._id)
          .eq('metricKey', 'body_weight')
          .gte('observedAt', args.dayStartAt)
          .lt('observedAt', args.dayEndAt),
      )
      .filter(q => q.eq(q.field('source'), 'manual'))
      .take(8);

    const [existing, ...duplicates] = manualRowsToday;
    if (existing) {
      await ctx.db.patch(existing._id, {
        observedAt: args.observedAt,
        value: valueKg,
      });
      for (const duplicate of duplicates) {
        await ctx.db.delete(duplicate._id);
      }
    } else {
      await ctx.db.insert('bodyMeasurements', {
        metricKey: 'body_weight',
        observedAt: args.observedAt,
        profileId: profile._id,
        source: 'manual',
        unit: 'kg',
        value: valueKg,
      });
    }

    await ctx.scheduler.runAfter(0, internal.reedJourney.rebuildLatest, {
      profileId: profile._id,
      trigger: 'body_metrics_updated',
    });
    await ctx.scheduler.runAfter(0, internal.profileInsight.markStale, {
      profileId: profile._id,
      reason: 'body_updated',
    });

    return null;
  },
});

export const updateViewerBasics = mutation({
  args: { displayName: v.string() },
  returns: profileValidator,
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const displayName = args.displayName.trim();
    if (displayName.length < 2 || displayName.length > 60) {
      throw new ConvexError('Name must be between 2 and 60 characters.');
    }

    await ctx.db.patch(profile._id, { displayName, updatedAt: Date.now() });
    const updated = await ctx.db.get(profile._id);
    if (!updated) throw new ConvexError('Profile was not saved.');
    return updated;
  },
});

export const ensureViewerProfile = mutation({
  args: {},
  returns: profileValidator,
  handler: async ctx => {
    const authUser = await requireAuthUser(ctx);
    const existingProfile = await ctx.db
      .query('profiles')
      .withIndex('by_auth_user_id', q => q.eq('authUserId', authUser._id))
      .unique();

    if (existingProfile) {
      const patch = authSyncPatchForExistingProfile(existingProfile, authUser);
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existingProfile._id, patch);
      }
      const updatedProfile = await ctx.db.get(existingProfile._id);

      if (!updatedProfile) {
        throw new ConvexError('Profile disappeared during sync');
      }

      if (onboardingComplete(updatedProfile)) {
        await ctx.scheduler.runAfter(0, internal.outreachState.ensureScheduled, { profileId: updatedProfile._id });
      }
      return updatedProfile;
    }

    const patch = profilePatchFromAuthUser(authUser);
    const profileId = await ctx.db.insert('profiles', patch);
    const createdProfile = await ctx.db.get(profileId);

    if (!createdProfile) {
      throw new ConvexError('Profile was not created');
    }

    return createdProfile;
  },
});

async function loadLatestBodyMetrics(ctx: QueryCtx, profileId: Id<'profiles'>) {
  // Current body state is derived from bodyMeasurements only. In particular,
  // latest bodyweight is the newest row with metricKey='body_weight'.
  const metricKeys = ['body_weight', 'body_fat_percent', 'skeletal_muscle_mass', 'resting_heart_rate'] as const;
  const rows = await Promise.all(
    metricKeys.map(metricKey =>
      ctx.db
        .query('bodyMeasurements')
        .withIndex('by_profile_id_and_metric_key_and_observed_at', q =>
          q.eq('profileId', profileId).eq('metricKey', metricKey),
        )
        .order('desc')
        .take(1),
    ),
  );
  return rows.map(row => row[0]).filter(Boolean);
}

async function loadLatestStrengthBenchmarks(ctx: QueryCtx, profileId: Id<'profiles'>) {
  const anchorKeys = ['squat', 'bench_press', 'deadlift', 'overhead_press', 'pull_up', 'push_up', 'dip'] as const;
  const rows = await Promise.all(
    anchorKeys.map(anchorKey =>
      ctx.db
        .query('strengthAssessments')
        .withIndex('by_profile_id_and_anchor_key_and_observed_at', q =>
          q.eq('profileId', profileId).eq('anchorKey', anchorKey),
        )
        .order('desc')
        .take(1),
    ),
  );
  return rows.map(row => row[0]).filter(Boolean);
}

async function loadLatestCardioBenchmarks(ctx: QueryCtx, profileId: Id<'profiles'>) {
  const anchorKeys = ['run_1km', 'run_5km', 'stair_test'] as const;
  const rows = await Promise.all(
    anchorKeys.map(anchorKey =>
      ctx.db
        .query('cardioAssessments')
        .withIndex('by_profile_id_and_anchor_key_and_observed_at', q =>
          q.eq('profileId', profileId).eq('anchorKey', anchorKey),
        )
        .order('desc')
        .take(1),
    ),
  );
  return rows.map(row => row[0]).filter(Boolean);
}

function roundMetric(value: number) {
  return Math.round(value * 10) / 10;
}

export const deleteByAuthUserId = internalMutation({
  args: { authUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteProfileOwnedData(ctx, args.authUserId);
    return null;
  },
});

export const deleteViewerData = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    const authUser = await requireAuthUser(ctx);
    await deleteProfileOwnedData(ctx, authUser._id);
    return null;
  },
});

async function deleteProfileOwnedData(ctx: MutationCtx, authUserId: string) {
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_auth_user_id', q => q.eq('authUserId', authUserId))
    .unique();

  if (!profile) {
    return;
  }

  const trainingProfile = await ctx.db
    .query('trainingProfiles')
    .withIndex('by_profile_id', q => q.eq('profileId', profile._id))
    .unique();

  if (trainingProfile) {
    await ctx.db.delete(trainingProfile._id);
  }
  await deleteAllBodyMeasurementsForProfile(ctx, profile._id);
  await deleteAllStrengthAssessmentsForProfile(ctx, profile._id);
  await deleteAllCardioAssessmentsForProfile(ctx, profile._id);
  await ctx.db.delete(profile._id);
}

const DELETE_BATCH_SIZE = 128;

async function deleteAllBodyMeasurementsForProfile(ctx: MutationCtx, profileId: Id<'profiles'>) {
  // Page by cursor to avoid unbounded in-memory scans on growth tables.
  let cursor: string | null = null;
  while (true) {
    const page = await ctx.db
      .query('bodyMeasurements')
      .withIndex('by_profile_id_and_observed_at', q => q.eq('profileId', profileId))
      .paginate({ cursor, numItems: DELETE_BATCH_SIZE });
    for (const row of page.page) {
      await ctx.db.delete(row._id);
    }
    if (page.isDone) {
      return;
    }
    cursor = page.continueCursor;
  }
}

async function deleteAllStrengthAssessmentsForProfile(ctx: MutationCtx, profileId: Id<'profiles'>) {
  let cursor: string | null = null;
  while (true) {
    const page = await ctx.db
      .query('strengthAssessments')
      .withIndex('by_profile_id_and_observed_at', q => q.eq('profileId', profileId))
      .paginate({ cursor, numItems: DELETE_BATCH_SIZE });
    for (const row of page.page) {
      await ctx.db.delete(row._id);
    }
    if (page.isDone) {
      return;
    }
    cursor = page.continueCursor;
  }
}

async function deleteAllCardioAssessmentsForProfile(ctx: MutationCtx, profileId: Id<'profiles'>) {
  let cursor: string | null = null;
  while (true) {
    const page = await ctx.db
      .query('cardioAssessments')
      .withIndex('by_profile_id_and_observed_at', q => q.eq('profileId', profileId))
      .paginate({ cursor, numItems: DELETE_BATCH_SIZE });
    for (const row of page.page) {
      await ctx.db.delete(row._id);
    }
    if (page.isDone) {
      return;
    }
    cursor = page.continueCursor;
  }
}

function isInRange(value: number, min: number, max: number) { return Number.isFinite(value) && value >= min && value <= max; }

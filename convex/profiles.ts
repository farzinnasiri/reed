import { internalMutation, mutation, query } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { authComponent } from './auth';
import {
  completeOnboardingArgsFields,
  type CompleteOnboardingPayload,
} from './profileValidators';
import type { Id } from './_generated/dataModel';
import type { QueryCtx, MutationCtx } from './_generated/server';
import { buildTrainingProfileContextSummary } from './trainingProfileContext';

const profileValidator = v.object({
  _creationTime: v.number(),
  _id: v.id('profiles'),
  authUserId: v.string(),
  avatarUrl: v.optional(v.string()),
  displayName: v.optional(v.string()),
  email: v.string(),
  onboardingCompletedAt: v.optional(v.number()),
  updatedAt: v.number(),
});

type StrengthAnchorKey = 'squat' | 'bench_press' | 'deadlift' | 'overhead_press' | 'pull_up' | 'push_up' | 'dip';
const strengthAnchorKeys = new Set<StrengthAnchorKey>([
  'squat',
  'bench_press',
  'deadlift',
  'overhead_press',
  'pull_up',
  'push_up',
  'dip',
]);

function isStrengthAnchorKey(value: string): value is StrengthAnchorKey {
  return strengthAnchorKeys.has(value as StrengthAnchorKey);
}

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

export async function requireViewerProfile(ctx: QueryCtx | MutationCtx) {
  const authUser = await authComponent.getAuthUser(ctx);
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_auth_user_id', q => q.eq('authUserId', authUser._id))
    .unique();

  if (!profile) {
    throw new ConvexError('Viewer profile is missing. Reload the app and try again.');
  }

  return profile;
}

export const viewer = query({
  args: {},
  returns: v.union(v.null(), profileValidator),
  handler: async ctx => {
    const authUser = await authComponent.safeGetAuthUser(ctx);

    if (!authUser) {
      return null;
    }

    return await ctx.db
      .query('profiles')
      .withIndex('by_auth_user_id', q => q.eq('authUserId', authUser._id))
      .unique();
  },
});

export const viewerTrainingProfile = query({
  args: {},
  handler: async ctx => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) {
      return null;
    }
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

export const ensureViewerProfile = mutation({
  args: {},
  returns: profileValidator,
  handler: async ctx => {
    const authUser = await authComponent.getAuthUser(ctx);
    const patch = profilePatchFromAuthUser(authUser);
    const existingProfile = await ctx.db
      .query('profiles')
      .withIndex('by_auth_user_id', q => q.eq('authUserId', authUser._id))
      .unique();

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, patch);
      const updatedProfile = await ctx.db.get(existingProfile._id);

      if (!updatedProfile) {
        throw new ConvexError('Profile disappeared during sync');
      }

      return updatedProfile;
    }

    const profileId = await ctx.db.insert('profiles', patch);
    const createdProfile = await ctx.db.get(profileId);

    if (!createdProfile) {
      throw new ConvexError('Profile was not created');
    }

    return createdProfile;
  },
});

export const completeOnboarding = mutation({
  args: completeOnboardingArgsFields,
  returns: profileValidator,
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    validateOnboardingPayload(args);

    const now = Date.now();
    const aiContextSummary = buildTrainingProfileContextSummary({
      displayName: args.displayName,
      payload: args,
      now,
    });
    const trainingProfile = {
      aiContextSummary,
      baseline: args.baseline,
      constraints: args.constraints,
      createdAt: now,
      goalDetails: args.goalDetails,
      profileId: profile._id,
      profilingConsent: true as const,
      rankedGoals: args.rankedGoals,
      source: 'onboarding' as const,
      trainingReality: args.trainingReality,
      updatedAt: now,
      userNotes: args.userNotes,
      version: 1,
    };

    const existingTrainingProfile = await ctx.db
      .query('trainingProfiles')
      .withIndex('by_profile_id', q => q.eq('profileId', profile._id))
      .unique();

    if (existingTrainingProfile) {
      await ctx.db.patch(existingTrainingProfile._id, {
        ...trainingProfile,
        createdAt: existingTrainingProfile.createdAt,
        source: existingTrainingProfile.source,
        version: existingTrainingProfile.version,
      });
    } else {
      await ctx.db.insert('trainingProfiles', trainingProfile);
    }

    await persistDynamicMetrics(ctx, profile._id, args, now, 'onboarding');

    await ctx.db.patch(profile._id, {
      displayName: args.displayName.trim(),
      onboardingCompletedAt: now,
      updatedAt: now,
    });

    const updatedProfile = await ctx.db.get(profile._id);
    const updatedTrainingProfile = await ctx.db
      .query('trainingProfiles')
      .withIndex('by_profile_id', q => q.eq('profileId', profile._id))
      .unique();

    if (!updatedProfile || !updatedTrainingProfile) {
      throw new ConvexError('Profile was not saved.');
    }

    return updatedProfile;
  },
});

export const updateTrainingProfile = mutation({
  args: completeOnboardingArgsFields,
  returns: profileValidator,
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    validateOnboardingPayload(args);

    const existingTrainingProfile = await ctx.db
      .query('trainingProfiles')
      .withIndex('by_profile_id', q => q.eq('profileId', profile._id))
      .unique();

    if (!existingTrainingProfile) {
      throw new ConvexError('Training profile is missing. Complete onboarding first.');
    }

    const now = Date.now();
    const aiContextSummary = buildTrainingProfileContextSummary({
      displayName: args.displayName,
      payload: args,
      now,
    });

    await ctx.db.patch(existingTrainingProfile._id, {
      aiContextSummary,
      baseline: args.baseline,
      constraints: args.constraints,
      goalDetails: args.goalDetails,
      profilingConsent: true,
      rankedGoals: args.rankedGoals,
      source: 'manual',
      trainingReality: args.trainingReality,
      updatedAt: now,
      userNotes: args.userNotes,
      version: existingTrainingProfile.version + 1,
    });

    await persistDynamicMetrics(ctx, profile._id, args, now, 'manual');

    await ctx.db.patch(profile._id, {
      displayName: args.displayName.trim(),
      updatedAt: now,
    });

    const updatedProfile = await ctx.db.get(profile._id);
    if (!updatedProfile) {
      throw new ConvexError('Profile was not saved.');
    }

    return updatedProfile;
  },
});

function validateOnboardingPayload(payload: CompleteOnboardingPayload) {
  const { baseline, bodyMetrics, constraints, displayName, goalDetails, performanceAnchors, rankedGoals, trainingReality, userNotes } = payload;

  if (displayName.trim().length < 2 || displayName.trim().length > 60) {
    throw new ConvexError('Name must be between 2 and 60 characters.');
  }

  if (!isValidBirthDate(baseline.birthYear, baseline.birthMonth, baseline.birthDay)) {
    throw new ConvexError('Enter a valid date of birth.');
  }

  const age = getAge(baseline.birthYear, baseline.birthMonth, baseline.birthDay);
  if (age < 13 || age > 90) {
    throw new ConvexError('Date of birth is outside the supported range.');
  }

  if (!isInRange(baseline.heightCm, 100, 250)) {
    throw new ConvexError('Height must be between 100 and 250 cm.');
  }

  if (trainingReality.trainingStyles.length < 1 || trainingReality.trainingStyles.length > 3) {
    throw new ConvexError('Choose between 1 and 3 training styles.');
  }

  if (hasDuplicates(trainingReality.trainingStyles)) {
    throw new ConvexError('Training styles must be unique.');
  }

  if (trainingReality.equipmentAccess.length < 1) {
    throw new ConvexError('Choose at least one training environment.');
  }

  if (hasDuplicates(trainingReality.equipmentAccess)) {
    throw new ConvexError('Training environments must be unique.');
  }

  if (rankedGoals.length < 1 || rankedGoals.length > 3) {
    throw new ConvexError('Rank between 1 and 3 goals.');
  }

  if (hasDuplicates(rankedGoals)) {
    throw new ConvexError('Ranked goals must be unique.');
  }

  for (const [goal, detail] of Object.entries(goalDetails)) {
    if (!rankedGoals.includes(goal)) {
      throw new ConvexError('Goal details must match ranked goals.');
    }
    validateBoundedText(detail.customDetail, 'Goal detail');
    validateStringList(detail.focusAreas, 'Goal focus areas', 12);
  }

  validateBoundedText(userNotes, 'User note', 1200);

  for (const [area, detail] of Object.entries(constraints.details)) {
    if (!constraints.areas.includes(area)) {
      throw new ConvexError('Constraint details must match selected constraints.');
    }
    validateBoundedText(detail.customDetail, 'Constraint detail');
  }

  if (hasDuplicates(constraints.areas)) {
    throw new ConvexError('Constraints must be unique.');
  }

  validateOptionalRange(bodyMetrics.weightKg, 25, 300, 'Weight');
  validateOptionalRange(bodyMetrics.bodyFatPercent, 1, 80, 'Body fat percentage');
  validateOptionalRange(bodyMetrics.skeletalMuscleMassKg, 5, 100, 'Skeletal muscle mass');
  validateOptionalRange(bodyMetrics.restingHeartRate, 30, 220, 'Resting heart rate');

  for (const [anchorKey, anchor] of Object.entries(performanceAnchors.loaded)) {
    if (anchor.loadKg === null || anchor.reps === null) {
      throw new ConvexError(`Loaded strength anchor ${anchorKey} must include load and reps.`);
    }
    validateOptionalRange(anchor.loadKg, 0, 1000, `${anchorKey} load`);
    validateOptionalRange(anchor.reps, 1, 100, `${anchorKey} reps`);
  }

  for (const [anchorKey, reps] of Object.entries(performanceAnchors.bodyweight)) {
    validateOptionalRange(reps, 1, 500, `${anchorKey} reps`);
  }

  validateOptionalRange(performanceAnchors.cardio.run1KmSeconds, 60, 7200, '1 km run time');
  validateOptionalRange(performanceAnchors.cardio.run5KmSeconds, 180, 21600, '5 km run time');
  validateOptionalRange(performanceAnchors.cardio.stairFloors, 1, 500, 'Stair test floors');
  validateOptionalRange(performanceAnchors.cardio.stairMinutes, 1, 240, 'Stair test minutes');
}

function isValidBirthDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    year >= 1900 &&
    year <= new Date().getFullYear()
  );
}

function getAge(year: number, month: number, day: number) {
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
    age -= 1;
  }
  return age;
}

function isInRange(value: number, min: number, max: number) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length;
}

function validateBoundedText(value: string | null, label: string, maxLength = 160) {
  if (value !== null && value.trim().length > maxLength) {
    throw new ConvexError(`${label} must be ${maxLength} characters or fewer.`);
  }
}

function validateStringList(values: string[], label: string, maxLength: number) {
  if (values.length > maxLength) {
    throw new ConvexError(`${label} has too many values.`);
  }
  if (hasDuplicates(values)) {
    throw new ConvexError(`${label} must be unique.`);
  }
  for (const value of values) {
    validateBoundedText(value, label);
  }
}

function validateOptionalRange(value: number | null, min: number, max: number, label: string) {
  if (value !== null && !isInRange(value, min, max)) {
    throw new ConvexError(`${label} is outside the supported range.`);
  }
}

async function persistDynamicMetrics(
  ctx: MutationCtx,
  profileId: Id<'profiles'>,
  payload: CompleteOnboardingPayload,
  observedAt: number,
  source: 'onboarding' | 'manual',
) {
  await upsertBodyMetricIfChanged(ctx, profileId, 'body_weight', payload.bodyMetrics.weightKg, 'kg', observedAt, source);
  await upsertBodyMetricIfChanged(ctx, profileId, 'body_fat_percent', payload.bodyMetrics.bodyFatPercent, 'percent', observedAt, source);
  await upsertBodyMetricIfChanged(ctx, profileId, 'skeletal_muscle_mass', payload.bodyMetrics.skeletalMuscleMassKg, 'kg', observedAt, source);
  await upsertBodyMetricIfChanged(ctx, profileId, 'resting_heart_rate', payload.bodyMetrics.restingHeartRate, 'bpm', observedAt, source);

  for (const [anchorKey, anchor] of Object.entries(payload.performanceAnchors.loaded)) {
    if (isStrengthAnchorKey(anchorKey) && anchor.loadKg !== null && anchor.reps !== null) {
      await upsertStrengthBenchmarkIfChanged(ctx, profileId, anchorKey, 'loaded_reps', anchor.loadKg, anchor.reps, observedAt, source);
    }
  }

  for (const [anchorKey, reps] of Object.entries(payload.performanceAnchors.bodyweight)) {
    if (isStrengthAnchorKey(anchorKey)) {
      await upsertStrengthBenchmarkIfChanged(ctx, profileId, anchorKey, 'bodyweight_reps', null, reps, observedAt, source);
    }
  }

  if (payload.performanceAnchors.cardio.run1KmSeconds !== null) {
    await upsertCardioBenchmarkIfChanged(ctx, profileId, 'run_1km', 'running', payload.performanceAnchors.cardio.run1KmSeconds, 1000, null, observedAt, source);
  }
  if (payload.performanceAnchors.cardio.run5KmSeconds !== null) {
    await upsertCardioBenchmarkIfChanged(ctx, profileId, 'run_5km', 'running', payload.performanceAnchors.cardio.run5KmSeconds, 5000, null, observedAt, source);
  }
  if (payload.performanceAnchors.cardio.stairFloors !== null && payload.performanceAnchors.cardio.stairMinutes !== null) {
    await upsertCardioBenchmarkIfChanged(
      ctx,
      profileId,
      'stair_test',
      'stairs',
      Math.round(payload.performanceAnchors.cardio.stairMinutes * 60),
      null,
      payload.performanceAnchors.cardio.stairFloors,
      observedAt,
      source,
    );
  }
}

async function upsertBodyMetricIfChanged(
  ctx: MutationCtx,
  profileId: Id<'profiles'>,
  metricKey: 'body_weight' | 'body_fat_percent' | 'skeletal_muscle_mass' | 'resting_heart_rate',
  value: number | null,
  unit: 'kg' | 'percent' | 'bpm',
  observedAt: number,
  source: 'onboarding' | 'manual',
) {
  if (value === null) return;
  const latest = await ctx.db
    .query('bodyMeasurements')
    .withIndex('by_profile_id_and_metric_key_and_observed_at', q =>
      q.eq('profileId', profileId).eq('metricKey', metricKey),
    )
    .order('desc')
    .take(1);
  if (latest[0] && latest[0].value === value) return;
  await ctx.db.insert('bodyMeasurements', {
    metricKey,
    observedAt,
    profileId,
    source,
    unit,
    value,
  });
}

async function upsertStrengthBenchmarkIfChanged(
  ctx: MutationCtx,
  profileId: Id<'profiles'>,
  anchorKey: StrengthAnchorKey,
  kind: 'loaded_reps' | 'bodyweight_reps',
  loadKg: number | null,
  reps: number,
  observedAt: number,
  source: 'onboarding' | 'manual',
) {
  const latest = await ctx.db
    .query('strengthAssessments')
    .withIndex('by_profile_id_and_anchor_key_and_observed_at', q =>
      q.eq('profileId', profileId).eq('anchorKey', anchorKey),
    )
    .order('desc')
    .take(1);
  if (latest[0] && latest[0].loadKg === loadKg && latest[0].reps === reps) return;
  const estimatedOneRepMaxKg =
    kind === 'loaded_reps' && loadKg !== null && reps <= 12
      ? roundMetric(loadKg * (1 + reps / 30))
      : null;
  await ctx.db.insert('strengthAssessments', {
    anchorKey,
    estimatedOneRepMaxKg,
    kind,
    loadKg,
    observedAt,
    profileId,
    reps,
    source,
  });
}

async function upsertCardioBenchmarkIfChanged(
  ctx: MutationCtx,
  profileId: Id<'profiles'>,
  anchorKey: 'run_1km' | 'run_5km' | 'stair_test',
  modality: 'running' | 'stairs',
  durationSeconds: number | null,
  distanceMeters: number | null,
  floors: number | null,
  observedAt: number,
  source: 'onboarding' | 'manual',
) {
  const latest = await ctx.db
    .query('cardioAssessments')
    .withIndex('by_profile_id_and_anchor_key_and_observed_at', q =>
      q.eq('profileId', profileId).eq('anchorKey', anchorKey),
    )
    .order('desc')
    .take(1);
  if (
    latest[0] &&
    latest[0].durationSeconds === durationSeconds &&
    latest[0].distanceMeters === distanceMeters &&
    latest[0].floors === floors
  ) return;
  await ctx.db.insert('cardioAssessments', {
    anchorKey,
    distanceMeters,
    durationSeconds,
    floors,
    modality,
    observedAt,
    profileId,
    source,
  });
}

async function loadLatestBodyMetrics(ctx: QueryCtx, profileId: Id<'profiles'>) {
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
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_auth_user_id', q => q.eq('authUserId', args.authUserId))
      .unique();

    if (profile) {
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

    return null;
  },
});

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

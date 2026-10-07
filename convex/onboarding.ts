import { ConvexError, v } from 'convex/values';
import { mutation, type MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { requireViewerProfile } from './profiles';
import { onboardingAnswersValidator, profileChangeValidator, validateOnboarding } from './onboardingValidators';
import { applyProfileChange } from '../domains/profile/edits';
import { ONBOARDING_SCHEMA_VERSION, type OnboardingAnswers } from '../domains/profile/onboarding';

/** Signup and profile edits share validation and save side effects. */
async function saveOnboarding(ctx: MutationCtx, profile: Doc<'profiles'>, name: string, answers: OnboardingAnswers, source: 'onboarding' | 'manual', now: number, recordWeight = true) {
  validateOnboarding(name, answers, now);
  const existing = await ctx.db.query('trainingProfiles').withIndex('by_profile_id', q => q.eq('profileId', profile._id)).unique();
  const fields = { onboarding: answers, profileId: profile._id, profilingConsent: true as const, source, updatedAt: now, version: (existing?.version ?? 0) + 1 };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert('trainingProfiles', fields);
  const latestWeight = await ctx.db.query('bodyMeasurements').withIndex('by_profile_id_and_metric_key_and_observed_at', q => q.eq('profileId', profile._id).eq('metricKey', 'body_weight')).order('desc').first();
  // Editing motivation or schedule must not append a duplicate weigh-in.
  if (recordWeight && (!latestWeight || latestWeight.value !== answers.weightKg)) {
    await ctx.db.insert('bodyMeasurements', { profileId: profile._id, metricKey: 'body_weight', observedAt: now, source, unit: 'kg', value: answers.weightKg });
  }
  await ctx.db.patch(profile._id, { displayName: name.trim(), onboardingCompletedAt: profile.onboardingVersion === ONBOARDING_SCHEMA_VERSION ? profile.onboardingCompletedAt ?? now : now, onboardingVersion: ONBOARDING_SCHEMA_VERSION, updatedAt: now });
  await ctx.scheduler.runAfter(0, internal.reedJourney.rebuildLatest, { profileId: profile._id, trigger: 'onboarding_updated' });
  await ctx.scheduler.runAfter(0, internal.profileInsight.markStale, { profileId: profile._id, reason: 'profile_updated' });
  await ctx.scheduler.runAfter(0, internal.outreachState.ensureScheduled, { profileId: profile._id });
}
const args = { displayName: v.string(), answers: onboardingAnswersValidator };
export const complete = mutation({
  args, returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    await saveOnboarding(ctx, profile, args.displayName, { ...args.answers, notes: args.answers.notes ?? null }, 'onboarding', Date.now());
    return null;
  },
});
export const update = mutation({
  args, returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    if (profile.onboardingVersion !== ONBOARDING_SCHEMA_VERSION) throw new ConvexError('Complete onboarding first.');
    await saveOnboarding(ctx, profile, args.displayName, { ...args.answers, notes: args.answers.notes ?? null }, 'manual', Date.now());
    return null;
  },
});

/** Merge one editor's answer with the live profile, never a stale whole-form snapshot. */
export const updateField = mutation({
  args: { change: profileChangeValidator }, returns: v.null(),
  handler: async (ctx, { change }) => {
    const profile = await requireViewerProfile(ctx);
    const current = await ctx.db.query('trainingProfiles').withIndex('by_profile_id', q => q.eq('profileId', profile._id)).unique();
    if (profile.onboardingVersion !== ONBOARDING_SCHEMA_VERSION || !current?.onboarding) throw new ConvexError('Complete onboarding first.');
    const latestWeight = await ctx.db.query('bodyMeasurements').withIndex('by_profile_id_and_metric_key_and_observed_at', q => q.eq('profileId', profile._id).eq('metricKey', 'body_weight')).order('desc').first();
    const answers = applyProfileChange({ ...current.onboarding, weightKg: latestWeight?.value ?? current.onboarding.weightKg }, change);
    await saveOnboarding(ctx, profile, change.field === 'name' ? change.value : profile.displayName ?? 'You', answers, 'manual', Date.now(), change.field === 'weightKg');
    return null;
  },
});

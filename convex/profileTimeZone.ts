import { onboardingComplete } from '../domains/profile/onboarding';
import { ConvexError } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import { normalizeTimeZone } from './localCalendar';
import { assertOptionalTimeZone } from './notificationTypes';

export function validProfileTimeZone(value?: string): string | undefined {
  if (!value || value.length > 80 || !/^[A-Za-z][A-Za-z0-9_+./-]*$/.test(value)) return undefined;
  try {
    assertOptionalTimeZone(value);
    return new Intl.DateTimeFormat('en-US', { timeZone: normalizeTimeZone(value) }).resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function resolveProfileTimeZone(profileTimeZone?: string, legacyTimeZone?: string) {
  return validProfileTimeZone(profileTimeZone) ?? validProfileTimeZone(legacyTimeZone) ?? 'UTC';
}

export async function loadProfileTimeZone(ctx: QueryCtx, profileId: Id<'profiles'>) {
  const profile = await ctx.db.get(profileId);
  const timeZone = validProfileTimeZone(profile?.timeZone);
  if (timeZone) return timeZone;
  const preferences = await ctx.db.query('notificationPreferences')
    .withIndex('by_profile_id', q => q.eq('profileId', profileId)).unique();
  return resolveProfileTimeZone(undefined, preferences?.timeZone);
}

export async function updateProfileTimeZone(ctx: MutationCtx, profile: Doc<'profiles'>, requestedTimeZone: string) {
  const timeZone = validProfileTimeZone(requestedTimeZone);
  if (!timeZone) throw new ConvexError('Time zone must be a valid IANA name.');
  // Compare actual stored zones, not the UTC fallback: first-time UTC users
  // must establish the profile source even if today's resolved zone is UTC.
  if (validProfileTimeZone(profile.timeZone) === timeZone) return false;
  await ctx.db.patch(profile._id, { timeZone, updatedAt: Date.now() });
  if (onboardingComplete(profile)) {
    await ctx.scheduler.runAfter(0, internal.reedJourney.rebuildLatest, { profileId: profile._id, trigger: 'onboarding_updated' });
    await ctx.scheduler.runAfter(0, internal.profileInsight.markStale, { profileId: profile._id, reason: 'profile_updated' });
  }
  return true;
}

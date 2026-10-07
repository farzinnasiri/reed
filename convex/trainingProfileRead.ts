import type { Doc } from './_generated/dataModel';
import { startingWeeklyTarget } from '../domains/profile/onboarding';

export function trainingCadence(profile: Doc<'trainingProfiles'> | null) {
  return { weeklyActiveDaysTarget: profile?.onboarding ? startingWeeklyTarget(profile.onboarding) ?? undefined : undefined };
}

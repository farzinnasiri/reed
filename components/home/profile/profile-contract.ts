import type { FunctionReturnType } from 'convex/server';
import type { api } from '@/convex/_generated/api';

export type StoredTrainingProfile = NonNullable<
  FunctionReturnType<typeof api.profiles.viewerTrainingProfile>
>;
export type ProfileSection = 'body' | 'practices' | 'training' | 'preferences' | 'account';
export type ProfileEditorId = 'name' | 'born' | 'height' | 'weight' | 'sex' | 'shape' | 'bodymap' | 'values' | 'worlds' | `world:${import('@/components/onboarding/content').CategoryId}` | 'week' | 'rhythm' | 'push' | 'sleep' | 'day' | 'notes';

export function weeklyActiveDaysProse(days: number) {
  return `${days} active ${days === 1 ? 'day' : 'days'} a week`;
}

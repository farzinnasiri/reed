import { reedAccentPalettes, type ReedAccent } from './system';

export type AccentChoice = ReedAccent | 'automatic';
export type AccentPreference = { choice: AccentChoice; automatic: ReedAccent };
export const DEFAULT_ACCENT_PREFERENCE: AccentPreference = { choice: 'automatic', automatic: 'blue' };
const isAccent = (value: unknown): value is ReedAccent => typeof value === 'string' && Object.hasOwn(reedAccentPalettes, value);
export function accentForGender(gender: string | null | undefined): ReedAccent {
  if (gender === 'female') return 'rose';
  if (['other', 'private', 'nonbinary', 'prefer_not_to_say'].includes(gender ?? '')) return 'sage';
  return 'blue';
}
export function parseAccentPreference(raw: string | null): AccentPreference | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && (value.choice === 'automatic' || isAccent(value.choice)) && isAccent(value.automatic)
      ? { choice: value.choice, automatic: value.automatic } : null;
  } catch { return null; }
}
export function resolveAccent(preference: AccentPreference): ReedAccent {
  return preference.choice === 'automatic' ? preference.automatic : preference.choice;
}

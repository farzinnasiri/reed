import { getLocalParts, localDayNumber, normalizeTimeZone } from './localCalendar';

export const WEIGH_IN_BEFORE_HOUR = 12;
export const WEIGH_IN_MIN_LOCAL_DAYS = 3;
export const RECOVERY_TRAINING_DAYS = 2;
export const MAX_QUICK_LOG_PRESETS = 5;
export const DEFAULT_QUICK_LOG_KEYS = ['walk', 'mobility', 'stretching', 'cycle', 'pull_ups'] as const;

export type TodayCard =
  | { kind: 'weigh_in'; lastKg: number | null; lastLoggedAt: number | null; reason: string }
  | { kind: 'quick_log'; presetKeys: string[]; reason: string };

type PresetUsage = { key: string; group: 'cardio' | 'recovery' | 'strength'; count: number; sortOrder: number };

export function selectTodayPresetKeys(enabledPresets: PresetUsage[]) {
  const used = enabledPresets.filter(preset => preset.group !== 'strength' && preset.count > 0)
    .sort((a, b) => b.count - a.count || a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  const keys = new Set(used.slice(0, MAX_QUICK_LOG_PRESETS).map(preset => preset.key));
  for (const key of DEFAULT_QUICK_LOG_KEYS) {
    if (keys.size >= MAX_QUICK_LOG_PRESETS) break;
    if (enabledPresets.some(preset => preset.key === key)) keys.add(key);
  }
  return [...keys];
}

export function deriveTodayCards(args: {
  now: number;
  timeZone?: string;
  bodyweight: { latestKg: number; loggedAt: number } | null;
  // Today first, followed by each preceding local day's activity count.
  activityCounts: number[];
  presetKeys: string[];
}): TodayCard[] {
  const cards: TodayCard[] = [];
  const timeZone = normalizeTimeZone(args.timeZone);
  const age = args.bodyweight ? localDayNumber(args.now, timeZone) - localDayNumber(args.bodyweight.loggedAt, timeZone) : null;
  if (getLocalParts(args.now, timeZone).hour < WEIGH_IN_BEFORE_HOUR && (age === null || age >= WEIGH_IN_MIN_LOCAL_DAYS)) {
    cards.push({
      kind: 'weigh_in', lastKg: args.bodyweight?.latestKg ?? null, lastLoggedAt: args.bodyweight?.loggedAt ?? null,
      reason: 'Weigh-ins are best before breakfast',
    });
  }
  if (args.activityCounts[0] === 0 && Array.from({ length: RECOVERY_TRAINING_DAYS }, (_, index) => args.activityCounts[index + 1])
    .every(count => count > 0)) {
    cards.push({ kind: 'quick_log', presetKeys: args.presetKeys.slice(0, MAX_QUICK_LOG_PRESETS), reason: 'Logs straight to today' });
  }
  return cards;
}

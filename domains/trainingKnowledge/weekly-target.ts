export type WeeklyActiveDaysTarget = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function resolveWeeklyActiveDaysTarget(reality: { weeklyActiveDaysTarget?: number }): WeeklyActiveDaysTarget | null {
  const target = reality.weeklyActiveDaysTarget;
  return target !== undefined && Number.isInteger(target) && target >= 1 && target <= 7 ? target as WeeklyActiveDaysTarget : null;
}

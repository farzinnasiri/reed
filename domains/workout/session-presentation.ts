import {
  resolveWeeklyMuscleGroups,
  weeklyMuscleGroupLabels,
  type WeeklyMuscleGroupId,
} from './weekly-muscle-stats';

export type SessionCategory =
  | 'upper-body'
  | 'lower-body'
  | 'full-body'
  | 'cardio'
  | 'mixed'
  | 'other'
  | 'unlogged';
export type SessionPresentation = {
  title: string;
  category: SessionCategory;
  areas: string[];
  completedExercises: number;
  sets: number;
};

/** Recognition comes from performed work, never from exercises that were only added. */
export function presentSession(
  exercises: {
    exerciseName: string;
    setCount: number;
    isCardio: boolean;
    mainMuscleGroups: string[];
  }[],
  planTitle?: string | null,
): SessionPresentation {
  const logged = exercises.filter((exercise) => exercise.setCount > 0);
  const sets = logged.reduce((total, exercise) => total + exercise.setCount, 0);
  const groups = new Map<WeeklyMuscleGroupId, number>();
  for (const exercise of logged) {
    for (const group of resolveWeeklyMuscleGroups(exercise)) {
      groups.set(group, (groups.get(group) ?? 0) + exercise.setCount);
    }
  }
  const areas = [...groups]
    .filter(([id]) => id !== 'other' && id !== 'cardio')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => weeklyMuscleGroupLabels[id]);
  const cardio = logged.filter((exercise) => exercise.isCardio).length;
  const upper = ['chest', 'back', 'shoulders', 'arms'].some((id) =>
    groups.has(id as WeeklyMuscleGroupId),
  );
  const lower = groups.has('legs');
  const category: SessionCategory = !sets
    ? 'unlogged'
    : cardio === logged.length
      ? 'cardio'
      : cardio > 0
        ? 'mixed'
        : upper && lower
          ? 'full-body'
          : lower
            ? 'lower-body'
            : upper
              ? 'upper-body'
              : 'other';
  const titles: Record<SessionCategory, string> = {
    'upper-body': 'Upper body',
    'lower-body': 'Lower body',
    'full-body': 'Full body',
    cardio: 'Cardio',
    mixed: 'Strength + cardio',
    other: 'Workout',
    unlogged: 'Unlogged session',
  };
  const title =
    planTitle?.trim() ||
    (logged.length === 1 ? logged[0].exerciseName : titles[category]);
  return { title, category, areas, completedExercises: logged.length, sets };
}

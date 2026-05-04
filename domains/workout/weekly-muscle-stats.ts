import { getSetRepCount as getRecipeSetRepCount, roundMetric } from './recipes';

export type WeeklyMuscleGroupId = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'cardio' | 'other';
export type WeeklyGranularMuscleGroupId =
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves'
  | 'chest'
  | 'lats'
  | 'upperBack'
  | 'traps'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'cardio'
  | 'other';

export const weeklyPrimaryMuscleGroupOrder: WeeklyMuscleGroupId[] = [
  'arms',
  'shoulders',
  'chest',
  'back',
  'legs',
  'core',
  'cardio',
] as const;

export const weeklyMuscleGroupLabels: Record<WeeklyMuscleGroupId, string> = {
  arms: 'Arms',
  back: 'Back',
  cardio: 'Cardio',
  chest: 'Chest',
  core: 'Core',
  legs: 'Legs',
  other: 'Other',
  shoulders: 'Shoulders',
};

export const weeklyGranularMuscleGroupOrder: WeeklyGranularMuscleGroupId[] = [
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
  'chest',
  'lats',
  'upperBack',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'cardio',
  'other',
] as const;

export const weeklyGranularMuscleGroupLabels: Record<WeeklyGranularMuscleGroupId, string> = {
  adductors: 'Adductors',
  biceps: 'Biceps',
  calves: 'Calves',
  cardio: 'Cardio',
  chest: 'Chest',
  core: 'Core',
  forearms: 'Forearms',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
  lats: 'Lats',
  other: 'Other',
  quads: 'Quads',
  shoulders: 'Shoulders',
  traps: 'Traps',
  triceps: 'Triceps',
  upperBack: 'Upper back',
};

export function resolveWeeklyMuscleGroups(input: {
  isCardio: boolean;
  mainMuscleGroups: string[];
}): WeeklyMuscleGroupId[] {
  if (input.isCardio) {
    return ['cardio'];
  }

  const mapped = new Set<WeeklyMuscleGroupId>();

  for (const rawGroup of input.mainMuscleGroups) {
    mapped.add(toWeeklyMuscleGroupId(mapGranularMuscleGroup(rawGroup)));
  }

  if (mapped.size === 0) {
    return ['other'];
  }

  return Array.from(mapped);
}

export function resolveWeeklyGranularMuscleGroups(input: {
  isCardio: boolean;
  mainMuscleGroups: string[];
}): WeeklyGranularMuscleGroupId[] {
  if (input.isCardio) {
    return ['cardio'];
  }

  const mapped = new Set<WeeklyGranularMuscleGroupId>();

  for (const rawGroup of input.mainMuscleGroups) {
    mapped.add(mapGranularMuscleGroup(rawGroup));
  }

  if (mapped.size === 0) {
    return ['other'];
  }

  return Array.from(mapped);
}

export function getSetVolume(input: {
  derivedEffectiveLoadKg?: number | null;
  metrics: Record<string, number>;
}) {
  const reps = getRecipeSetRepCount(input.metrics);
  const derivedEffectiveLoadKg = finiteOrZero(input.derivedEffectiveLoadKg ?? 0);
  const load = finiteOrZero(input.metrics.load);
  const addedLoad = finiteOrZero(input.metrics.addedLoad);
  const assistLoad = finiteOrZero(input.metrics.assistLoad);

  if (reps > 0 && derivedEffectiveLoadKg > 0) {
    return roundMetric(derivedEffectiveLoadKg * reps);
  }

  if (reps > 0 && load > 0) {
    return roundMetric(load * reps);
  }

  if (reps > 0 && addedLoad > 0) {
    return roundMetric(addedLoad * reps);
  }

  if (reps > 0 && assistLoad > 0) {
    return roundMetric(assistLoad * reps);
  }

  const unilateralLoad = finiteOrZero(input.metrics.leftLoad) + finiteOrZero(input.metrics.rightLoad);
  if (reps > 0 && unilateralLoad > 0) {
    return roundMetric(unilateralLoad * reps);
  }

  return 0;
}

export function formatWeeklyVolume(value: number) {
  return `${Math.round(value).toLocaleString('en')} kg`;
}

export function getSetRepCount(metrics: Record<string, number>) {
  return getRecipeSetRepCount(metrics);
}

const granularMuscleGroupAliases: Record<string, WeeklyGranularMuscleGroupId> = {
  abs: 'core',
  adductors: 'adductors',
  anconeus: 'other',
  biceps: 'biceps',
  'biceps tendons': 'biceps',
  brachialis: 'forearms',
  brachioradialis: 'forearms',
  calves: 'calves',
  'cardiorespiratory system': 'other',
  core: 'core',
  'external rotators': 'shoulders',
  forearms: 'forearms',
  'front delts': 'shoulders',
  gastrocnemius: 'calves',
  'glute max': 'glutes',
  'glute med': 'glutes',
  'glute min': 'glutes',
  glutes: 'glutes',
  grip: 'forearms',
  hamstrings: 'hamstrings',
  'hip flexors': 'calves',
  hips: 'other',
  infraspinatus: 'shoulders',
  'intrinsic foot muscles': 'other',
  'lateral delts': 'shoulders',
  lats: 'lats',
  'levator scapulae': 'other',
  'lower pecs': 'chest',
  'lower traps': 'traps',
  'mid back': 'upperBack',
  'neck extensors': 'other',
  'neck flexors': 'other',
  obliques: 'other',
  pecs: 'chest',
  'quadratus lumborum': 'core',
  quads: 'quads',
  'rear delts': 'shoulders',
  'rectus abdominis': 'core',
  'rectus femoris': 'quads',
  rhomboids: 'upperBack',
  'rotator cuff': 'shoulders',
  serratus: 'chest',
  shoulders: 'shoulders',
  soleus: 'calves',
  'spinal erectors': 'upperBack',
  stabilizers: 'other',
  supraspinatus: 'shoulders',
  'tensor fasciae latae': 'other',
  'teres major': 'other',
  'teres minor': 'shoulders',
  thumbs: 'other',
  'tibialis anterior': 'other',
  'tibialis posterior': 'other',
  tfl: 'other',
  traps: 'traps',
  'transverse abdominis': 'core',
  triceps: 'triceps',
  'triceps long head': 'triceps',
  'upper back': 'upperBack',
  'upper chest': 'chest',
  'upper traps': 'traps',
  vmo: 'quads',
  'wrist extensors': 'other',
  'wrist flexors': 'other',
};

function mapGranularMuscleGroup(rawGroup: string): WeeklyGranularMuscleGroupId {
  const normalized = normalizeMuscleGroupToken(rawGroup);
  const alias = granularMuscleGroupAliases[normalized];
  if (alias) {
    return alias;
  }

  // Legacy/free-text fallback. Catalog values should be handled by the exact alias table above.
  if (normalized.includes('wrist') || normalized.includes('thumb') || normalized.includes('tibialis') || normalized.includes('neck')) {
    return 'other';
  }

  if (normalized.includes('quad') || normalized.includes('vastus')) {
    return 'quads';
  }

  if (normalized.includes('hamstring')) {
    return 'hamstrings';
  }

  if (normalized.includes('glute')) {
    return 'glutes';
  }

  if (normalized.includes('adductor')) {
    return 'adductors';
  }

  if (normalized.includes('calf') || normalized.includes('soleus') || normalized.includes('gastrocnemius')) {
    return 'calves';
  }

  if (normalized.includes('pec') || normalized.includes('chest')) {
    return 'chest';
  }

  if (normalized.includes('lat')) {
    return 'lats';
  }

  if (normalized.includes('trap')) {
    return 'traps';
  }

  if (normalized.includes('back') || normalized.includes('rhomboid') || normalized.includes('erector')) {
    return 'upperBack';
  }

  if (normalized.includes('delt') || normalized.includes('shoulder') || normalized.includes('rotator')) {
    return 'shoulders';
  }

  if (normalized.includes('biceps')) {
    return 'biceps';
  }

  if (normalized.includes('triceps')) {
    return 'triceps';
  }

  if (normalized.includes('brach') || normalized.includes('forearm') || normalized === 'grip') {
    return 'forearms';
  }

  if (normalized.includes('core') || normalized === 'abs' || normalized.includes('abdominis')) {
    return 'core';
  }

  return 'other';
}

function normalizeMuscleGroupToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

function toWeeklyMuscleGroupId(granularGroup: WeeklyGranularMuscleGroupId): WeeklyMuscleGroupId {
  switch (granularGroup) {
    case 'quads':
    case 'hamstrings':
    case 'glutes':
    case 'adductors':
    case 'calves':
      return 'legs';
    case 'lats':
    case 'upperBack':
    case 'traps':
      return 'back';
    case 'biceps':
    case 'triceps':
    case 'forearms':
      return 'arms';
    case 'chest':
      return 'chest';
    case 'shoulders':
      return 'shoulders';
    case 'core':
      return 'core';
    case 'cardio':
      return 'cardio';
    default:
      return 'other';
  }
}

function finiteOrZero(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export type WeeklyStatsLogInput = {
  derivedEffectiveLoadKg?: number | null;
  exerciseCatalogId: string;
  metrics: Record<string, number>;
};

export type WeeklyStatsExerciseInput = {
  exerciseCatalogId: string;
  isCardio: boolean;
  mainMuscleGroups: string[];
};

type WeeklyStatsGroupTotals<GroupId extends string> = {
  groupId: GroupId;
  reps: number;
  setCount: number;
  volume: number;
};

export function buildWeeklyMuscleStats(args: {
  exercises: WeeklyStatsExerciseInput[];
  logs: WeeklyStatsLogInput[];
  weekEndAt: number;
  weekStartAt: number;
}) {
  const exerciseById = new Map(args.exercises.map(exercise => [exercise.exerciseCatalogId, exercise]));
  const totalsByGroup = new Map<WeeklyMuscleGroupId, WeeklyStatsGroupTotals<WeeklyMuscleGroupId>>();
  const totalsByGranularGroup = new Map<
    WeeklyGranularMuscleGroupId,
    WeeklyStatsGroupTotals<WeeklyGranularMuscleGroupId>
  >();
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;

  for (const log of args.logs) {
    const catalogExercise = exerciseById.get(log.exerciseCatalogId) ?? null;
    const targetGroups = resolveWeeklyMuscleGroups({
      isCardio: Boolean(catalogExercise?.isCardio),
      mainMuscleGroups: catalogExercise?.mainMuscleGroups ?? [],
    });
    const targetGranularGroups = resolveWeeklyGranularMuscleGroups({
      isCardio: Boolean(catalogExercise?.isCardio),
      mainMuscleGroups: catalogExercise?.mainMuscleGroups ?? [],
    });

    const setReps = getSetRepCount(log.metrics);
    const setVolume = getSetVolume({
      derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
      metrics: log.metrics,
    });
    totalSets += 1;
    totalReps += setReps;
    totalVolume += setVolume;

    addWeeklyStatsTotals(totalsByGroup, targetGroups, setReps, setVolume);
    addWeeklyStatsTotals(totalsByGranularGroup, targetGranularGroups, setReps, setVolume);
  }

  return {
    groups: buildOrderedWeeklyStatsRows(totalsByGroup, weeklyPrimaryMuscleGroupOrder, weeklyMuscleGroupLabels),
    granularGroups: buildOrderedWeeklyStatsRows(
      totalsByGranularGroup,
      weeklyGranularMuscleGroupOrder,
      weeklyGranularMuscleGroupLabels,
    ),
    totalReps: roundMetric(totalReps),
    totalSets,
    totalVolume: roundMetric(totalVolume),
    weekEndAt: args.weekEndAt,
    weekStartAt: args.weekStartAt,
  };
}

function addWeeklyStatsTotals<GroupId extends string>(
  totalsByGroup: Map<GroupId, WeeklyStatsGroupTotals<GroupId>>,
  groupIds: GroupId[],
  setReps: number,
  setVolume: number,
) {
  const divisor = Math.max(1, groupIds.length);
  const repsContribution = roundMetric(setReps / divisor);
  const setContribution = roundMetric(1 / divisor);
  const volumeContribution = roundMetric(setVolume / divisor);

  for (const groupId of groupIds) {
    const existing = totalsByGroup.get(groupId);
    if (existing) {
      existing.reps = roundMetric(existing.reps + repsContribution);
      existing.setCount = roundMetric(existing.setCount + setContribution);
      existing.volume = roundMetric(existing.volume + volumeContribution);
      continue;
    }

    totalsByGroup.set(groupId, {
      groupId,
      reps: repsContribution,
      setCount: setContribution,
      volume: volumeContribution,
    });
  }
}

function buildOrderedWeeklyStatsRows<GroupId extends string>(
  totalsByGroup: Map<GroupId, WeeklyStatsGroupTotals<GroupId>>,
  primaryOrder: readonly GroupId[],
  labels: Record<GroupId, string>,
) {
  return [
    ...primaryOrder.map(groupId => {
      const group = totalsByGroup.get(groupId);
      return {
        groupId,
        label: labels[groupId],
        reps: group?.reps ?? 0,
        setCount: group?.setCount ?? 0,
        volume: group?.volume ?? 0,
      };
    }),
    ...Array.from(totalsByGroup.values())
      .filter(group => !primaryOrder.includes(group.groupId))
      .map(group => ({
        ...group,
        label: labels[group.groupId],
      })),
  ];
}

import { roundMetric } from './recipes';

export type WeeklyMuscleGroupId = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'cardio' | 'other';

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

export function resolveWeeklyMuscleGroups(input: {
  isCardio: boolean;
  mainMuscleGroups: string[];
}): WeeklyMuscleGroupId[] {
  if (input.isCardio) {
    return ['cardio'];
  }

  const mapped = new Set<WeeklyMuscleGroupId>();

  for (const rawGroup of input.mainMuscleGroups) {
    mapped.add(mapMuscleGroup(rawGroup));
  }

  if (mapped.size === 0) {
    return ['other'];
  }

  return Array.from(mapped);
}

export function getSetRepCount(metrics: Record<string, number>) {
  const reps = finiteOrZero(metrics.reps) + finiteOrZero(metrics.leftReps) + finiteOrZero(metrics.rightReps);
  return roundMetric(reps);
}

export function getSetVolume(metrics: Record<string, number>) {
  const reps = finiteOrZero(metrics.reps);
  const load = finiteOrZero(metrics.load);
  const addedLoad = finiteOrZero(metrics.addedLoad);
  const assistLoad = finiteOrZero(metrics.assistLoad);

  if (reps > 0 && load > 0) {
    return roundMetric(load * reps);
  }

  if (reps > 0 && addedLoad > 0) {
    return roundMetric(addedLoad * reps);
  }

  if (reps > 0 && assistLoad > 0) {
    return roundMetric(assistLoad * reps);
  }

  const unilateralLoad = finiteOrZero(metrics.leftLoad) + finiteOrZero(metrics.rightLoad);
  if (reps > 0 && unilateralLoad > 0) {
    return roundMetric(unilateralLoad * reps);
  }

  return 0;
}

export function formatWeeklyVolume(value: number) {
  return `${Math.round(value).toLocaleString('en')} kg`;
}

function mapMuscleGroup(rawGroup: string): WeeklyMuscleGroupId {
  const normalized = rawGroup.trim().toLowerCase();

  if (
    normalized.includes('quad') ||
    normalized.includes('hamstring') ||
    normalized.includes('glute') ||
    normalized.includes('adductor') ||
    normalized.includes('calf') ||
    normalized.includes('soleus') ||
    normalized.includes('gastrocnemius') ||
    normalized.includes('tibialis') ||
    normalized.includes('hip flexor') ||
    normalized.includes('rectus femoris') ||
    normalized.includes('vmo')
  ) {
    return 'legs';
  }

  if (
    normalized.includes('pec') ||
    normalized.includes('chest') ||
    normalized.includes('serratus')
  ) {
    return 'chest';
  }

  if (
    normalized.includes('delt') ||
    normalized === 'shoulders' ||
    normalized.includes('rotator cuff') ||
    normalized.includes('external rotator') ||
    normalized.includes('infraspinatus') ||
    normalized.includes('teres minor')
  ) {
    return 'shoulders';
  }

  if (
    normalized.includes('lat') ||
    normalized.includes('back') ||
    normalized.includes('trap') ||
    normalized.includes('rhomboid') ||
    normalized.includes('spinal erector') ||
    normalized.includes('teres major')
  ) {
    return 'back';
  }

  if (
    normalized.includes('biceps') ||
    normalized.includes('triceps') ||
    normalized.includes('brachialis') ||
    normalized.includes('brachioradialis') ||
    normalized.includes('forearm') ||
    normalized.includes('wrist') ||
    normalized.includes('thumb') ||
    normalized === 'grip'
  ) {
    return 'arms';
  }

  if (
    normalized.includes('core') ||
    normalized === 'abs' ||
    normalized.includes('oblique') ||
    normalized.includes('transverse abdominis') ||
    normalized.includes('rectus abdominis') ||
    normalized.includes('quadratus lumborum')
  ) {
    return 'core';
  }

  return 'other';
}

function finiteOrZero(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export const exerciseFocusAreas = [
  'abs-core',
  'arms',
  'back',
  'cardio',
  'chest',
  'full-body',
  'grip',
  'legs',
  'mobility',
  'shoulders',
] as const;

export type ExerciseFocusArea = (typeof exerciseFocusAreas)[number];

export const exerciseFocusAreaLabels: Record<ExerciseFocusArea, string> = {
  'abs-core': 'Abs/Core',
  arms: 'Arms',
  back: 'Back',
  cardio: 'Cardio',
  chest: 'Chest',
  'full-body': 'Full Body',
  grip: 'Grip',
  legs: 'Legs',
  mobility: 'Mobility',
  shoulders: 'Shoulders',
};

export const exerciseTargetAreas = [
  'abs',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'core-stability',
  'forearms-wrists',
  'front-delts',
  'glutes',
  'hamstrings',
  'lats',
  'lower-back',
  'neck',
  'obliques',
  'quads',
  'rear-delts',
  'side-delts',
  'traps',
  'triceps',
  'upper-back',
] as const;

export type ExerciseTargetArea = (typeof exerciseTargetAreas)[number];

export const exerciseTargetAreaLabels: Record<ExerciseTargetArea, string> = {
  abs: 'Abs',
  adductors: 'Adductors',
  biceps: 'Biceps',
  calves: 'Calves',
  chest: 'Chest',
  'core-stability': 'Core Stability',
  'forearms-wrists': 'Forearms/Wrists',
  'front-delts': 'Front Delts',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
  lats: 'Lats',
  'lower-back': 'Lower Back',
  neck: 'Neck',
  obliques: 'Obliques',
  quads: 'Quads',
  'rear-delts': 'Rear Delts',
  'side-delts': 'Side Delts',
  traps: 'Traps',
  triceps: 'Triceps',
  'upper-back': 'Upper Back',
};

export const exerciseTargetAreaParents: Record<ExerciseTargetArea, ExerciseFocusArea[]> = {
  abs: ['abs-core'],
  adductors: ['legs'],
  biceps: ['arms'],
  calves: ['legs'],
  chest: ['chest'],
  'core-stability': ['abs-core'],
  'forearms-wrists': ['arms', 'grip'],
  'front-delts': ['shoulders'],
  glutes: ['legs'],
  hamstrings: ['legs'],
  lats: ['back'],
  'lower-back': ['back'],
  neck: ['shoulders'],
  obliques: ['abs-core'],
  quads: ['legs'],
  'rear-delts': ['shoulders', 'back'],
  'side-delts': ['shoulders'],
  traps: ['back', 'shoulders'],
  triceps: ['arms'],
  'upper-back': ['back'],
};

export type ExerciseFocusInput = {
  canonicalFamily: string;
  contextTags: string[];
  equipment: string[];
  exerciseClass: string;
  exerciseId: string;
  isCardio: boolean;
  isHold: boolean;
  mainMuscleGroups: string[];
  movementPatterns: string[];
  name: string;
  primaryModality?: string;
  secondaryMuscleGroups: string[];
  skillTags: string[];
};

export type ExerciseFocusAreas = {
  primaryFocusAreas: ExerciseFocusArea[];
  primaryTargetAreas: ExerciseTargetArea[];
  secondaryFocusAreas: ExerciseFocusArea[];
  secondaryTargetAreas: ExerciseTargetArea[];
};

const explicitOverrides: Record<string, ExerciseFocusAreas> = {
  'ab-crunch-machine': primary(['abs-core'], ['abs']),
  'bar-muscle-up': focus(['back', 'chest', 'arms'], ['abs-core'], ['lats', 'chest', 'triceps', 'biceps'], ['core-stability']),
  'cable-crunch': primary(['abs-core'], ['abs']),
  crunch: primary(['abs-core'], ['abs']),
  dip: focus(['chest', 'arms'], ['abs-core'], ['chest', 'triceps'], ['core-stability']),
  'ghd-sit-up': primary(['abs-core'], ['abs']),
  'incline-crunch': primary(['abs-core'], ['abs']),
  'kipping-pull-up': focus(['back', 'arms'], ['abs-core'], ['lats', 'biceps'], ['core-stability']),
  'l-sit-pull-up': focus(['back', 'arms'], ['abs-core'], ['lats', 'biceps'], ['abs']),
  'machine-ab-crunch': primary(['abs-core'], ['abs']),
  'ring-dip': focus(['chest', 'arms'], ['abs-core'], ['chest', 'triceps'], ['core-stability']),
  'ring-muscle-up': focus(['back', 'chest', 'arms'], ['abs-core'], ['lats', 'chest', 'triceps', 'biceps'], ['core-stability']),
  'sit-up': primary(['abs-core'], ['abs']),
  'weighted-bar-muscle-up': focus(['back', 'chest', 'arms'], ['abs-core'], ['lats', 'chest', 'triceps', 'biceps'], ['core-stability']),
  'weighted-crunch': primary(['abs-core'], ['abs']),
  'weighted-dip': focus(['chest', 'arms'], ['abs-core'], ['chest', 'triceps'], ['core-stability']),
};

export function resolveExerciseFocusAreas(input: ExerciseFocusInput): ExerciseFocusAreas {
  const override = explicitOverrides[input.exerciseId];
  if (override) {
    return override;
  }

  const text = normalizeTokens([
    input.canonicalFamily,
    input.exerciseClass,
    input.exerciseId,
    input.name,
    input.primaryModality ?? '',
    ...input.movementPatterns,
    ...input.skillTags,
  ]);
  const main = normalizeTokens(input.mainMuscleGroups);
  const secondary = normalizeTokens(input.secondaryMuscleGroups);
  const primaryFocus = new Set<ExerciseFocusArea>();
  const secondaryFocus = new Set<ExerciseFocusArea>();
  const primaryTargets = new Set<ExerciseTargetArea>();
  const secondaryTargets = new Set<ExerciseTargetArea>();

  addAll(primaryFocus, mapAnatomyToFocus(main));
  addAll(secondaryFocus, mapAnatomyToFocus(secondary));
  addAll(primaryTargets, mapAnatomyToTarget(main, text));
  addAll(secondaryTargets, mapAnatomyToTarget(secondary, text));

  if (input.isCardio || input.exerciseClass.includes('cardio')) {
    return {
      primaryFocusAreas: ['cardio'],
      primaryTargetAreas: [],
      secondaryFocusAreas: sortFocusAreas(new Set(primaryFocus)),
      secondaryTargetAreas: sortTargetAreas(primaryTargets),
    };
  }

  if (
    input.exerciseClass.includes('mobility')
    || input.canonicalFamily.includes('stretch')
    || input.name.toLowerCase().includes('stretch')
  ) {
    return {
      primaryFocusAreas: ['mobility'],
      primaryTargetAreas: [],
      secondaryFocusAreas: sortFocusAreas(new Set(primaryFocus)),
      secondaryTargetAreas: sortTargetAreas(primaryTargets),
    };
  }

  if (hasAny(text, ['carry', 'loaded carry', 'farmer', 'suitcase', 'yoke', 'zercher carry'])) {
    return {
      primaryFocusAreas: ['full-body', 'grip'],
      primaryTargetAreas: sortTargetAreas(new Set<ExerciseTargetArea>(['forearms-wrists'])),
      secondaryFocusAreas: sortFocusAreas(new Set([...primaryFocus, ...secondaryFocus])),
      secondaryTargetAreas: sortTargetAreas(new Set([...primaryTargets, ...secondaryTargets])),
    };
  }

  if (hasAny(text, ['sled', 'tire', 'atlas', 'clean', 'snatch', 'thruster', 'burpee', 'slam', 'turkish get-up', 'kettlebell swing', 'push press', 'push jerk', 'split jerk', 'wall walk'])) {
    return {
      primaryFocusAreas: ['full-body'],
      primaryTargetAreas: sortTargetAreas(primaryTargets),
      secondaryFocusAreas: sortFocusAreas(new Set([...primaryFocus, ...secondaryFocus])),
      secondaryTargetAreas: sortTargetAreas(secondaryTargets),
    };
  }

  if (hasAny(text, ['deadlift', 'hinge'])) {
    primaryFocus.add('back');
    primaryFocus.add('legs');
    primaryTargets.add('lower-back');
  }

  if (hasAny(text, ['squat', 'lunge', 'split squat', 'leg press'])) {
    primaryFocus.add('legs');
  }

  if (hasAny(text, ['push-up', 'dip', 'bench press', 'chest press'])) {
    primaryFocus.add('chest');
    primaryFocus.add('arms');
  }

  if (hasAny(text, ['pull-up', 'chin-up', 'row', 'pulldown', 'muscle-up'])) {
    primaryFocus.add('back');
    primaryFocus.add('arms');
  }

  if (hasAny(text, ['plank', 'hollow', 'pallof', 'ab wheel', 'leg raise', 'dragon flag', 'windshield', 'russian twist', 'sit-up', 'crunch'])) {
    primaryFocus.add('abs-core');
    primaryTargets.add('abs');
  }

  if (hasAny(text, ['grip', 'farmer', 'towel'])) {
    primaryFocus.add('grip');
  }

  if (primaryFocus.size === 0 && secondaryFocus.size > 0) {
    const fallback = Array.from(secondaryFocus).filter(area => area !== 'abs-core');
    addAll(primaryFocus, fallback.length > 0 ? fallback : Array.from(secondaryFocus));
  }

  if (primaryFocus.size === 0) {
    primaryFocus.add('full-body');
  }

  for (const area of primaryFocus) {
    secondaryFocus.delete(area);
  }

  for (const area of primaryTargets) {
    secondaryTargets.delete(area);
  }

  return {
    primaryFocusAreas: sortFocusAreas(primaryFocus),
    primaryTargetAreas: sortTargetAreas(primaryTargets),
    secondaryFocusAreas: sortFocusAreas(secondaryFocus),
    secondaryTargetAreas: sortTargetAreas(secondaryTargets),
  };
}

export function normalizeExerciseFocusAreas(values: string[] | null | undefined) {
  if (!values || values.length === 0) {
    return [];
  }

  const valid = new Set<string>(exerciseFocusAreas);
  return Array.from(
    new Set(
      values
        .map(value => value.trim().toLowerCase())
        .filter(value => valid.has(value)),
    ),
  ) as ExerciseFocusArea[];
}

export function normalizeExerciseTargetAreas(values: string[] | null | undefined) {
  if (!values || values.length === 0) {
    return [];
  }

  const valid = new Set<string>(exerciseTargetAreas);
  return Array.from(
    new Set(
      values
        .map(value => value.trim().toLowerCase())
        .filter(value => valid.has(value)),
    ),
  ) as ExerciseTargetArea[];
}

function mapAnatomyToFocus(values: string[]) {
  const focus = new Set<ExerciseFocusArea>();

  for (const value of values) {
    if (includesAny(value, ['ab', 'core', 'oblique', 'quadratus'])) focus.add('abs-core');
    if (includesAny(value, ['pec', 'chest'])) focus.add('chest');
    if (includesAny(value, ['lat', 'back', 'trap', 'rhomboid', 'teres'])) focus.add('back');
    if (includesAny(value, ['delt', 'shoulder', 'rotator cuff'])) focus.add('shoulders');
    if (includesAny(value, ['bicep', 'tricep', 'brachialis', 'forearm'])) focus.add('arms');
    if (includesAny(value, ['grip'])) focus.add('grip');
    if (includesAny(value, ['quad', 'hamstring', 'calf', 'adductor', 'gastrocnemius', 'soleus', 'glute'])) focus.add('legs');
  }

  return Array.from(focus);
}

function mapAnatomyToTarget(values: string[], text: string[]) {
  const targets = new Set<ExerciseTargetArea>();

  for (const value of values) {
    if (includesAny(value, ['rectus abdominis', 'transverse abdominis', 'abs'])) targets.add('abs');
    if (includesAny(value, ['oblique', 'quadratus'])) targets.add('obliques');
    if (includesAny(value, ['core'])) targets.add('core-stability');
    if (includesAny(value, ['pec', 'chest'])) targets.add('chest');
    if (includesAny(value, ['lat', 'teres'])) targets.add('lats');
    if (includesAny(value, ['mid back', 'rhomboid'])) targets.add('upper-back');
    if (includesAny(value, ['lower back', 'spinal erector', 'erector'])) targets.add('lower-back');
    if (includesAny(value, ['trap'])) targets.add('traps');
    if (includesAny(value, ['front delt'])) targets.add('front-delts');
    if (includesAny(value, ['side delt', 'lateral delt'])) targets.add('side-delts');
    if (includesAny(value, ['rear delt'])) targets.add('rear-delts');
    if (includesAny(value, ['bicep', 'brachialis'])) targets.add('biceps');
    if (includesAny(value, ['tricep'])) targets.add('triceps');
    if (includesAny(value, ['forearm', 'wrist', 'grip'])) targets.add('forearms-wrists');
    if (includesAny(value, ['quad'])) targets.add('quads');
    if (includesAny(value, ['hamstring'])) targets.add('hamstrings');
    if (includesAny(value, ['calf', 'gastrocnemius', 'soleus'])) targets.add('calves');
    if (includesAny(value, ['adductor'])) targets.add('adductors');
    if (includesAny(value, ['glute'])) targets.add('glutes');
    if (includesAny(value, ['neck'])) targets.add('neck');
  }

  if (hasAny(text, ['plank', 'hollow', 'pallof', 'carry', 'hold', 'anti-rotation', 'anti-extension'])) {
    targets.add('core-stability');
  }

  return Array.from(targets);
}

function normalizeTokens(values: string[]) {
  return values.map(value => value.trim().toLowerCase()).filter(Boolean);
}

function hasAny(values: string[], needles: string[]) {
  return values.some(value => includesAny(value, needles));
}

function includesAny(value: string, needles: string[]) {
  return needles.some(needle => value.includes(needle));
}

function addAll<T>(target: Set<T>, values: T[]) {
  for (const value of values) {
    target.add(value);
  }
}

function sortFocusAreas(values: Set<ExerciseFocusArea>) {
  return exerciseFocusAreas.filter(area => values.has(area));
}

function sortTargetAreas(values: Set<ExerciseTargetArea>) {
  return exerciseTargetAreas.filter(area => values.has(area));
}

function primary(primaryFocusAreas: ExerciseFocusArea[], primaryTargetAreas: ExerciseTargetArea[] = []): ExerciseFocusAreas {
  return { primaryFocusAreas, primaryTargetAreas, secondaryFocusAreas: [], secondaryTargetAreas: [] };
}

function focus(
  primaryFocusAreas: ExerciseFocusArea[],
  secondaryFocusAreas: ExerciseFocusArea[],
  primaryTargetAreas: ExerciseTargetArea[] = [],
  secondaryTargetAreas: ExerciseTargetArea[] = [],
): ExerciseFocusAreas {
  return { primaryFocusAreas, primaryTargetAreas, secondaryFocusAreas, secondaryTargetAreas };
}

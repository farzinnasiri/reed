type BodyweightLoadFactorInput = {
  canonicalFamily: string;
  exerciseId: string;
  isHold: boolean;
  recipeKey?: string | null;
  usesBodyweight: boolean;
};

const recipeKeysWithBodyweightLoad = new Set([
  'bodyweight_reps',
  'assist_bodyweight',
  'added_bodyweight',
  'unilateral_reps_pair',
]);

export function isBodyweightLoadRecipeKey(recipeKey: string) {
  return recipeKeysWithBodyweightLoad.has(recipeKey);
}

const exerciseOverrides: Record<string, number> = {
  'decline-push-up': 0.7,
  'incline-push-up': 0.41,
  'kneeling-push-up': 0.49,
};

const canonicalFamilyFactors: Record<string, number> = {
  dip: 0.87,
  lunge: 0.75,
  'muscle-up': 1,
  'pull-up': 0.95,
  'push-up': 0.64,
  squat: 0.7,
  'split-squat': 0.75,
};

export function resolveBodyweightLoadFactor(input: BodyweightLoadFactorInput) {
  if (!input.usesBodyweight || input.isHold) {
    return null;
  }

  if (input.recipeKey && !recipeKeysWithBodyweightLoad.has(input.recipeKey)) {
    return null;
  }

  const exerciseOverride = exerciseOverrides[input.exerciseId];
  if (exerciseOverride !== undefined) {
    return exerciseOverride;
  }

  return canonicalFamilyFactors[input.canonicalFamily] ?? null;
}

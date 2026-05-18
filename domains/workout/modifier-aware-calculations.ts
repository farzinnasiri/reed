import type { RecipeKey } from './recipes';

export type RangeOfMotion = 'full' | 'top_partial' | 'bottom_partial' | 'mid_partial';

export type ExerciseSetupModifiers = {
  assistanceSupportKg?: number;
  inclineAngleDegrees?: number;
};

export type SetOutcomeDetails = {
  failedReps?: number;
  inclineAngleDegrees?: number;
  rangeOfMotion?: RangeOfMotion;
};

export type ModifierAwareCalculationInput = {
  derivedBodyweightKg?: number | null;
  derivedEffectiveLoadKg?: number | null;
  exerciseSetup?: ExerciseSetupModifiers | null;
  metrics: Record<string, number>;
  recipeKey: RecipeKey;
  setOutcome?: SetOutcomeDetails | null;
};

export type ModifierAwareCalculationContext = {
  derivedEffectiveLoadKg?: number | null;
  exerciseSetup?: ExerciseSetupModifiers | null;
  setOutcome?: SetOutcomeDetails | null;
};

export function buildModifierAwareCalculationInput(input: ModifierAwareCalculationInput): ModifierAwareCalculationInput {
  return {
    derivedBodyweightKg: input.derivedBodyweightKg ?? null,
    derivedEffectiveLoadKg: input.derivedEffectiveLoadKg ?? null,
    exerciseSetup: input.exerciseSetup ?? null,
    metrics: input.metrics,
    recipeKey: input.recipeKey,
    setOutcome: normalizeSetOutcomeDetails(input.setOutcome),
  };
}

export function resolveEffectiveLoadKg(input: ModifierAwareCalculationInput) {
  if (typeof input.derivedEffectiveLoadKg === 'number' && Number.isFinite(input.derivedEffectiveLoadKg)) {
    return roundMetric(input.derivedEffectiveLoadKg);
  }

  if (input.recipeKey === 'assist_bodyweight' && typeof input.derivedBodyweightKg === 'number') {
    const assistanceSupportKg = input.exerciseSetup?.assistanceSupportKg ?? input.metrics.assistLoad ?? 0;
    return roundMetric(Math.max(0, input.derivedBodyweightKg - assistanceSupportKg));
  }

  return null;
}

export function getCompletedRepCount(metrics: Record<string, number>) {
  return roundMetric((metrics.reps ?? 0) + (metrics.leftReps ?? 0) + (metrics.rightReps ?? 0));
}

export function getFailedRepCount(setOutcome: SetOutcomeDetails | null | undefined) {
  return Math.max(0, Math.round(setOutcome?.failedReps ?? 0));
}

export function getRangeOfMotionWorkMultiplier(setOutcome: SetOutcomeDetails | null | undefined) {
  switch (setOutcome?.rangeOfMotion) {
    case 'top_partial':
    case 'bottom_partial':
    case 'mid_partial':
      // Deliberately neutral for now. ROM is captured as a raw fact, but final
      // scoring needs a product decision per exercise before it changes volume,
      // PRs, or Training Knowledge.
      return 1;
    case 'full':
    default:
      return 1;
  }
}

export function getInclineAngleMuscleDistributionKey(exerciseSetup: ExerciseSetupModifiers | null | undefined) {
  const angle = exerciseSetup?.inclineAngleDegrees;
  if (typeof angle !== 'number' || !Number.isFinite(angle)) {
    return 'unspecified' as const;
  }

  if (angle < 20) {
    return 'low_incline' as const;
  }
  if (angle < 50) {
    return 'standard_incline' as const;
  }
  return 'high_incline' as const;
}

function roundMetric(value: number) {
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function normalizeSetOutcomeDetails(setOutcome: SetOutcomeDetails | null | undefined): SetOutcomeDetails | null {
  const normalized: SetOutcomeDetails = {};

  if (setOutcome?.rangeOfMotion && setOutcome.rangeOfMotion !== 'full') {
    normalized.rangeOfMotion = setOutcome.rangeOfMotion;
  }

  const failedReps = getFailedRepCount(setOutcome);
  if (failedReps > 0) {
    normalized.failedReps = failedReps;
  }

  if (typeof setOutcome?.inclineAngleDegrees === 'number' && Number.isFinite(setOutcome.inclineAngleDegrees)) {
    normalized.inclineAngleDegrees = Math.round(setOutcome.inclineAngleDegrees);
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

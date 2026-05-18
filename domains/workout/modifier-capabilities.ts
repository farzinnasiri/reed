export const setupModifierKeys = ['inclineAngle', 'assistanceSupport'] as const;
export const setOutcomeDetailKeys = ['failure', 'rangeOfMotion'] as const;

export type SetupModifierKey = (typeof setupModifierKeys)[number];
export type SetOutcomeDetailKey = (typeof setOutcomeDetailKeys)[number];

export type ExerciseModifierCapabilities = {
  setup: SetupModifierKey[];
  setOutcome: SetOutcomeDetailKey[];
};

import { resolveCatalogModifierOverride } from './catalog-modifier-overrides';

export type ExerciseCapabilityInput = {
  canonicalFamily?: string;
  equipment?: string[];
  exerciseId: string;
  name: string;
  recipeKey?: string | null;
};

export const emptyExerciseModifierCapabilities: ExerciseModifierCapabilities = {
  setup: [],
  setOutcome: [],
};

export function resolveExerciseModifierCapabilities(input: ExerciseCapabilityInput): ExerciseModifierCapabilities {
  const catalogOverride = resolveCatalogModifierOverride(input);

  return normalizeExerciseModifierCapabilities({
    setup: catalogOverride?.setup ?? [
      ...(supportsAssistanceSupport(input) ? ['assistanceSupport' as const] : []),
    ],
    setOutcome: supportsStrengthOutcomeDetails(input) ? ['failure', 'rangeOfMotion'] : [],
  });
}

export function normalizeExerciseModifierCapabilities(
  capabilities: Partial<ExerciseModifierCapabilities> | null | undefined,
): ExerciseModifierCapabilities {
  return {
    setup: dedupeKnownKeys(capabilities?.setup ?? [], setupModifierKeys),
    setOutcome: dedupeKnownKeys(capabilities?.setOutcome ?? [], setOutcomeDetailKeys),
  };
}

export function hasSetupModifierCapability(
  capabilities: Partial<ExerciseModifierCapabilities> | null | undefined,
  modifier: SetupModifierKey,
) {
  return normalizeExerciseModifierCapabilities(capabilities).setup.includes(modifier);
}

export function hasSetOutcomeDetailCapability(
  capabilities: Partial<ExerciseModifierCapabilities> | null | undefined,
  detail: SetOutcomeDetailKey,
) {
  return normalizeExerciseModifierCapabilities(capabilities).setOutcome.includes(detail);
}

function supportsAssistanceSupport(input: ExerciseCapabilityInput) {
  return input.recipeKey === 'assist_bodyweight';
}

function supportsStrengthOutcomeDetails(input: ExerciseCapabilityInput) {
  return Boolean(
    input.recipeKey &&
      !input.recipeKey.startsWith('cardio_') &&
      input.recipeKey !== 'hold' &&
      input.recipeKey !== 'weighted_hold' &&
      input.recipeKey !== 'mobility_duration_intensity',
  );
}

function dedupeKnownKeys<T extends string>(values: readonly string[], knownKeys: readonly T[]): T[] {
  const known = new Set<string>(knownKeys);
  return Array.from(new Set(values.filter((value): value is T => known.has(value))));
}

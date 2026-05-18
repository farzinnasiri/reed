import type { ExerciseModifierCapabilities } from './modifier-capabilities';

export type CatalogModifierOverrideInput = {
  canonicalFamily?: string;
  exerciseId: string;
  name: string;
  recipeKey?: string | null;
};

const inclineFamilyHints = [
  'incline-press',
  'incline-bench-press',
  'incline-dumbbell-press',
  'incline-chest-press',
  'seated-curl',
  'preacher-curl',
];

const inclineNameHints = ['incline', 'seated', 'preacher'];

export function resolveCatalogModifierOverride(
  input: CatalogModifierOverrideInput,
): Partial<ExerciseModifierCapabilities> | null {
  const setup: ExerciseModifierCapabilities['setup'] = [];

  if (supportsInclineAngle(input)) {
    setup.push('inclineAngle');
  }

  if (input.recipeKey === 'assist_bodyweight') {
    setup.push('assistanceSupport');
  }

  return setup.length > 0 ? { setup } : null;
}

function supportsInclineAngle(input: CatalogModifierOverrideInput) {
  const family = normalize(input.canonicalFamily);
  const name = normalize(input.name);
  const exerciseId = normalize(input.exerciseId);

  return (
    inclineFamilyHints.some(hint => family.includes(hint) || exerciseId.includes(hint)) ||
    inclineNameHints.some(hint => name.includes(hint))
  );
}

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

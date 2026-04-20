import { mapCsvMetricRecipe } from './recipes';

export type RawCatalogCsvRow = {
  aliases: string;
  body_position: string;
  canonical_family: string;
  context_tags: string;
  default_summary_format: string;
  equipment: string;
  exercise_class: string;
  exercise_id: string;
  force_type: string;
  is_cardio: string;
  is_hold: string;
  joints_emphasized: string;
  laterality: string;
  load_type: string;
  main_muscle_groups: string;
  metric_recipe: string;
  movement_pattern: string;
  name: string;
  notes: string;
  primary_modality: string;
  search_text: string;
  secondary_muscle_groups: string;
  skill_tags: string;
  supports_live_tracking: string;
  uses_bodyweight: string;
};

export type NormalizedCatalogRow = ReturnType<typeof normalizeCatalogRow>;

export function normalizeCatalogRow(row: RawCatalogCsvRow) {
  const recipeKey = mapCsvMetricRecipe(row.metric_recipe);

  return {
    aliases: splitPipeList(row.aliases),
    bodyPosition: normalizeOptionalString(row.body_position),
    canonicalFamily: row.canonical_family.trim(),
    contextTags: splitPipeList(row.context_tags),
    defaultSummaryFormat: normalizeOptionalString(row.default_summary_format),
    equipment: splitPipeList(row.equipment),
    exerciseClass: row.exercise_class.trim(),
    exerciseId: row.exercise_id.trim(),
    forceType: normalizeOptionalString(row.force_type),
    isCardio: parseBooleanFlag(row.is_cardio),
    isHold: parseBooleanFlag(row.is_hold),
    isSupportedInLiveSession: recipeKey !== null,
    jointsEmphasized: splitPipeList(row.joints_emphasized),
    laterality: normalizeOptionalString(row.laterality),
    loadType: normalizeOptionalString(row.load_type),
    mainMuscleGroups: splitPipeList(row.main_muscle_groups),
    movementPatterns: splitPipeList(row.movement_pattern),
    name: row.name.trim(),
    notes: normalizeOptionalString(row.notes),
    primaryModality: normalizeOptionalString(row.primary_modality),
    rawMetricRecipe: row.metric_recipe.trim(),
    recipeKey,
    searchText: row.search_text.trim(),
    secondaryMuscleGroups: splitPipeList(row.secondary_muscle_groups),
    skillTags: splitPipeList(row.skill_tags),
    supportsLiveTracking: parseBooleanFlag(row.supports_live_tracking),
    usesBodyweight: parseBooleanFlag(row.uses_bodyweight),
  };
}

export function splitPipeList(value: string) {
  return Array.from(
    new Set(
      value
        .split('|')
        .map(item => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBooleanFlag(value: string) {
  return value.trim().toLowerCase() === 'true';
}

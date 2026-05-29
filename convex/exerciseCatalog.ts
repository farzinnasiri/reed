import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';
import { resolveBodyweightLoadFactor } from '../domains/workout/bodyweight-load-factors';
import {
  type ExerciseFocusArea,
  type ExerciseTargetArea,
  exerciseFocusAreaLabels,
  exerciseFocusAreas,
  exerciseTargetAreaLabels,
  exerciseTargetAreaParents,
  exerciseTargetAreas,
  normalizeExerciseFocusAreas,
  normalizeExerciseTargetAreas,
  resolveExerciseFocusAreas,
} from '../domains/workout/exercise-focus';
import {
  normalizeExerciseModifierCapabilities,
  resolveExerciseModifierCapabilities,
} from '../domains/workout/modifier-capabilities';
import { resolveCatalogRecipeKey, type RecipeKey } from '../domains/workout/recipes';
import { recipeKeyOrNullValidator } from './workoutValidators';

const optionalMultiFilterValidator = v.optional(v.union(v.array(v.string()), v.null()));

const importRowValidator = v.object({
  aliases: v.array(v.string()),
  bodyPosition: v.optional(v.string()),
  canonicalFamily: v.string(),
  contextTags: v.array(v.string()),
  discoveryTags: v.array(v.string()),
  defaultSummaryFormat: v.optional(v.string()),
  equipment: v.array(v.string()),
  exerciseClass: v.string(),
  exerciseId: v.string(),
  forceType: v.optional(v.string()),
  isCardio: v.boolean(),
  isHold: v.boolean(),
  isSupportedInLiveSession: v.boolean(),
  jointsEmphasized: v.array(v.string()),
  laterality: v.optional(v.string()),
  loadType: v.optional(v.string()),
  mainMuscleGroups: v.array(v.string()),
  movementPatterns: v.array(v.string()),
  name: v.string(),
  notes: v.optional(v.string()),
  primaryModality: v.optional(v.string()),
  rawMetricRecipe: v.string(),
  recipeKey: v.optional(recipeKeyOrNullValidator),
  searchText: v.string(),
  secondaryMuscleGroups: v.array(v.string()),
  primaryFocusAreas: v.optional(v.array(v.string())),
  secondaryFocusAreas: v.optional(v.array(v.string())),
  primaryTargetAreas: v.optional(v.array(v.string())),
  secondaryTargetAreas: v.optional(v.array(v.string())),
  skillTags: v.array(v.string()),
  supportsLiveTracking: v.boolean(),
  usesBodyweight: v.boolean(),
});

type SupportedExercise = Doc<'exerciseCatalog'> & {
  recipeKey: RecipeKey;
};

export const searchForAddSheet = query({
  args: {
    equipment: optionalMultiFilterValidator,
    focusAreas: optionalMultiFilterValidator,
    muscleGroups: optionalMultiFilterValidator,
    targetAreas: optionalMultiFilterValidator,
    query: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const queryText = args.query?.trim().toLowerCase() ?? '';
    const selectedFocusAreas = normalizeExerciseFocusAreas(args.focusAreas ?? args.muscleGroups);
    const selectedTargetAreas = normalizeExerciseTargetAreas(args.targetAreas);
    const selectedEquipment = normalizeMultiFilters(args.equipment);
    const hasSearchContext =
      queryText.length > 0 || selectedFocusAreas.length > 0 || selectedTargetAreas.length > 0 || selectedEquipment.length > 0;
    const exercises: SupportedExercise[] = await loadSearchContextExercises(ctx, queryText, hasSearchContext);
    const favoriteDocs = await ctx.db
      .query('exerciseFavorites')
      .withIndex('by_profile_id', q => q.eq('profileId', profile._id))
      .collect();
    const favoriteIds = new Set(favoriteDocs.map(doc => doc.exerciseCatalogId));
    const exerciseById = new Map<Id<'exerciseCatalog'>, SupportedExercise>(
      exercises.map(exercise => [exercise._id, exercise]),
    );
    const favorites = hasSearchContext
      ? ([] as ReturnType<typeof serializeCatalogItem>[])
      : favoriteDocs
          .map(doc => getExerciseById(exerciseById, doc.exerciseCatalogId))
          .filter(isDefined)
          .map(exercise => serializeCatalogItem(exercise, favoriteIds));
    const recents = hasSearchContext
      ? ([] as ReturnType<typeof serializeCatalogItem>[])
      : await getRecentCatalogItems(ctx, profile._id, exerciseById, favoriteIds);
    const recentIds = new Set(recents.map(item => item._id));
    const suggested = hasSearchContext || recents.length > 0 || favorites.length > 0
      ? ([] as ReturnType<typeof serializeCatalogItem>[])
      : exercises
          .slice()
          .sort((left, right) => left.name.localeCompare(right.name))
          .slice(0, 16)
          .map(exercise => serializeCatalogItem(exercise, favoriteIds));
    const filtered = exercises
      .map(exercise => ({
        exercise,
        queryMatchRank: getQueryMatchRank(exercise, queryText),
      }))
      .filter(hasQueryMatchRank)
      .filter(item => matchesBodyAreaFilter(resolveStoredFocusAreas(item.exercise), selectedFocusAreas, selectedTargetAreas))
      .filter(item => matchesAnyArrayFilter(item.exercise.equipment, selectedEquipment))
      .sort((left, right) => {
        if (left.queryMatchRank !== right.queryMatchRank) {
          return left.queryMatchRank - right.queryMatchRank;
        }

        const leftPriority = getSearchPriority(left.exercise._id, recentIds);
        const rightPriority = getSearchPriority(right.exercise._id, recentIds);
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        return left.exercise.name.localeCompare(right.exercise.name);
      })
      .map(item => serializeCatalogItem(item.exercise, favoriteIds));

    return {
      equipmentOptions: collectFilterOptions(exercises.flatMap(exercise => exercise.equipment)),
      focusAreaOptions: collectFocusAreaOptions(exercises),
      favorites,
      muscleGroupOptions: collectFocusAreaOptions(exercises),
      recents,
      results: filtered,
      suggested,
      targetAreaOptions: collectTargetAreaOptions(exercises),
    };
  },
});

export const backfillModifierCapabilities = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 300, 1000));
    const exercises = await ctx.db.query('exerciseCatalog').take(limit);
    let updated = 0;

    for (const exercise of exercises) {
      const modifierCapabilities = resolveExerciseModifierCapabilities({
        canonicalFamily: exercise.canonicalFamily,
        equipment: exercise.equipment,
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        recipeKey: exercise.recipeKey,
      });

      const current = normalizeExerciseModifierCapabilities(exercise.modifierCapabilities);
      if (JSON.stringify(current) === JSON.stringify(modifierCapabilities)) {
        continue;
      }

      await ctx.db.patch(exercise._id, { modifierCapabilities });
      updated += 1;
    }

    return { scanned: exercises.length, updated };
  },
});

export const toggleFavorite = mutation({
  args: { exerciseCatalogId: v.id('exerciseCatalog') },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const exercise = await ctx.db.get(args.exerciseCatalogId);

    if (!exercise) {
      throw new ConvexError('Exercise not found.');
    }

    const existing = await ctx.db
      .query('exerciseFavorites')
      .withIndex('by_profile_id_and_exercise_catalog_id', q =>
        q.eq('profileId', profile._id).eq('exerciseCatalogId', args.exerciseCatalogId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { isFavorite: false };
    }

    await ctx.db.insert('exerciseFavorites', {
      exerciseCatalogId: args.exerciseCatalogId,
      profileId: profile._id,
    });

    return { isFavorite: true };
  },
});

export const importCatalogBatch = internalMutation({
  args: {
    rows: v.array(importRowValidator),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let updated = 0;

    for (const row of args.rows) {
      const existing = await ctx.db
        .query('exerciseCatalog')
        .withIndex('by_exercise_id', q => q.eq('exerciseId', row.exerciseId))
        .unique();
      const resolvedRecipeKey = row.recipeKey ?? null;
      const resolvedBodyweightLoadFactor = resolveBodyweightLoadFactor({
        canonicalFamily: row.canonicalFamily,
        exerciseId: row.exerciseId,
        isHold: row.isHold,
        recipeKey: resolvedRecipeKey,
        usesBodyweight: row.usesBodyweight,
      });
      const modifierCapabilities = resolveExerciseModifierCapabilities({
        canonicalFamily: row.canonicalFamily,
        equipment: row.equipment,
        exerciseId: row.exerciseId,
        name: row.name,
        recipeKey: resolvedRecipeKey,
      });
      const focusAreas = resolveRowFocusAreas(row);
      const patch = {
        ...row,
        primaryFocusAreas: focusAreas.primaryFocusAreas,
        primaryTargetAreas: focusAreas.primaryTargetAreas,
        secondaryFocusAreas: focusAreas.secondaryFocusAreas,
        secondaryTargetAreas: focusAreas.secondaryTargetAreas,
        ...(resolvedBodyweightLoadFactor === null ? {} : { bodyweightLoadFactor: resolvedBodyweightLoadFactor }),
        modifierCapabilities,
        recipeKey: resolvedRecipeKey,
        updatedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, patch);
        updated += 1;
        continue;
      }

      await ctx.db.insert('exerciseCatalog', patch);
      created += 1;
    }

    return { created, updated };
  },
});

export const backfillFocusAreas = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const exercises = await ctx.db.query('exerciseCatalog').collect();
    const changes: Array<{
      exerciseId: string;
      name: string;
      nextPrimaryFocusAreas: string[];
      nextPrimaryTargetAreas: string[];
      nextSecondaryFocusAreas: string[];
      nextSecondaryTargetAreas: string[];
      previousPrimaryFocusAreas: string[] | null;
      previousPrimaryTargetAreas: string[] | null;
      previousSecondaryFocusAreas: string[] | null;
      previousSecondaryTargetAreas: string[] | null;
    }> = [];

    for (const exercise of exercises) {
      const next = resolveStoredFocusAreas(exercise);
      const previousPrimaryFocusAreas = exercise.primaryFocusAreas ?? null;
      const previousPrimaryTargetAreas = exercise.primaryTargetAreas ?? null;
      const previousSecondaryFocusAreas = exercise.secondaryFocusAreas ?? null;
      const previousSecondaryTargetAreas = exercise.secondaryTargetAreas ?? null;
      if (
        arraysEqual(previousPrimaryFocusAreas ?? [], next.primaryFocusAreas)
        && arraysEqual(previousPrimaryTargetAreas ?? [], next.primaryTargetAreas)
        && arraysEqual(previousSecondaryFocusAreas ?? [], next.secondaryFocusAreas)
        && arraysEqual(previousSecondaryTargetAreas ?? [], next.secondaryTargetAreas)
      ) {
        continue;
      }

      changes.push({
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        nextPrimaryFocusAreas: next.primaryFocusAreas,
        nextPrimaryTargetAreas: next.primaryTargetAreas,
        nextSecondaryFocusAreas: next.secondaryFocusAreas,
        nextSecondaryTargetAreas: next.secondaryTargetAreas,
        previousPrimaryFocusAreas,
        previousPrimaryTargetAreas,
        previousSecondaryFocusAreas,
        previousSecondaryTargetAreas,
      });

      if (!args.dryRun) {
        await ctx.db.patch(exercise._id, {
          primaryFocusAreas: next.primaryFocusAreas,
          primaryTargetAreas: next.primaryTargetAreas,
          secondaryFocusAreas: next.secondaryFocusAreas,
          secondaryTargetAreas: next.secondaryTargetAreas,
          updatedAt: Date.now(),
        });
      }
    }

    const sourceExercises = args.dryRun
      ? exercises.map(exercise => ({ ...exercise, ...resolveStoredFocusAreas(exercise) }))
      : await ctx.db.query('exerciseCatalog').collect();
    const counts = exerciseFocusAreas.map(area => ({
      area,
      count: sourceExercises.filter(exercise => resolveStoredFocusAreas(exercise).primaryFocusAreas.includes(area)).length,
    }));
    const targetCounts = exerciseTargetAreas.map(area => ({
      area,
      count: sourceExercises.filter(exercise => resolveStoredFocusAreas(exercise).primaryTargetAreas.includes(area)).length,
    }));

    return {
      changed: changes.length,
      counts,
      dryRun: args.dryRun ?? false,
      sampleChanges: changes.slice(0, 40),
      scanned: exercises.length,
      targetCounts,
    };
  },
});

function resolveSupportedExercise(exercise: Doc<'exerciseCatalog'>): SupportedExercise | null {
  const resolvedRecipeKey = resolveCatalogRecipeKey({
    exerciseClass: exercise.exerciseClass,
    isCardio: exercise.isCardio,
    isHold: exercise.isHold,
    laterality: exercise.laterality,
    rawMetricRecipe: exercise.rawMetricRecipe,
    recipeKey: exercise.recipeKey,
    supportsLiveTracking: exercise.supportsLiveTracking,
  });

  if (!resolvedRecipeKey) {
    return null;
  }

  return {
    ...exercise,
    recipeKey: resolvedRecipeKey,
  };
}

function getExerciseById(
  exerciseById: Map<Id<'exerciseCatalog'>, SupportedExercise>,
  exerciseCatalogId: Id<'exerciseCatalog'>,
) {
  return exerciseById.get(exerciseCatalogId) ?? null;
}

async function getRecentCatalogItems(
  ctx: QueryCtx,
  profileId: Id<'profiles'>,
  exerciseById: Map<Id<'exerciseCatalog'>, SupportedExercise>,
  favoriteIds: Set<Id<'exerciseCatalog'>>,
): Promise<ReturnType<typeof serializeCatalogItem>[]> {
  const recentSessionExercises = (
    await ctx.db
      .query('liveSessionExercises')
      .withIndex('by_profile_id_and_added_at', q => q.eq('profileId', profileId))
      .collect()
  ).reverse();

  const seenRecentExerciseIds = new Set<Id<'exerciseCatalog'>>();
  return recentSessionExercises
    .map(entry => {
      if (seenRecentExerciseIds.has(entry.exerciseCatalogId)) {
        return null;
      }
      seenRecentExerciseIds.add(entry.exerciseCatalogId);
      return getExerciseById(exerciseById, entry.exerciseCatalogId);
    })
    .filter(isDefined)
    .slice(0, 8)
    .map(exercise => serializeCatalogItem(exercise, favoriteIds));
}

async function loadSearchContextExercises(
  ctx: QueryCtx,
  queryText: string,
  hasSearchContext: boolean,
): Promise<SupportedExercise[]> {
  const supportedExercises = await loadSupportedExercises(ctx);

  if (hasSearchContext && queryText.length > 0) {
    const indexedMatches = await ctx.db
      .query('exerciseCatalog')
      .withSearchIndex('search_text', q => q.search('searchText', queryText))
      .take(300);
    return mergeSupportedExercises([
      ...indexedMatches.map(resolveSupportedExercise).filter(isDefined),
      ...supportedExercises,
    ]);
  }

  return supportedExercises;
}

async function loadSupportedExercises(ctx: QueryCtx): Promise<SupportedExercise[]> {
  const supportedExercises = await ctx.db
    .query('exerciseCatalog')
    .withIndex('by_supported_in_live_session', q => q.eq('isSupportedInLiveSession', true))
    .collect();
  return supportedExercises.map(resolveSupportedExercise).filter(isDefined);
}

function mergeSupportedExercises(exercises: SupportedExercise[]): SupportedExercise[] {
  const seen = new Set<Id<'exerciseCatalog'>>();
  const merged: SupportedExercise[] = [];

  for (const exercise of exercises) {
    if (seen.has(exercise._id)) {
      continue;
    }

    seen.add(exercise._id);
    merged.push(exercise);
  }

  return merged;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

function serializeCatalogItem(exercise: SupportedExercise, favoriteIds: Set<Id<'exerciseCatalog'>>) {
  const focusAreas = resolveStoredFocusAreas(exercise);

  return {
    _id: exercise._id,
    discoveryTags: exercise.discoveryTags ?? [],
    equipment: exercise.equipment,
    exerciseClass: exercise.exerciseClass,
    isFavorite: favoriteIds.has(exercise._id),
    mainMuscleGroups: exercise.mainMuscleGroups,
    modifierCapabilities: normalizeExerciseModifierCapabilities(
      exercise.modifierCapabilities ??
        resolveExerciseModifierCapabilities({
          canonicalFamily: exercise.canonicalFamily,
          equipment: exercise.equipment,
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          recipeKey: exercise.recipeKey,
        }),
    ),
    name: exercise.name,
    primaryFocusAreaLabels: focusAreas.primaryFocusAreas.map(area => exerciseFocusAreaLabels[area]),
    primaryFocusAreas: focusAreas.primaryFocusAreas,
    primaryTargetAreaLabels: focusAreas.primaryTargetAreas.map(area => exerciseTargetAreaLabels[area]),
    primaryTargetAreas: focusAreas.primaryTargetAreas,
    recipeKey: exercise.recipeKey,
  };
}

function resolveStoredFocusAreas(exercise: Doc<'exerciseCatalog'>) {
  const primaryFocusAreas = normalizeExerciseFocusAreas(exercise.primaryFocusAreas);
  const secondaryFocusAreas = normalizeExerciseFocusAreas(exercise.secondaryFocusAreas);
  const primaryTargetAreas = normalizeExerciseTargetAreas(exercise.primaryTargetAreas);
  const secondaryTargetAreas = normalizeExerciseTargetAreas(exercise.secondaryTargetAreas);

  if (primaryFocusAreas.length > 0 && exercise.primaryTargetAreas !== undefined) {
    return { primaryFocusAreas, primaryTargetAreas, secondaryFocusAreas, secondaryTargetAreas };
  }

  const derived = resolveExerciseFocusAreas(exercise);
  return {
    primaryFocusAreas: primaryFocusAreas.length > 0 ? primaryFocusAreas : derived.primaryFocusAreas,
    primaryTargetAreas: exercise.primaryTargetAreas === undefined ? derived.primaryTargetAreas : primaryTargetAreas,
    secondaryFocusAreas: exercise.secondaryFocusAreas === undefined ? derived.secondaryFocusAreas : secondaryFocusAreas,
    secondaryTargetAreas: exercise.secondaryTargetAreas === undefined ? derived.secondaryTargetAreas : secondaryTargetAreas,
  };
}

function resolveRowFocusAreas(row: typeof importRowValidator.type) {
  const primaryFocusAreas = normalizeExerciseFocusAreas(row.primaryFocusAreas);
  const secondaryFocusAreas = normalizeExerciseFocusAreas(row.secondaryFocusAreas);
  const primaryTargetAreas = normalizeExerciseTargetAreas(row.primaryTargetAreas);
  const secondaryTargetAreas = normalizeExerciseTargetAreas(row.secondaryTargetAreas);

  if (primaryFocusAreas.length > 0) {
    return { primaryFocusAreas, primaryTargetAreas, secondaryFocusAreas, secondaryTargetAreas };
  }

  return resolveExerciseFocusAreas(row);
}

function matchesAnyArrayFilter(values: string[], filters: string[]) {
  if (filters.length === 0) {
    return true;
  }

  const normalizedValues = new Set(values.map(value => value.toLowerCase()));
  return filters.some(filter => normalizedValues.has(filter));
}

function matchesBodyAreaFilter(
  areas: ReturnType<typeof resolveStoredFocusAreas>,
  selectedFocusAreas: string[],
  selectedTargetAreas: string[],
) {
  if (selectedFocusAreas.length === 0 && selectedTargetAreas.length === 0) {
    return true;
  }

  return matchesAnyArrayFilter(areas.primaryFocusAreas, selectedFocusAreas)
    || matchesAnyArrayFilter(areas.primaryTargetAreas, selectedTargetAreas);
}

function normalizeMultiFilters(values: string[] | null | undefined) {
  if (!values || values.length === 0) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map(value => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function collectFilterOptions(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function collectFocusAreaOptions(exercises: SupportedExercise[]) {
  const availableAreas = new Set(exercises.flatMap(exercise => resolveStoredFocusAreas(exercise).primaryFocusAreas));
  return exerciseFocusAreas
    .filter(area => availableAreas.has(area))
    .map(area => ({
      label: exerciseFocusAreaLabels[area],
      value: area,
    }));
}

function collectTargetAreaOptions(exercises: SupportedExercise[]) {
  const availableAreas = new Set(exercises.flatMap(exercise => resolveStoredFocusAreas(exercise).primaryTargetAreas));
  return exerciseTargetAreas
    .filter(area => availableAreas.has(area))
    .map(area => ({
      label: exerciseTargetAreaLabels[area],
      parentFocusAreas: exerciseTargetAreaParents[area],
      value: area,
    }));
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function getSearchPriority(
  exerciseId: Id<'exerciseCatalog'>,
  recentIds: Set<Id<'exerciseCatalog'>>,
) {
  if (recentIds.has(exerciseId)) {
    return 0;
  }
  return 1;
}

function hasQueryMatchRank(item: { exercise: SupportedExercise; queryMatchRank: number | null }): item is {
  exercise: SupportedExercise;
  queryMatchRank: number;
} {
  return item.queryMatchRank !== null;
}

function getQueryMatchRank(exercise: SupportedExercise, queryText: string): number | null {
  const query = createSearchQuery(queryText);

  if (!query) {
    return 0;
  }

  const targetAreaQuery = getTargetAreaQuery(query);
  if (targetAreaQuery) {
    return resolveStoredFocusAreas(exercise).primaryTargetAreas.includes(targetAreaQuery) ? 2 : null;
  }
  const focusAreaQuery = getFocusAreaQuery(query);
  if (focusAreaQuery) {
    return resolveStoredFocusAreas(exercise).primaryFocusAreas.includes(focusAreaQuery) ? 2 : null;
  }

  const primaryValues = [
    exercise.name,
    ...exercise.aliases,
    exercise.exerciseId,
    exercise.canonicalFamily,
  ].filter(Boolean);
  const focusAreas = resolveStoredFocusAreas(exercise);
  const metadataValues = [
    exercise.exerciseClass,
    ...focusAreas.primaryFocusAreas,
    ...focusAreas.primaryFocusAreas.map(area => exerciseFocusAreaLabels[area]),
    ...focusAreas.primaryTargetAreas,
    ...focusAreas.primaryTargetAreas.map(area => exerciseTargetAreaLabels[area]),
    ...exercise.mainMuscleGroups,
    ...exercise.secondaryMuscleGroups,
    ...exercise.equipment,
    ...exercise.movementPatterns,
    ...exercise.contextTags,
    ...exercise.skillTags,
    ...(exercise.discoveryTags ?? []),
    exercise.rawMetricRecipe,
  ].filter(Boolean);

  if (hasSearchMatch(primaryValues, query, 'exact')) {
    return 0;
  }
  if (hasSearchMatch(primaryValues, query, 'startsWith')) {
    return 1;
  }
  if (hasSearchMatch(primaryValues, query, 'includes')) {
    return 2;
  }
  if (hasFuzzySearchMatch(primaryValues, query)) {
    return 3;
  }
  if (hasSearchMatch(metadataValues, query, 'exact')) {
    return 4;
  }
  if (hasSearchMatch(metadataValues, query, 'startsWith')) {
    return 5;
  }
  if (hasSearchMatch(metadataValues, query, 'includes')) {
    return 6;
  }
  if (hasSearchMatch([exercise.searchText], query, 'includes')) {
    return 7;
  }

  return null;
}

function getFocusAreaQuery(query: SearchQuery): ExerciseFocusArea | null {
  const normalized = query.normalized;

  if (['ab', 'abs', 'core', 'abdominal', 'abdominals', 'abs core'].includes(normalized)) return 'abs-core';
  if (['arm', 'arms'].includes(normalized)) return 'arms';
  if (['back'].includes(normalized)) return 'back';
  if (['cardio', 'conditioning'].includes(normalized)) return 'cardio';
  if (['chest'].includes(normalized)) return 'chest';
  if (['full body', 'fullbody', 'full-body'].includes(normalized)) return 'full-body';
  if (['grip'].includes(normalized)) return 'grip';
  if (['leg', 'legs', 'lower body', 'lower-body'].includes(normalized)) return 'legs';
  if (['mobility'].includes(normalized)) return 'mobility';
  if (['shoulder', 'shoulders'].includes(normalized)) return 'shoulders';

  return null;
}

function getTargetAreaQuery(query: SearchQuery): ExerciseTargetArea | null {
  const normalized = query.normalized;

  if (['ab', 'abs', 'abdominal', 'abdominals'].includes(normalized)) return 'abs';
  if (['adductor', 'adductors', 'inner thigh', 'inner thighs'].includes(normalized)) return 'adductors';
  if (['bicep', 'biceps'].includes(normalized)) return 'biceps';
  if (['calf', 'calves'].includes(normalized)) return 'calves';
  if (['pec', 'pecs'].includes(normalized)) return 'chest';
  if (['core stability', 'stability'].includes(normalized)) return 'core-stability';
  if (['forearm', 'forearms', 'wrist', 'wrists'].includes(normalized)) return 'forearms-wrists';
  if (['front delt', 'front delts', 'front shoulder'].includes(normalized)) return 'front-delts';
  if (['hamstring', 'hamstrings'].includes(normalized)) return 'hamstrings';
  if (['lat', 'lats'].includes(normalized)) return 'lats';
  if (['lower back', 'spinal erectors', 'erectors'].includes(normalized)) return 'lower-back';
  if (['neck'].includes(normalized)) return 'neck';
  if (['oblique', 'obliques'].includes(normalized)) return 'obliques';
  if (['quad', 'quads', 'quadriceps'].includes(normalized)) return 'quads';
  if (['rear delt', 'rear delts', 'rear shoulder'].includes(normalized)) return 'rear-delts';
  if (['side delt', 'side delts', 'lateral delt', 'lateral delts'].includes(normalized)) return 'side-delts';
  if (['trap', 'traps', 'trapezius'].includes(normalized)) return 'traps';
  if (['tricep', 'triceps'].includes(normalized)) return 'triceps';
  if (['upper back', 'mid back'].includes(normalized)) return 'upper-back';

  return null;
}

type SearchQuery = {
  compact: string;
  compactSingular: string;
  normalized: string;
  tokens: string[];
};

type SearchMatchMode = 'exact' | 'startsWith' | 'includes';

function createSearchQuery(value: string): SearchQuery | null {
  const normalized = normalizeSearchValue(value);

  if (!normalized) {
    return null;
  }

  const compact = compactSearchValue(normalized);
  return {
    compact,
    compactSingular: singularizeCompactSearchValue(compact),
    normalized,
    tokens: normalized.split(' '),
  };
}

function hasSearchMatch(values: string[], query: SearchQuery, mode: SearchMatchMode) {
  return values.some(value => {
    const normalized = normalizeSearchValue(value);

    if (!normalized) {
      return false;
    }

    const compact = compactSearchValue(normalized);
    const compactSingular = singularizeCompactSearchValue(compact);
    return matchesSearchValue(normalized, query.normalized, mode)
      || matchesSearchValue(compact, query.compact, mode)
      || matchesSearchValue(compact, query.compactSingular, mode)
      || matchesSearchValue(compactSingular, query.compact, mode)
      || matchesSearchValue(compactSingular, query.compactSingular, mode);
  });
}

function matchesSearchValue(value: string, query: string, mode: SearchMatchMode) {
  if (!query) {
    return false;
  }

  if (mode === 'exact') {
    return value === query;
  }

  if (mode === 'startsWith') {
    return value.startsWith(query);
  }

  return value.includes(query);
}

function hasFuzzySearchMatch(values: string[], query: SearchQuery) {
  return values.some(value => {
    const normalized = normalizeSearchValue(value);

    if (!normalized) {
      return false;
    }

    const compact = compactSearchValue(normalized);
    const compactSingular = singularizeCompactSearchValue(compact);
    if (
      isWithinSearchTypoDistance(query.compact, compact)
      || isWithinSearchTypoDistance(query.compactSingular, compact)
      || isWithinSearchTypoDistance(query.compact, compactSingular)
      || isWithinSearchTypoDistance(query.compactSingular, compactSingular)
    ) {
      return true;
    }

    const valueTokens = normalized.split(' ');
    return query.tokens.every(queryToken =>
      valueTokens.some(valueToken => isWithinSearchTypoDistance(queryToken, valueToken)),
    );
  });
}

function isWithinSearchTypoDistance(query: string, value: string) {
  if (query.length < 3 || value.length < 3) {
    return query === value;
  }

  const maxDistance = query.length >= 5 || value.length >= 5 ? 2 : 1;
  return getBoundedDamerauLevenshteinDistance(query, value, maxDistance) <= maxDistance;
}

function getBoundedDamerauLevenshteinDistance(left: string, right: string, maxDistance: number) {
  if (Math.abs(left.length - right.length) > maxDistance) {
    return maxDistance + 1;
  }

  const previousPreviousRow = new Array(right.length + 1).fill(0);
  let previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const currentRow = new Array(right.length + 1).fill(0);
    currentRow[0] = leftIndex;
    let bestInRow = currentRow[0];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      currentRow[rightIndex] = Math.min(
        previousRow[rightIndex] + 1,
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex - 1] + substitutionCost,
      );

      if (
        leftIndex > 1
        && rightIndex > 1
        && left[leftIndex - 1] === right[rightIndex - 2]
        && left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        currentRow[rightIndex] = Math.min(currentRow[rightIndex], previousPreviousRow[rightIndex - 2] + 1);
      }

      bestInRow = Math.min(bestInRow, currentRow[rightIndex]);
    }

    if (bestInRow > maxDistance) {
      return maxDistance + 1;
    }

    previousPreviousRow.splice(0, previousPreviousRow.length, ...previousRow);
    previousRow = currentRow;
  }

  return previousRow[right.length];
}

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function compactSearchValue(value: string) {
  return value.replace(/\s+/g, '');
}

function singularizeCompactSearchValue(value: string) {
  if (value.endsWith('ss')) {
    return value;
  }

  if (value.endsWith('ies') && value.length > 4) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith('es') && value.length > 4) {
    return value.slice(0, -2);
  }

  if (value.endsWith('s') && value.length > 3) {
    return value.slice(0, -1);
  }

  return value;
}

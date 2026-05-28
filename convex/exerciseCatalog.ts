import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';
import { resolveBodyweightLoadFactor } from '../domains/workout/bodyweight-load-factors';
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
    muscleGroups: optionalMultiFilterValidator,
    query: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const queryText = args.query?.trim().toLowerCase() ?? '';
    const selectedMuscleGroups = normalizeMultiFilters(args.muscleGroups);
    const selectedEquipment = normalizeMultiFilters(args.equipment);
    const hasSearchContext =
      queryText.length > 0 || selectedMuscleGroups.length > 0 || selectedEquipment.length > 0;
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
      .filter(item =>
        matchesAnyArrayFilter(
          [...item.exercise.mainMuscleGroups, ...item.exercise.secondaryMuscleGroups],
          selectedMuscleGroups,
        ),
      )
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
      favorites,
      muscleGroupOptions: collectFilterOptions(
        exercises.flatMap(exercise => [...exercise.mainMuscleGroups, ...exercise.secondaryMuscleGroups]),
      ),
      recents,
      results: filtered,
      suggested,
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
      const patch = {
        ...row,
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
    recipeKey: exercise.recipeKey,
  };
}

function matchesAnyArrayFilter(values: string[], filters: string[]) {
  if (filters.length === 0) {
    return true;
  }

  const normalizedValues = new Set(values.map(value => value.toLowerCase()));
  return filters.some(filter => normalizedValues.has(filter));
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

  const primaryValues = [
    exercise.name,
    ...exercise.aliases,
    exercise.exerciseId,
    exercise.canonicalFamily,
  ].filter(Boolean);
  const metadataValues = [
    exercise.exerciseClass,
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

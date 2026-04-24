import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';
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

        const leftPriority = getSearchPriority(left.exercise._id, favoriteIds, recentIds);
        const rightPriority = getSearchPriority(right.exercise._id, favoriteIds, recentIds);
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
    };
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
      createdAt: Date.now(),
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
      const patch = {
        ...row,
        recipeKey: row.recipeKey ?? null,
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
  if (hasSearchContext && queryText.length > 0) {
    const indexedMatches = await ctx.db
      .query('exerciseCatalog')
      .withSearchIndex('search_text', q => q.search('searchText', queryText))
      .take(300);
    return indexedMatches.map(resolveSupportedExercise).filter(isDefined);
  }

  const supportedExercises = await ctx.db
    .query('exerciseCatalog')
    .withIndex('by_supported_in_live_session', q => q.eq('isSupportedInLiveSession', true))
    .collect();
  return supportedExercises.map(resolveSupportedExercise).filter(isDefined);
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
  favoriteIds: Set<Id<'exerciseCatalog'>>,
  recentIds: Set<Id<'exerciseCatalog'>>,
) {
  if (recentIds.has(exerciseId)) {
    return 0;
  }
  if (favoriteIds.has(exerciseId)) {
    return 1;
  }
  return 2;
}

function hasQueryMatchRank(item: { exercise: SupportedExercise; queryMatchRank: number | null }): item is {
  exercise: SupportedExercise;
  queryMatchRank: number;
} {
  return item.queryMatchRank !== null;
}

function getQueryMatchRank(exercise: SupportedExercise, queryText: string): number | null {
  if (!queryText) {
    return 0;
  }

  const primaryValues = [exercise.name, ...exercise.aliases]
    .map(value => value.toLowerCase().trim())
    .filter(Boolean);
  const metadataValues = [
    exercise.exerciseClass,
    ...exercise.mainMuscleGroups,
    ...exercise.secondaryMuscleGroups,
    ...exercise.equipment,
    ...(exercise.discoveryTags ?? []),
  ]
    .map(value => value.toLowerCase().trim())
    .filter(Boolean);
  const fullSearchText = exercise.searchText.toLowerCase();

  if (primaryValues.some(value => value === queryText)) {
    return 0;
  }
  if (primaryValues.some(value => value.startsWith(queryText))) {
    return 1;
  }
  if (primaryValues.some(value => value.includes(queryText))) {
    return 2;
  }
  if (metadataValues.some(value => value === queryText)) {
    return 3;
  }
  if (metadataValues.some(value => value.startsWith(queryText))) {
    return 4;
  }
  if (metadataValues.some(value => value.includes(queryText))) {
    return 5;
  }
  if (fullSearchText.includes(queryText)) {
    return 6;
  }

  return null;
}

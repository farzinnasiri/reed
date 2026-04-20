import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { requireViewerProfile } from './profiles';
import { isSupportedRecipeKey, type RecipeKey } from '../domains/workout/recipes';

const optionalFilterValidator = v.optional(v.union(v.string(), v.null()));

const importRowValidator = v.object({
  aliases: v.array(v.string()),
  bodyPosition: v.optional(v.string()),
  canonicalFamily: v.string(),
  contextTags: v.array(v.string()),
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
  recipeKey: v.optional(
    v.union(
      v.literal('standard_load'),
      v.literal('bodyweight_reps'),
      v.literal('assist_bodyweight'),
      v.literal('added_bodyweight'),
      v.literal('hold'),
      v.literal('weighted_hold'),
      v.null(),
    ),
  ),
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
    equipment: optionalFilterValidator,
    muscleGroup: optionalFilterValidator,
    query: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const supportedExercises = await ctx.db
      .query('exerciseCatalog')
      .withIndex('by_supported_in_live_session', q => q.eq('isSupportedInLiveSession', true))
      .collect();
    const exercises = supportedExercises.filter(isSupportedExercise);
    const favoriteDocs = await ctx.db
      .query('exerciseFavorites')
      .withIndex('by_profile_id', q => q.eq('profileId', profile._id))
      .collect();
    const favoriteIds = new Set(favoriteDocs.map(doc => doc.exerciseCatalogId));
    const exerciseById = new Map(exercises.map(exercise => [exercise._id, exercise]));
    const favorites = favoriteDocs
      .map(doc => getExerciseById(exerciseById, doc.exerciseCatalogId))
      .filter(isDefined)
      .map(exercise => serializeCatalogItem(exercise, favoriteIds));

    const recentSessionExercises = (
      await ctx.db
        .query('liveSessionExercises')
        .withIndex('by_profile_id_and_added_at', q => q.eq('profileId', profile._id))
        .collect()
    ).reverse();

    const seenRecentExerciseIds = new Set<Id<'exerciseCatalog'>>();
    const recents = recentSessionExercises
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

    const queryText = args.query?.trim().toLowerCase() ?? '';
    const muscleGroup = normalizeFilter(args.muscleGroup);
    const equipment = normalizeFilter(args.equipment);
    const filtered = exercises
      .filter(exercise => matchesText(exercise, queryText))
      .filter(exercise => matchesArrayFilter(exercise.mainMuscleGroups, muscleGroup))
      .filter(exercise => matchesArrayFilter(exercise.equipment, equipment))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(exercise => serializeCatalogItem(exercise, favoriteIds));

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

function isSupportedExercise(exercise: Doc<'exerciseCatalog'>): exercise is SupportedExercise {
  return typeof exercise.recipeKey === 'string' && isSupportedRecipeKey(exercise.recipeKey);
}

function getExerciseById(
  exerciseById: Map<Id<'exerciseCatalog'>, SupportedExercise>,
  exerciseCatalogId: Id<'exerciseCatalog'>,
) {
  return exerciseById.get(exerciseCatalogId) ?? null;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

function serializeCatalogItem(exercise: SupportedExercise, favoriteIds: Set<Id<'exerciseCatalog'>>) {
  return {
    _id: exercise._id,
    equipment: exercise.equipment,
    exerciseClass: exercise.exerciseClass,
    isFavorite: favoriteIds.has(exercise._id),
    mainMuscleGroups: exercise.mainMuscleGroups,
    name: exercise.name,
    recipeKey: exercise.recipeKey,
  };
}

function matchesText(exercise: SupportedExercise, queryText: string) {
  if (!queryText) {
    return true;
  }

  const haystacks = [exercise.name, exercise.searchText, ...exercise.aliases]
    .join(' ')
    .toLowerCase();

  return haystacks.includes(queryText);
}

function matchesArrayFilter(values: string[], filter: string | null) {
  if (!filter) {
    return true;
  }

  return values.some(value => value.toLowerCase() === filter);
}

function normalizeFilter(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function collectFilterOptions(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { activeProcessValidator, recipeKeyOrNullValidator, recipeKeyValidator, setMetricsValidator } from './workoutValidators';

export default defineSchema({
  profiles: defineTable({
    authUserId: v.string(),
    avatarUrl: v.optional(v.string()),
    displayName: v.optional(v.string()),
    email: v.string(),
    updatedAt: v.number(),
  }).index('by_auth_user_id', ['authUserId']),
  exerciseCatalog: defineTable({
    exerciseId: v.string(),
    name: v.string(),
    aliases: v.array(v.string()),
    canonicalFamily: v.string(),
    exerciseClass: v.string(),
    rawMetricRecipe: v.string(),
    recipeKey: recipeKeyOrNullValidator,
    isSupportedInLiveSession: v.boolean(),
    primaryModality: v.optional(v.string()),
    equipment: v.array(v.string()),
    bodyPosition: v.optional(v.string()),
    movementPatterns: v.array(v.string()),
    forceType: v.optional(v.string()),
    laterality: v.optional(v.string()),
    usesBodyweight: v.boolean(),
    loadType: v.optional(v.string()),
    mainMuscleGroups: v.array(v.string()),
    secondaryMuscleGroups: v.array(v.string()),
    jointsEmphasized: v.array(v.string()),
    skillTags: v.array(v.string()),
    contextTags: v.array(v.string()),
    isHold: v.boolean(),
    isCardio: v.boolean(),
    supportsLiveTracking: v.boolean(),
    defaultSummaryFormat: v.optional(v.string()),
    searchText: v.string(),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_exercise_id', ['exerciseId'])
    .index('by_supported_in_live_session', ['isSupportedInLiveSession'])
    .index('by_canonical_family', ['canonicalFamily']),
  exerciseFavorites: defineTable({
    profileId: v.id('profiles'),
    exerciseCatalogId: v.id('exerciseCatalog'),
    createdAt: v.number(),
  })
    .index('by_profile_id', ['profileId'])
    .index('by_profile_id_and_exercise_catalog_id', ['profileId', 'exerciseCatalogId']),
  liveSessions: defineTable({
    profileId: v.id('profiles'),
    status: v.union(v.literal('active'), v.literal('ended')),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    activeSessionExerciseId: v.optional(v.id('liveSessionExercises')),
    activeProcess: activeProcessValidator,
  }).index('by_profile_id_and_status', ['profileId', 'status']),
  liveSessionExercises: defineTable({
    sessionId: v.id('liveSessions'),
    profileId: v.id('profiles'),
    exerciseCatalogId: v.id('exerciseCatalog'),
    position: v.number(),
    addedAt: v.number(),
    exerciseName: v.string(),
    recipeKey: recipeKeyOrNullValidator,
    defaultSummaryFormat: v.optional(v.string()),
    exerciseClass: v.string(),
  })
    .index('by_session_id_and_position', ['sessionId', 'position'])
    .index('by_profile_id_and_added_at', ['profileId', 'addedAt']),
  liveSetLogs: defineTable({
    sessionId: v.id('liveSessions'),
    sessionExerciseId: v.id('liveSessionExercises'),
    profileId: v.id('profiles'),
    loggedAt: v.number(),
    setNumber: v.number(),
    warmup: v.boolean(),
    recipeKey: recipeKeyValidator,
    metrics: setMetricsValidator,
    restSeconds: v.optional(v.number()),
  })
    .index('by_session_exercise_id_and_set_number', ['sessionExerciseId', 'setNumber'])
    .index('by_profile_id_and_logged_at', ['profileId', 'loggedAt']),
});

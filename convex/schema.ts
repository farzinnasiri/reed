import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { activeProcessValidator, recipeKeyOrNullValidator, recipeKeyValidator, setMetricsValidator } from './workoutValidators';
import {
  bodyMetricKeyValidator,
  bodyMetricUnitValidator,
  cardioAnchorKeyValidator,
  cardioModalityValidator,
  strengthAnchorKeyValidator,
  strengthAssessmentKindValidator,
  trainingProfileValidator,
} from './profileValidators';

export default defineSchema({
  profiles: defineTable({
    authUserId: v.string(),
    avatarUrl: v.optional(v.string()),
    displayName: v.optional(v.string()),
    email: v.string(),
    onboardingCompletedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index('by_auth_user_id', ['authUserId']),
  trainingProfiles: defineTable(trainingProfileValidator)
    .index('by_profile_id', ['profileId'])
    .index('by_profile_id_and_updated_at', ['profileId', 'updatedAt']),
  bodyMeasurements: defineTable({
    metricKey: bodyMetricKeyValidator,
    observedAt: v.number(),
    profileId: v.id('profiles'),
    source: v.union(v.literal('onboarding'), v.literal('manual')),
    unit: bodyMetricUnitValidator,
    value: v.number(),
  })
    .index('by_profile_id_and_metric_key_and_observed_at', ['profileId', 'metricKey', 'observedAt'])
    .index('by_profile_id_and_observed_at', ['profileId', 'observedAt']),
  strengthAssessments: defineTable({
    anchorKey: strengthAnchorKeyValidator,
    estimatedOneRepMaxKg: v.union(v.number(), v.null()),
    kind: strengthAssessmentKindValidator,
    loadKg: v.union(v.number(), v.null()),
    observedAt: v.number(),
    profileId: v.id('profiles'),
    reps: v.number(),
    source: v.union(v.literal('onboarding'), v.literal('manual')),
  })
    .index('by_profile_id_and_anchor_key_and_observed_at', ['profileId', 'anchorKey', 'observedAt'])
    .index('by_profile_id_and_observed_at', ['profileId', 'observedAt']),
  cardioAssessments: defineTable({
    anchorKey: cardioAnchorKeyValidator,
    distanceMeters: v.union(v.number(), v.null()),
    durationSeconds: v.union(v.number(), v.null()),
    floors: v.union(v.number(), v.null()),
    modality: cardioModalityValidator,
    observedAt: v.number(),
    profileId: v.id('profiles'),
    source: v.union(v.literal('onboarding'), v.literal('manual')),
  })
    .index('by_profile_id_and_anchor_key_and_observed_at', ['profileId', 'anchorKey', 'observedAt'])
    .index('by_profile_id_and_observed_at', ['profileId', 'observedAt']),
  exerciseCatalog: defineTable({
    exerciseId: v.string(),
    name: v.string(),
    aliases: v.array(v.string()),
    canonicalFamily: v.string(),
    bodyweightLoadFactor: v.optional(v.number()),
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
    discoveryTags: v.optional(v.array(v.string())),
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
    .index('by_canonical_family', ['canonicalFamily'])
    .searchIndex('search_text', {
      filterFields: ['isSupportedInLiveSession'],
      searchField: 'searchText',
    }),
  exerciseFavorites: defineTable({
    profileId: v.id('profiles'),
    exerciseCatalogId: v.id('exerciseCatalog'),
  })
    .index('by_profile_id', ['profileId'])
    .index('by_profile_id_and_exercise_catalog_id', ['profileId', 'exerciseCatalogId']),
  quickLogPresets: defineTable({
    exerciseCatalogId: v.id('exerciseCatalog'),
    group: v.union(v.literal('strength'), v.literal('cardio'), v.literal('recovery')),
    inputKind: v.union(v.literal('reps'), v.literal('duration'), v.literal('duration_or_distance')),
    isEnabled: v.boolean(),
    key: v.string(),
    label: v.string(),
    recipeKey: recipeKeyValidator,
    sortOrder: v.number(),
  })
    .index('by_enabled_and_sort_order', ['isEnabled', 'sortOrder'])
    .index('by_key', ['key']),
  liveSessions: defineTable({
    profileId: v.id('profiles'),
    status: v.union(v.literal('active'), v.literal('ended')),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    activeSessionExerciseId: v.optional(v.id('liveSessionExercises')),
    activeProcess: activeProcessValidator,
  })
    .index('by_profile_id_and_status', ['profileId', 'status'])
    .index('by_profile_id_and_status_and_started_at', ['profileId', 'status', 'startedAt']),
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
  activityLogs: defineTable({
    derivedBodyweightKg: v.optional(v.number()),
    derivedEffectiveLoadKg: v.optional(v.number()),
    exerciseCatalogId: v.id('exerciseCatalog'),
    loggedAt: v.number(),
    metrics: setMetricsValidator,
    profileId: v.id('profiles'),
    recipeKey: recipeKeyValidator,
    restSeconds: v.optional(v.number()),
    sessionExerciseId: v.optional(v.id('liveSessionExercises')),
    sessionId: v.optional(v.id('liveSessions')),
    setNumber: v.number(),
    source: v.union(v.literal('live_session'), v.literal('quick_log')),
    warmup: v.boolean(),
  })
    .index('by_session_id_and_set_number', ['sessionId', 'setNumber'])
    .index('by_session_exercise_id_and_set_number', ['sessionExerciseId', 'setNumber'])
    .index('by_profile_id_and_logged_at', ['profileId', 'loggedAt'])
    .index('by_profile_id_and_source_and_logged_at', ['profileId', 'source', 'loggedAt']),
});

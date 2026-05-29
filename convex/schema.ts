import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  activeProcessValidator,
  exerciseModifierCapabilitiesValidator,
  exerciseSetupModifiersValidator,
  recipeKeyOrNullValidator,
  recipeKeyValidator,
  setMetricsValidator,
  setOutcomeDetailsValidator,
} from './workoutValidators';
import {
  bodyMetricKeyValidator,
  bodyMetricUnitValidator,
  cardioAnchorKeyValidator,
  cardioModalityValidator,
  strengthAnchorKeyValidator,
  strengthAssessmentKindValidator,
  trainingProfileValidator,
} from './profileValidators';
import {
  targetCompletionSourceValidator,
  targetProgressSummaryValidator,
  targetRuleValidator,
  targetStatusValidator,
  targetVerifiedSnapshotValidator,
} from './targetValidators';

export default defineSchema({
  profiles: defineTable({
    authUserId: v.string(),
    avatarUrl: v.optional(v.string()),
    displayName: v.optional(v.string()),
    email: v.string(),
    onboardingCompletedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_auth_user_id', ['authUserId'])
    .index('by_email', ['email']),
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
    modifierCapabilities: v.optional(exerciseModifierCapabilitiesValidator),
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
    primaryFocusAreas: v.optional(v.array(v.string())),
    secondaryFocusAreas: v.optional(v.array(v.string())),
    primaryTargetAreas: v.optional(v.array(v.string())),
    secondaryTargetAreas: v.optional(v.array(v.string())),
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
    modifierCapabilities: v.optional(exerciseModifierCapabilitiesValidator),
    setupModifiers: v.optional(exerciseSetupModifiersValidator),
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
    setOutcomeDetails: v.optional(setOutcomeDetailsValidator),
    sessionExerciseId: v.optional(v.id('liveSessionExercises')),
    sessionId: v.optional(v.id('liveSessions')),
    setNumber: v.number(),
    source: v.union(v.literal('live_session'), v.literal('quick_log')),
    warmup: v.boolean(),
  })
    .index('by_session_id_and_set_number', ['sessionId', 'setNumber'])
    .index('by_session_exercise_id_and_set_number', ['sessionExerciseId', 'setNumber'])
    .index('by_profile_id_and_logged_at', ['profileId', 'loggedAt'])
    .index('by_profile_id_and_exercise_catalog_id_and_logged_at', ['profileId', 'exerciseCatalogId', 'loggedAt'])
    .index('by_profile_id_and_source_and_logged_at', ['profileId', 'source', 'loggedAt']),
  trainingTargets: defineTable({
    archivedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    completionNote: v.optional(v.string()),
    completionSource: v.optional(targetCompletionSourceValidator),
    createdAt: v.number(),
    endsAt: v.number(),
    lastEvaluatedAt: v.optional(v.number()),
    missedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    previewText: v.string(),
    profileId: v.id('profiles'),
    progressSummary: targetProgressSummaryValidator,
    rule: targetRuleValidator,
    startsAt: v.number(),
    status: targetStatusValidator,
    title: v.string(),
    updatedAt: v.number(),
    verifiedSnapshot: v.optional(targetVerifiedSnapshotValidator),
  })
    .index('by_profile_id_and_status', ['profileId', 'status'])
    .index('by_profile_id_and_status_and_updated_at', ['profileId', 'status', 'updatedAt'])
    .index('by_profile_id_and_ends_at', ['profileId', 'endsAt']),
  reedThreads: defineTable({
    profileId: v.id('profiles'),
    status: v.union(v.literal('active'), v.literal('archived')),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.optional(v.number()),
    activeSummaryId: v.optional(v.id('reedMemorySummaries')),
    compactedThroughMessageId: v.optional(v.id('reedMessages')),
  })
    .index('by_profile_id_and_status', ['profileId', 'status'])
    .index('by_profile_id_and_updated_at', ['profileId', 'updatedAt']),
  reedMessages: defineTable({
    threadId: v.id('reedThreads'),
    profileId: v.id('profiles'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    source: v.union(v.literal('quick-action'), v.literal('typed'), v.literal('voice'), v.literal('system')),
    status: v.union(v.literal('pending'), v.literal('sent'), v.literal('failed')),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    clientNonce: v.optional(v.string()),
  })
    .index('by_thread_id_and_created_at', ['threadId', 'createdAt'])
    .index('by_profile_id_and_created_at', ['profileId', 'createdAt'])
    .index('by_profile_id_and_client_nonce', ['profileId', 'clientNonce']),
  reedMemorySummaries: defineTable({
    threadId: v.id('reedThreads'),
    profileId: v.id('profiles'),
    content: v.string(),
    sourceFromMessageId: v.optional(v.id('reedMessages')),
    sourceThroughMessageId: v.id('reedMessages'),
    modelProvider: v.string(),
    modelName: v.string(),
    promptHash: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_thread_id_and_created_at', ['threadId', 'createdAt'])
    .index('by_profile_id_and_created_at', ['profileId', 'createdAt']),
  reedAttitudes: defineTable({
    key: v.string(),
    name: v.string(),
    description: v.string(),
    prompt: v.string(),
    status: v.union(v.literal('active'), v.literal('archived')),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_key', ['key'])
    .index('by_status_and_sort_order', ['status', 'sortOrder']),
  reedProfileAiSettings: defineTable({
    profileId: v.id('profiles'),
    selectedAttitudeId: v.optional(v.id('reedAttitudes')),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_profile_id', ['profileId']),
  profileInsights: defineTable({
    profileId: v.id('profiles'),
    content: v.string(),
    status: v.union(v.literal('active'), v.literal('stale'), v.literal('failed')),
    staleReason: v.optional(v.string()),
    sourceFingerprint: v.string(),
    sourceChangedAt: v.number(),
    generatedAt: v.number(),
    modelName: v.string(),
    error: v.optional(v.string()),
  })
    .index('by_profile_id', ['profileId'])
    .index('by_profile_id_and_status', ['profileId', 'status']),
  reedPromptVersions: defineTable({
    key: v.string(),
    content: v.string(),
    status: v.union(v.literal('active'), v.literal('archived')),
    version: v.number(),
    contentHash: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_key_and_status', ['key', 'status'])
    .index('by_key_and_version', ['key', 'version']),
  reedJourneySnapshots: defineTable({
    profileId: v.id('profiles'),
    trigger: v.union(
      v.literal('session_ended'),
      v.literal('onboarding_updated'),
      v.literal('assessment_updated'),
      v.literal('body_metrics_updated'),
    ),
    version: v.number(),
    createdAt: v.number(),
    fingerprint: v.string(),
    baseline: v.object({
      summary: v.string(),
      topGoals: v.array(v.string()),
      constraints: v.array(v.string()),
      recovery: v.string(),
      trainingAge: v.string(),
      weeklyTarget: v.string(),
      equipment: v.array(v.string()),
      anchorSummary: v.array(v.string()),
    }),
    trajectory: v.object({
      summary: v.string(),
      windowDays: v.number(),
      completedSessions: v.number(),
      activeDays: v.number(),
      topExercises: v.array(v.string()),
      recordHighlights: v.array(v.string()),
      bodyweightDeltaKg: v.union(v.number(), v.null()),
    }),
    currentState: v.object({
      summary: v.string(),
      windowDays: v.number(),
      recentSessions: v.number(),
      recentSetCount: v.number(),
      recentWorkFocus: v.array(v.string()),
      latestSessionAt: v.union(v.number(), v.null()),
      latestSessionSummary: v.union(v.string(), v.null()),
    }),
    profileContext: v.optional(v.object({
      identity: v.object({
        age: v.union(v.number(), v.null()),
        displayName: v.optional(v.union(v.string(), v.null())),
        genderIdentity: v.union(v.string(), v.null()),
      }),
      body: v.object({
        bodyFatPercent: v.union(v.number(), v.null()),
        bodyType: v.union(v.string(), v.null()),
        heightCm: v.number(),
        restingHeartRate: v.union(v.number(), v.null()),
        skeletalMuscleMassKg: v.union(v.number(), v.null()),
        weightKg: v.union(v.number(), v.null()),
      }),
      lifestyle: v.object({
        dailyMovement: v.union(v.string(), v.null()),
        eatingRoutine: v.union(v.string(), v.null()),
        idleMovement: v.union(v.string(), v.null()),
        usualSteps: v.union(v.string(), v.null()),
      }),
      trainingReality: v.object({
        effort: v.string(),
        equipmentAccess: v.array(v.string()),
        sessionDuration: v.string(),
        trainingAge: v.string(),
        trainingStyles: v.array(v.string()),
        weeklySessions: v.string(),
      }),
      goals: v.array(v.object({
        detail: v.union(v.string(), v.null()),
        focusAreas: v.array(v.string()),
        goal: v.string(),
      })),
      constraints: v.array(v.object({
        area: v.string(),
        customDetail: v.union(v.string(), v.null()),
        severity: v.union(v.string(), v.null()),
        timing: v.union(v.string(), v.null()),
      })),
      userNotes: v.union(v.string(), v.null()),
    })),
    watchouts: v.array(v.string()),
    signals: v.object({
      consistency: v.object({
        value: v.number(),
        trend: v.union(v.literal('up'), v.literal('flat'), v.literal('down')),
        confidence: v.union(v.literal('low'), v.literal('medium'), v.literal('high')),
        windowDays: v.number(),
        evidenceCount: v.number(),
        lastMaterialChangeAt: v.union(v.number(), v.null()),
      }),
      progression: v.object({
        value: v.number(),
        trend: v.union(v.literal('up'), v.literal('flat'), v.literal('down')),
        confidence: v.union(v.literal('low'), v.literal('medium'), v.literal('high')),
        windowDays: v.number(),
        evidenceCount: v.number(),
        lastMaterialChangeAt: v.union(v.number(), v.null()),
      }),
      workload: v.object({
        value: v.number(),
        trend: v.union(v.literal('up'), v.literal('flat'), v.literal('down')),
        confidence: v.union(v.literal('low'), v.literal('medium'), v.literal('high')),
        windowDays: v.number(),
        evidenceCount: v.number(),
        lastMaterialChangeAt: v.union(v.number(), v.null()),
      }),
      goalAlignment: v.object({
        value: v.number(),
        trend: v.union(v.literal('up'), v.literal('flat'), v.literal('down')),
        confidence: v.union(v.literal('low'), v.literal('medium'), v.literal('high')),
        windowDays: v.number(),
        evidenceCount: v.number(),
        lastMaterialChangeAt: v.union(v.number(), v.null()),
      }),
      recoveryRisk: v.object({
        value: v.number(),
        trend: v.union(v.literal('up'), v.literal('flat'), v.literal('down')),
        confidence: v.union(v.literal('low'), v.literal('medium'), v.literal('high')),
        windowDays: v.number(),
        evidenceCount: v.number(),
        lastMaterialChangeAt: v.union(v.number(), v.null()),
      }),
    }),
    renderedContext: v.string(),
  })
    .index('by_profile_id_and_created_at', ['profileId', 'createdAt']),
});

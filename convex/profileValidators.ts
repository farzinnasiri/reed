import { v } from 'convex/values';

export const recoveryQualityValidator = v.union(
  v.literal('solid'),
  v.literal('mixed'),
  v.literal('fragile'),
);

export const trainingAgeValidator = v.union(
  v.literal('starting'),
  v.literal('under_6_months'),
  v.literal('six_to_18_months'),
  v.literal('over_18_months'),
);

export const weeklySessionsValidator = v.union(
  v.literal('one_to_two'),
  v.literal('two_to_four'),
  v.literal('four_plus'),
);

export const sessionDurationValidator = v.union(
  v.literal('under_45'),
  v.literal('fortyfive_to_75'),
  v.literal('over_75'),
);

export const effortValidator = v.union(
  v.literal('easy'),
  v.literal('moderate'),
  v.literal('hard'),
);

export const trainingStyleValidator = v.union(
  v.literal('classic_gym'),
  v.literal('calisthenics'),
  v.literal('sport_support'),
  v.literal('cardio'),
  v.literal('mobility_rehab'),
);

export const equipmentAccessValidator = v.union(
  v.literal('full_gym'),
  v.literal('calisthenics_park'),
  v.literal('home_equipment'),
  v.literal('crowded_gym'),
  v.literal('no_fixed_equipment'),
);

export const primaryGoalValidator = v.union(
  v.literal('build_muscle'),
  v.literal('get_stronger'),
  v.literal('master_skill'),
  v.literal('support_sport'),
  v.literal('improve_conditioning'),
  v.literal('move_without_pain'),
);

export const constraintAreaValidator = v.union(
  v.literal('lower_back'),
  v.literal('neck'),
  v.literal('shoulder'),
  v.literal('knee'),
  v.literal('hip'),
  v.literal('wrist_elbow'),
  v.literal('heart'),
  v.literal('lungs'),
  v.literal('other'),
);

export const painSeverityValidator = v.union(
  v.literal('mild'),
  v.literal('moderate'),
  v.literal('high'),
);

export const painTimingValidator = v.union(
  v.literal('under_load'),
  v.literal('daily_life'),
  v.literal('recent_injury'),
);

export const goalDetailValidator = v.object({
  customDetail: v.union(v.string(), v.null()),
  detail: v.union(v.string(), v.null()),
  focusAreas: v.array(v.string()),
});

export const constraintDetailValidator = v.object({
  customDetail: v.union(v.string(), v.null()),
  severity: v.union(painSeverityValidator, v.null()),
  timing: v.union(painTimingValidator, v.null()),
});

export const bodyMetricKeyValidator = v.union(
  v.literal('body_weight'),
  v.literal('body_fat_percent'),
  v.literal('skeletal_muscle_mass'),
  v.literal('resting_heart_rate'),
);

export const bodyMetricUnitValidator = v.union(
  v.literal('kg'),
  v.literal('percent'),
  v.literal('bpm'),
);

export const strengthAnchorKeyValidator = v.union(
  v.literal('squat'),
  v.literal('bench_press'),
  v.literal('deadlift'),
  v.literal('overhead_press'),
  v.literal('pull_up'),
  v.literal('push_up'),
  v.literal('dip'),
);

export const strengthAssessmentKindValidator = v.union(
  v.literal('loaded_reps'),
  v.literal('bodyweight_reps'),
);

export const cardioAnchorKeyValidator = v.union(
  v.literal('run_1km'),
  v.literal('run_5km'),
  v.literal('stair_test'),
);

export const cardioModalityValidator = v.union(v.literal('running'), v.literal('stairs'));

export const trainingProfileValidator = v.object({
  baseline: v.object({
    birthDay: v.number(),
    birthMonth: v.number(),
    birthYear: v.number(),
    heightCm: v.number(),
    recoveryQuality: recoveryQualityValidator,
  }),
  constraints: v.object({
    areas: v.array(constraintAreaValidator),
    details: v.record(v.string(), constraintDetailValidator),
  }),
  aiContextSummary: v.optional(v.string()),
  goalDetails: v.record(v.string(), goalDetailValidator),
  profileId: v.id('profiles'),
  profilingConsent: v.literal(true),
  rankedGoals: v.array(primaryGoalValidator),
  source: v.union(v.literal('onboarding'), v.literal('manual')),
  trainingReality: v.object({
    effort: effortValidator,
    equipmentAccess: v.array(equipmentAccessValidator),
    sessionDuration: sessionDurationValidator,
    trainingAge: trainingAgeValidator,
    trainingStyles: v.array(trainingStyleValidator),
    weeklySessions: weeklySessionsValidator,
  }),
  updatedAt: v.number(),
  userNotes: v.optional(v.union(v.string(), v.null())),
  version: v.number(),
});

export const completeOnboardingArgsFields = {
  displayName: v.string(),
  baseline: v.object({
    birthDay: v.number(),
    birthMonth: v.number(),
    birthYear: v.number(),
    heightCm: v.number(),
    recoveryQuality: recoveryQualityValidator,
  }),
  constraints: v.object({
    areas: v.array(constraintAreaValidator),
    details: v.record(v.string(), constraintDetailValidator),
  }),
  goalDetails: v.record(v.string(), goalDetailValidator),
  bodyMetrics: v.object({
    bodyFatPercent: v.union(v.number(), v.null()),
    restingHeartRate: v.union(v.number(), v.null()),
    skeletalMuscleMassKg: v.union(v.number(), v.null()),
    weightKg: v.union(v.number(), v.null()),
  }),
  performanceAnchors: v.object({
    bodyweight: v.record(v.string(), v.number()),
    cardio: v.object({
      run1KmSeconds: v.union(v.number(), v.null()),
      run5KmSeconds: v.union(v.number(), v.null()),
      stairFloors: v.union(v.number(), v.null()),
      stairMinutes: v.union(v.number(), v.null()),
    }),
    loaded: v.record(v.string(), v.object({
      loadKg: v.union(v.number(), v.null()),
      reps: v.union(v.number(), v.null()),
    })),
  }),
  userNotes: v.union(v.string(), v.null()),
  profilingConsent: v.literal(true),
  rankedGoals: v.array(primaryGoalValidator),
  trainingReality: v.object({
    effort: effortValidator,
    equipmentAccess: v.array(equipmentAccessValidator),
    sessionDuration: sessionDurationValidator,
    trainingAge: trainingAgeValidator,
    trainingStyles: v.array(trainingStyleValidator),
    weeklySessions: weeklySessionsValidator,
  }),
};

export const completeOnboardingArgsValidator = v.object(completeOnboardingArgsFields);
export type CompleteOnboardingPayload = {
  displayName: string;
  baseline: {
    birthDay: number;
    birthMonth: number;
    birthYear: number;
    heightCm: number;
    recoveryQuality: 'solid' | 'mixed' | 'fragile';
  };
  bodyMetrics: {
    bodyFatPercent: number | null;
    restingHeartRate: number | null;
    skeletalMuscleMassKg: number | null;
    weightKg: number | null;
  };
  constraints: {
    areas: string[];
    details: Record<string, { customDetail: string | null; severity: string | null; timing: string | null }>;
  };
  goalDetails: Record<string, { customDetail: string | null; detail: string | null; focusAreas: string[] }>;
  performanceAnchors: {
    bodyweight: Record<string, number>;
    cardio: {
      run1KmSeconds: number | null;
      run5KmSeconds: number | null;
      stairFloors: number | null;
      stairMinutes: number | null;
    };
    loaded: Record<string, { loadKg: number | null; reps: number | null }>;
  };
  userNotes: string | null;
  profilingConsent: true;
  rankedGoals: string[];
  trainingReality: {
    effort: 'easy' | 'moderate' | 'hard';
    equipmentAccess: string[];
    sessionDuration: 'under_45' | 'fortyfive_to_75' | 'over_75';
    trainingAge: 'starting' | 'under_6_months' | 'six_to_18_months' | 'over_18_months';
    trainingStyles: string[];
    weeklySessions: 'one_to_two' | 'two_to_four' | 'four_plus';
  };
};

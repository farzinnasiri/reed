import { v } from 'convex/values';
import { onboardingAnswersValidator } from './onboardingValidators';

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
  onboarding: onboardingAnswersValidator,
  profileId: v.id('profiles'), profilingConsent: v.literal(true),
  source: v.union(v.literal('onboarding'), v.literal('manual')),
  updatedAt: v.number(), version: v.number(),
});

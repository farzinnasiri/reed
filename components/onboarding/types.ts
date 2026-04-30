// ---------------------------------------------------------------------------
// Onboarding draft types and step definitions.
// The draft accumulates answers across all steps, validated at the boundaries.
// ---------------------------------------------------------------------------

// Base steps are fixed. Goal-detail steps are dynamically inserted after
// 'priorities', one per ranked goal that has a follow-up question.
export type OnboardingBaseStep =
  | 'name'
  | 'consent'
  | 'baseline'
  | 'training-reality'
  | 'priorities'
  | 'constraints'
  | 'performance-anchors'
  | 'notes'
  | 'review';

// Used for goToStep (edit shortcuts from review screen)
export type OnboardingStep = OnboardingBaseStep;

export const BASE_ONBOARDING_STEPS: readonly OnboardingBaseStep[] = [
  'name',
  'consent',
  'baseline',
  'training-reality',
  'priorities',
  'constraints',
  'performance-anchors',
  'notes',
  'review',
] as const;

export type RecoveryQuality = 'solid' | 'mixed' | 'fragile';
export type TrainingAge = 'starting' | 'under_6_months' | 'six_to_18_months' | 'over_18_months';
export type WeeklySessions = 'one_to_two' | 'two_to_four' | 'four_plus';
export type SessionDuration = 'under_45' | 'fortyfive_to_75' | 'over_75';
export type Effort = 'easy' | 'moderate' | 'hard';
export type PainSeverity = 'mild' | 'moderate' | 'high';
export type PainTiming = 'under_load' | 'daily_life' | 'recent_injury';

export type PrimaryGoal =
  | 'build_muscle'
  | 'get_stronger'
  | 'master_skill'
  | 'support_sport'
  | 'improve_conditioning'
  | 'move_without_pain';

export type TrainingStyle = 'classic_gym' | 'calisthenics' | 'sport_support' | 'cardio' | 'mobility_rehab';
export type EquipmentAccess = 'full_gym' | 'calisthenics_park' | 'home_equipment' | 'crowded_gym' | 'no_fixed_equipment';
export type ConstraintArea = 'lower_back' | 'neck' | 'shoulder' | 'knee' | 'hip' | 'wrist_elbow' | 'heart' | 'lungs' | 'other';
export type LoadedStrengthAnchorKey = 'squat' | 'bench_press' | 'deadlift' | 'overhead_press';
export type BodyweightStrengthAnchorKey = 'pull_up' | 'push_up' | 'dip';
export type CardioAnchorKey = 'run_1km' | 'run_5km' | 'stair_test';

export type ConstraintDetailData = {
  severity: PainSeverity | null;
  timing: PainTiming | null;
  customDetail: string | null;
};

// ---------------------------------------------------------------------------
// Per-goal detail — keyed by PrimaryGoal.
// Each goal that has a follow-up page stores its answers here.
// ---------------------------------------------------------------------------
export type GoalDetailData = {
  /** Generic detail: skill name, sport name, conditioning modality, etc. */
  detail: string | null;
  /** Custom free-text if detail === 'other' */
  customDetail: string | null;
  /** Focus areas (for build_muscle, get_stronger) */
  focusAreas: string[];
};

export type LoadedStrengthAnchorInput = {
  loadKg: string;
  reps: string;
};

export type CardioAnchorInput = {
  floors: string;
  minutes: string;
  run1KmTime: string;
  run5KmTime: string;
};

/** Goals that have a dedicated follow-up page. move_without_pain needs no detail. */
export const GOALS_WITH_DETAIL: readonly PrimaryGoal[] = [
  'build_muscle',
  'get_stronger',
  'master_skill',
  'support_sport',
  'improve_conditioning',
];

export function goalHasDetail(goal: PrimaryGoal): boolean {
  return GOALS_WITH_DETAIL.includes(goal);
}

export function emptyGoalDetail(): GoalDetailData {
  return { detail: null, customDetail: null, focusAreas: [] };
}

/**
 * Mutable draft that accumulates answers across all onboarding steps.
 * All fields start as null/empty and get filled as the user progresses.
 */
export type OnboardingDraft = {
  // Step 1 — Name
  displayName: string;

  // Step 2 — Consent
  profilingConsent: boolean | null;

  // Step 3 — Baseline
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  heightCm: string;   // string for input binding, parsed on validation
  weightKg: string;
  recoveryQuality: RecoveryQuality;
  // optional body composition
  bodyFatPercent: string;
  skeletalMuscleMassKg: string;
  restingHeartRate: string;

  // Step 3 — Training Reality
  trainingAge: TrainingAge;
  weeklySessions: WeeklySessions;
  sessionDuration: SessionDuration;
  effort: Effort;
  trainingStyles: TrainingStyle[];
  equipmentAccess: EquipmentAccess[];

  // Step 4 — Goals
  /** Ordered list: index 0 = top priority. Up to 3. */
  rankedGoals: PrimaryGoal[];
  /** Per-goal follow-up answers, keyed by PrimaryGoal value. */
  goalDetails: Partial<Record<PrimaryGoal, GoalDetailData>>;

  // Step: Constraints (pain & health)
  constraintAreas: ConstraintArea[];
  constraintDetails: Partial<Record<ConstraintArea, ConstraintDetailData>>;

  // Step: Performance anchors (optional for 6+ month trainees)
  loadedStrengthAnchors: Partial<Record<LoadedStrengthAnchorKey, LoadedStrengthAnchorInput>>;
  bodyweightStrengthAnchors: Partial<Record<BodyweightStrengthAnchorKey, string>>;
  cardioAnchor: CardioAnchorInput;

  // Step: Notes (optional free-text)
  userNotes: string;
};

export const EMPTY_DRAFT: OnboardingDraft = {
  displayName: '',
  profilingConsent: null,
  birthYear: null,
  birthMonth: null,
  birthDay: null,
  heightCm: '',
  weightKg: '',
  recoveryQuality: 'solid',
  bodyFatPercent: '',
  skeletalMuscleMassKg: '',
  restingHeartRate: '',
  trainingAge: 'starting',
  weeklySessions: 'one_to_two',
  sessionDuration: 'under_45',
  effort: 'easy',
  trainingStyles: [],
  equipmentAccess: [],
  rankedGoals: [],
  goalDetails: {},
  constraintAreas: [],
  constraintDetails: {},
  loadedStrengthAnchors: {},
  bodyweightStrengthAnchors: {},
  cardioAnchor: {
    floors: '',
    minutes: '',
    run1KmTime: '',
    run5KmTime: '',
  },
  userNotes: '',
};

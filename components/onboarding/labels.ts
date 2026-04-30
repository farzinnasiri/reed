// ---------------------------------------------------------------------------
// labels.ts — Centralized label maps and configuration for onboarding.
// ---------------------------------------------------------------------------

import type {
  ConstraintArea,
  EquipmentAccess,
  PrimaryGoal,
  TrainingStyle,
} from './types';

// ---------------------------------------------------------------------------
// Goal Priorities
// ---------------------------------------------------------------------------
export const GOAL_OPTIONS = [
  { label: 'Build muscle', value: 'build_muscle' as const, subtitle: 'Size and body composition' },
  { label: 'Get stronger', value: 'get_stronger' as const, subtitle: 'Lifting numbers and power' },
  { label: 'Master a skill', value: 'master_skill' as const, subtitle: 'Calisthenics, technique work' },
  { label: 'Support a sport', value: 'support_sport' as const, subtitle: 'Seasonal and off-season prep' },
  { label: 'Improve conditioning', value: 'improve_conditioning' as const, subtitle: 'Aerobic base and stamina' },
  { label: 'Move without pain', value: 'move_without_pain' as const, subtitle: 'Rehab, mobility, longevity' },
];

export const GOAL_LABELS: Record<PrimaryGoal, string> = {
  build_muscle: 'Build muscle',
  get_stronger: 'Get stronger',
  master_skill: 'Master a skill',
  support_sport: 'Support a sport',
  improve_conditioning: 'Improve conditioning',
  move_without_pain: 'Move without pain',
};

export const GOAL_PROSE_LABELS: Record<string, string> = {
  build_muscle: 'muscle building',
  get_stronger: 'strength development',
  master_skill: 'skill mastery',
  support_sport: 'sport support',
  improve_conditioning: 'conditioning improvement',
  move_without_pain: 'pain-free movement',
};

// ---------------------------------------------------------------------------
// Training Reality Options
// ---------------------------------------------------------------------------
export const TRAINING_AGE_OPTIONS = [
  { label: 'Starting', value: 'starting' as const },
  { label: '< 6 mo', value: 'under_6_months' as const },
  { label: '6-18 mo', value: 'six_to_18_months' as const },
  { label: '18+ mo', value: 'over_18_months' as const },
];

export const WEEKLY_OPTIONS = [
  { label: '1-2×', value: 'one_to_two' as const },
  { label: '2-4×', value: 'two_to_four' as const },
  { label: '4+×', value: 'four_plus' as const },
];

export const DURATION_OPTIONS = [
  { label: '< 45m', value: 'under_45' as const },
  { label: '45-75m', value: 'fortyfive_to_75' as const },
  { label: '75m+', value: 'over_75' as const },
];

export const EFFORT_OPTIONS = [
  { label: 'Easy', value: 'easy' as const },
  { label: 'Moderate', value: 'moderate' as const },
  { label: 'Hard', value: 'hard' as const },
];

export const RECOVERY_OPTIONS = [
  { label: 'Solid', value: 'solid' as const },
  { label: 'Mixed', value: 'mixed' as const },
  { label: 'Fragile', value: 'fragile' as const },
];

export const TRAINING_STYLE_CHIPS: { label: string; value: TrainingStyle }[] = [
  { label: 'Classic gym', value: 'classic_gym' },
  { label: 'Calisthenics', value: 'calisthenics' },
  { label: 'Sport support', value: 'sport_support' },
  { label: 'Cardio', value: 'cardio' },
  { label: 'Mobility / rehab', value: 'mobility_rehab' },
];

export const EQUIPMENT_CHIPS: { label: string; value: EquipmentAccess }[] = [
  { label: 'Full gym', value: 'full_gym' },
  { label: 'Calisthenics park', value: 'calisthenics_park' },
  { label: 'Home equipment', value: 'home_equipment' },
  { label: 'Crowded gym', value: 'crowded_gym' },
  { label: 'No fixed equipment', value: 'no_fixed_equipment' },
];

// ---------------------------------------------------------------------------
// Prose Labels for Review Summary (Reality)
// ---------------------------------------------------------------------------
export const WEEKLY_PROSE_LABELS: Record<string, string> = {
  one_to_two: '1-2 sessions per week',
  two_to_four: '2-4 sessions per week',
  four_plus: '4+ sessions per week',
};

export const DURATION_PROSE_LABELS: Record<string, string> = {
  under_45: 'under 45 minutes',
  fortyfive_to_75: '45-75 minutes',
  over_75: '75+ minutes',
};

export const EFFORT_PROSE_LABELS: Record<string, string> = {
  easy: 'easy effort',
  moderate: 'moderate effort',
  hard: 'hard effort',
};

export const RECOVERY_PROSE_LABELS: Record<string, string> = {
  solid: 'solid recovery',
  mixed: 'mixed recovery',
  fragile: 'fragile recovery',
};

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------
export const CONSTRAINT_CHIPS: { label: string; value: ConstraintArea }[] = [
  { label: 'Lower back', value: 'lower_back' },
  { label: 'Neck', value: 'neck' },
  { label: 'Shoulder', value: 'shoulder' },
  { label: 'Knee', value: 'knee' },
  { label: 'Hip', value: 'hip' },
  { label: 'Wrist / elbow', value: 'wrist_elbow' },
  { label: 'Heart', value: 'heart' },
  { label: 'Lungs', value: 'lungs' },
  { label: 'Other', value: 'other' },
];

export const CONSTRAINT_LABELS: Record<ConstraintArea, string> = {
  lower_back: 'Lower back',
  neck: 'Neck',
  shoulder: 'Shoulder',
  knee: 'Knee',
  hip: 'Hip',
  wrist_elbow: 'Wrist / elbow',
  heart: 'Heart',
  lungs: 'Lungs',
  other: 'Other issue',
};

export const PAIN_SEVERITY_OPTIONS = [
  { label: 'Mild', value: 'mild' as const },
  { label: 'Moderate', value: 'moderate' as const },
  { label: 'High', value: 'high' as const },
];

export const PAIN_TIMING_OPTIONS = [
  { label: 'Under load', value: 'under_load' as const },
  { label: 'Daily life', value: 'daily_life' as const },
  { label: 'Recent injury', value: 'recent_injury' as const },
];

export const PAIN_PROSE_LABELS: Record<string, string> = {
  lower_back: 'lower back',
  neck: 'neck',
  shoulder: 'shoulder',
  knee: 'knee',
  hip: 'hip',
  wrist_elbow: 'wrist/elbow',
  heart: 'heart conditions',
  lungs: 'lung/breathing issues',
  other: 'other health issue',
};

// ---------------------------------------------------------------------------
// Goal Details (Skills, Sports, Conditioning, Lifts, Muscle Focus)
// ---------------------------------------------------------------------------
export const MUSCLE_FOCUS_CHIPS = [
  { label: 'Chest', value: 'chest' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Back', value: 'back' },
  { label: 'Arms', value: 'arms' },
  { label: 'Legs', value: 'legs' },
  { label: 'Abs', value: 'abs' },
];

export const LIFT_CHIPS = [
  { label: 'Squat', value: 'squat' },
  { label: 'Front squat', value: 'front_squat' },
  { label: 'Bench', value: 'bench' },
  { label: 'Incline bench', value: 'incline_bench' },
  { label: 'Deadlift', value: 'deadlift' },
  { label: 'Romanian deadlift', value: 'romanian_deadlift' },
  { label: 'Overhead press', value: 'overhead_press' },
  { label: 'Barbell row', value: 'barbell_row' },
  { label: 'Hip thrust', value: 'hip_thrust' },
  { label: 'Weighted pull-up', value: 'weighted_pull_up' },
];

export const SKILL_GROUPS = [
  {
    title: 'Calisthenics (Basics)',
    options: [
      { label: 'Pull-up', value: 'pull_up' },
      { label: 'Dip', value: 'dip' },
      { label: 'Push-up', value: 'push_up' },
      { label: 'Pistol squat', value: 'pistol_squat' },
    ],
  },
  {
    title: 'Calisthenics (Statics)',
    options: [
      { label: 'Handstand', value: 'handstand' },
      { label: 'Front lever', value: 'front_lever' },
      { label: 'Back lever', value: 'back_lever' },
      { label: 'Planche', value: 'planche' },
      { label: 'L-sit', value: 'l_sit' },
    ],
  },
  {
    title: 'Calisthenics (Dynamics)',
    options: [
      { label: 'Muscle-up', value: 'muscle_up' },
      { label: 'Ring muscle-up', value: 'ring_muscle_up' },
      { label: 'Handstand push-up', value: 'handstand_push_up' },
      { label: 'One-arm pull-up', value: 'one_arm_pull_up' },
      { label: 'Human flag', value: 'human_flag' },
    ],
  },
  {
    title: 'Weightlifting',
    options: [
      { label: 'Snatch', value: 'snatch' },
      { label: 'Clean & Jerk', value: 'clean_and_jerk' },
      { label: 'Power clean', value: 'power_clean' },
    ],
  },
  {
    title: 'Custom',
    options: [{ label: 'Other skill...', value: 'other' }],
  },
];


export const SPORT_GROUPS = [
  {
    title: 'Combat & Martial Arts',
    options: [
      { label: 'BJJ', value: 'bjj' },
      { label: 'Boxing', value: 'boxing' },
      { label: 'Muay Thai', value: 'muay_thai' },
      { label: 'Wrestling', value: 'wrestling' },
      { label: 'MMA', value: 'mma' },
    ],
  },
  {
    title: 'Court & Field',
    options: [
      { label: 'Basketball', value: 'basketball' },
      { label: 'Soccer', value: 'soccer' },
      { label: 'Tennis', value: 'tennis' },
      { label: 'Volleyball', value: 'volleyball' },
      { label: 'Football', value: 'football' },
      { label: 'Rugby', value: 'rugby' },
      { label: 'Baseball/Softball', value: 'baseball_softball' },
      { label: 'Track & Field', value: 'track_field' },
    ],
  },
  {
    title: 'Endurance',
    options: [
      { label: 'Marathon', value: 'marathon' },
      { label: 'Triathlon', value: 'triathlon' },
      { label: 'Cycling (Road)', value: 'cycling_road' },
      { label: 'Swimming', value: 'swimming' },
      { label: 'Rowing', value: 'rowing' },
      { label: 'Hyrox', value: 'hyrox' },
    ],
  },
  {
    title: 'Action & Outdoors',
    options: [
      { label: 'Snowboarding/Skiing', value: 'snow_sports' },
      { label: 'Surfing', value: 'surfing' },
      { label: 'Climbing', value: 'climbing' },
      { label: 'Hiking', value: 'hiking' },
      { label: 'Skateboarding', value: 'skateboarding' },
      { label: 'Mountain biking', value: 'mountain_biking' },
    ],
  },
  {
    title: 'Custom',
    options: [{ label: 'Other sport...', value: 'other' }],
  },
];


export const CONDITIONING_GROUPS = [
  {
    title: 'Machines (Indoor)',
    options: [
      { label: 'Row (Erg)', value: 'row_erg' },
      { label: 'SkiErg', value: 'skierg' },
      { label: 'Assault/Echo Bike', value: 'air_bike' },
      { label: 'Stationary Bike', value: 'stationary_bike' },
      { label: 'Treadmill', value: 'treadmill' },
      { label: 'Stairmaster', value: 'stairmaster' },
    ],
  },
  {
    title: 'Outdoor & Track',
    options: [
      { label: 'Running (Road/Track)', value: 'running_road' },
      { label: 'Trail Running', value: 'trail_running' },
      { label: 'Cycling (Outdoor)', value: 'cycling_outdoor' },
      { label: 'Rucking', value: 'rucking' },
      { label: 'Jump rope', value: 'jump_rope' },
      { label: 'Hill sprints', value: 'hill_sprints' },
    ],
  },
  {
    title: 'Custom',
    options: [{ label: 'Other modality...', value: 'other' }],
  },
];

// ---------------------------------------------------------------------------
// Detail Prose Labels
// ---------------------------------------------------------------------------
export const GOAL_DETAIL_PROSE_LABELS: Record<string, string> = {
  // Skills
  pull_up: 'pull-ups',
  dip: 'dips',
  push_up: 'push-ups',
  pistol_squat: 'pistol squats',
  handstand: 'handstand',
  front_lever: 'front lever',
  back_lever: 'back lever',
  planche: 'planche',
  l_sit: 'l-sit',
  muscle_up: 'muscle-ups',
  ring_muscle_up: 'ring muscle-ups',
  handstand_push_up: 'handstand push-ups',
  one_arm_pull_up: 'one-arm pull-ups',
  human_flag: 'human flag',
  snatch: 'snatch',
  clean_and_jerk: 'clean & jerk',
  power_clean: 'power clean',
  
  // Sports
  bjj: 'BJJ',
  boxing: 'boxing',
  muay_thai: 'Muay Thai',
  wrestling: 'wrestling',
  mma: 'MMA',
  basketball: 'basketball',
  soccer: 'soccer',
  tennis: 'tennis',
  volleyball: 'volleyball',
  football: 'football',
  rugby: 'rugby',
  baseball_softball: 'baseball/softball',
  track_field: 'track & field',
  marathon: 'marathon',
  triathlon: 'triathlon',
  cycling_road: 'road cycling',
  swimming: 'swimming',
  rowing: 'rowing',
  hyrox: 'hyrox',
  snow_sports: 'snow sports',
  surfing: 'surfing',
  climbing: 'climbing',
  hiking: 'hiking',
  skateboarding: 'skateboarding',
  mountain_biking: 'mountain biking',

  // Conditioning
  row_erg: 'rowing',
  skierg: 'SkiErg',
  air_bike: 'air bike',
  stationary_bike: 'stationary bike',
  treadmill: 'treadmill',
  stairmaster: 'stairmaster',
  running_road: 'running',
  trail_running: 'trail running',
  cycling_outdoor: 'outdoor cycling',
  rucking: 'rucking',
  jump_rope: 'jump rope',
  hill_sprints: 'hill sprints',

  // Strength focus
  front_squat: 'front squat',
  incline_bench: 'incline bench',
  romanian_deadlift: 'Romanian deadlift',
  barbell_row: 'barbell row',
  hip_thrust: 'hip thrust',
};


export const FOCUS_PROSE_LABELS: Record<string, string> = {
  chest: 'chest',
  shoulders: 'shoulders',
  back: 'back',
  arms: 'arms',
  legs: 'legs',
  abs: 'abs',
  squat: 'squat',
  bench: 'bench',
  deadlift: 'deadlift',
  overhead_press: 'overhead press',
  weighted_pull_up: 'weighted pull-up',
};

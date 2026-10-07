import regions from '../../assets/body-3d/v3.4/regions.json';

/** Persisted data revision; independent of the product name. */
export const ONBOARDING_SCHEMA_VERSION = 2 as const;

export const WORLDS = ['dance', 'snow', 'water', 'climb', 'wheels', 'run', 'movement', 'strength', 'combat', 'team'] as const;
export const VALUES = ['feel-good', 'improve', 'perform', 'appearance', 'longevity', 'social', 'adventure', 'clear-head'] as const;
export const SHAPES = ['very_lean', 'lean', 'average_lean', 'soft_middle', 'average', 'high_fat', 'larger_high_fat', 'muscular_solid', 'athletic_muscular'] as const;
export type MovementValue = typeof VALUES[number];
export type OnboardingAnswers = {
  practices: { id: string; label: string; world: typeof WORLDS[number]; level: number }[];
  values: MovementValue[];
  consent: true;
  sex: 'male' | 'female' | 'other' | 'private';
  birthYear: number;
  heightCm: number;
  weightKg: number;
  shape: typeof SHAPES[number];
  bodyMapDone: boolean;
  discomfort: { regionId: string; intensity: number }[];
  sleep: number | null;
  sleepQuality: number | null;
  dayLoad: 'sitting' | 'feet' | 'physical' | 'varies' | null;
  days: ('free' | 'fixed' | 'off')[];
  rhythm: 'plan' | 'rotate' | 'daily' | null;
  blockWeeks: number;
  push: number;
  notes: string | null;
};
export const VALUE_LABELS: Record<MovementValue, string> = {
  'feel-good': 'Feel good in my body', improve: 'Get better at things', perform: 'Perform and compete', appearance: 'Look the way I want',
  longevity: 'Stay healthy for the long run', social: 'Be with people', adventure: 'Adventure and challenge', 'clear-head': 'Clear my head',
};
export const VALUE_GUIDANCE: Record<MovementValue, string> = {
  'feel-good': 'Build sessions around feeling capable and moving comfortably.', improve: 'Protect skill practice and steady progression.',
  perform: 'Protect performance practice when time is tight.', appearance: 'Include strength work for physique priorities.',
  longevity: 'Start with conservative loads and protect recovery.', social: 'Count social classes as training.',
  adventure: 'Use trips as plan anchors when supplied.', 'clear-head': 'Keep an easy option for difficult days.',
};
export const MAX_COACH_NOTES_LENGTH = 4000;
export const PAIN_LABELS = ['None', 'Mild', 'Moderate', 'Strong', 'Severe'] as const;
export const regionLabel = new Map(regions.map(region => [region.id, region.label]));
export function rankedPractices(answers: OnboardingAnswers) {
  return [...answers.practices].sort((a, b) => b.level - a.level);
}
/** Matches the starting support dose shown in the onboarding overview. Existing classes count. */
export function startingWeeklyTarget(answers: OnboardingAnswers): 1 | 2 | 3 | 4 | 5 | 6 | 7 | null {
  const fixed = answers.days.filter(day => day === 'fixed').length;
  const free = answers.days.filter(day => day === 'free').length;
  const support = answers.values.includes('longevity') || answers.push === 0 ? 2 : answers.push === 1 ? 3 : 4;
  const days = fixed + Math.min(free, support);
  return days === 0 ? null : days as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}
export function onboardingComplete(profile: { onboardingCompletedAt?: number; onboardingVersion?: number } | null | undefined) {
  return !!profile?.onboardingCompletedAt && profile.onboardingVersion === ONBOARDING_SCHEMA_VERSION;
}
export function recoveryDescription(answers: OnboardingAnswers) {
  if (answers.sleep === null) return 'Sleep not answered';
  const hours = ['Under 6 hours', '6–7 hours', '7–8 hours', '8+ hours'][answers.sleep];
  const quality = answers.sleepQuality === null ? '' : `, ${['restless', 'broken', 'okay', 'good', 'rested'][answers.sleepQuality]}`;
  return hours + quality;
}
export function onboardingCoachingContext(answers: OnboardingAnswers) {
  return [
    'ONBOARDING. These are starting preferences, not logged training or diagnosed injuries.',
    `Practices: ${rankedPractices(answers).map(p => `${p.label}, level ${p.level}/4`).join('; ')}.`,
    answers.values.length ? `Why they work out, in priority order: ${answers.values.map((v, i) => `${i + 1}. ${VALUE_LABELS[v]}: ${VALUE_GUIDANCE[v]}`).join(' ')}` : 'Motivation was skipped. Do not infer a goal.',
    `Birth year ${answers.birthYear}, height ${answers.heightCm} cm. Body shape is a self-selected visual reference, not a measured body-fat percentage.`,
    `Recovery: ${recoveryDescription(answers)}. Day load: ${answers.dayLoad ?? 'not answered'}.`,
    `Week, Monday first: ${answers.days.join(', ')}. Fixed means already training. Free means available, not a promised training day. Starting active-day dose: ${startingWeeklyTarget(answers) ?? 'none scheduled'}.`,
    `Coaching rhythm: ${answers.rhythm ?? 'not answered'}; rotation block ${answers.blockWeeks} weeks; requested push ${['ease me in', 'steady', 'push me'][answers.push]}.`,
    answers.bodyMapDone ? answers.discomfort.length ? `Self-reported discomfort: ${answers.discomfort.map(p => `${regionLabel.get(p.regionId)}: ${PAIN_LABELS[p.intensity]}`).join('; ')}.` : 'They reported nothing hurting during onboarding.' : 'Discomfort was skipped, not reported as absent.',
    answers.notes?.trim() ? `Additional context supplied by the user:\n${answers.notes.trim()}` : null,
    'Equipment, concrete goals, season dates and event dates were not asked. Clarify them when needed. Do not invent them.',
  ].filter(Boolean).join('\n');
}

import type { OnboardingAnswers } from '../../domains/profile/onboarding';

export function onboardingAnswers(patch: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  return {
    practices: [{ id: 'strength:Calisthenics', label: 'Calisthenics', world: 'strength', level: 2 }],
    values: ['improve'], consent: true, sex: 'private', birthYear: 1995, heightCm: 175, weightKg: 75,
    shape: 'average_lean', bodyMapDone: true, discomfort: [], sleep: 2, sleepQuality: 3, dayLoad: 'sitting',
    days: ['free', 'free', 'free', 'off', 'off', 'off', 'off'], rhythm: 'plan', blockWeeks: 2, push: 1, notes: null,
    ...patch,
  };
}

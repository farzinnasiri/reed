import type { OnboardingAnswers } from './onboarding';

/** A focused editor owns only these answers. Other profile facts are read at save time. */
type SingleField = 'sex' | 'birthYear' | 'heightCm' | 'weightKg' | 'shape' | 'practices' | 'values' | 'dayLoad' | 'days' | 'push' | 'notes';
export type ProfileChange = {
  [K in SingleField]: { field: K; value: OnboardingAnswers[K] }
}[SingleField]
  | { field: 'name'; value: string }
  | { field: 'sleep'; value: Pick<OnboardingAnswers, 'sleep' | 'sleepQuality'> }
  | { field: 'rhythm'; value: Pick<OnboardingAnswers, 'rhythm' | 'blockWeeks'> }
  | { field: 'discomfort'; value: OnboardingAnswers['discomfort'] };

export function applyProfileChange(answers: OnboardingAnswers, change: ProfileChange): OnboardingAnswers {
  switch (change.field) {
    case 'name': return answers;
    case 'sleep': return { ...answers, ...change.value };
    case 'rhythm': return { ...answers, ...change.value };
    case 'discomfort': return { ...answers, bodyMapDone: true, discomfort: change.value };
    default: return { ...answers, [change.field]: change.value };
  }
}

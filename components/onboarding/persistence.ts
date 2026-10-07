import type { OnboardingAnswers } from '@/domains/profile/onboarding';
import { regionById, regionByLabel } from '@/components/body-3d/contract';
import { EMPTY_DRAFT, derivePractices, type Draft } from './draft';

export function onboardingPayload(draft: Draft) {
  if (!draft.consent || !draft.sex || draft.birthYear === null || draft.heightCm === null || draft.weightKg === null || !draft.shape) throw new Error('Complete your body basics before saving.');
  const answers: OnboardingAnswers = {
    practices: derivePractices(draft).map(p => ({ id: p.id, label: p.label, world: p.category, level: p.level })),
    values: draft.values, consent: true, sex: draft.sex, birthYear: draft.birthYear, heightCm: draft.heightCm, weightKg: draft.weightKg, shape: draft.shape,
    bodyMapDone: draft.bodyMapDone,
    discomfort: Object.values(draft.bodyPain).map(p => {
      const region = regionByLabel.get(p.area);
      if (!region || !Number.isInteger(p.intensity) || p.intensity < 1 || p.intensity > 4) throw new Error('Choose severity for each discomfort area.');
      return { regionId: region.id, intensity: p.intensity };
    }),
    sleep: draft.sleep, sleepQuality: draft.sleep === null ? null : draft.sleepQuality,
    dayLoad: draft.dayLoad, days: draft.days,
    rhythm: draft.rhythm, blockWeeks: draft.blockWeeks, push: draft.push, notes: draft.notes.trim() || null,
  };
  return { displayName: draft.name.trim(), answers };
}
export function draftFromOnboarding(answers: OnboardingAnswers, name: string): Draft {
  return {
    ...EMPTY_DRAFT, name, consent: true, categories: [...new Set(answers.practices.map(p => p.world))],
    levels: Object.fromEntries(answers.practices.filter(p => p.level > 0).map(p => [p.id, p.level])),
    customs: Object.fromEntries([...new Set(answers.practices.map(p => p.world))].map(world => [world, answers.practices.filter(p => p.world === world && p.id !== world).map(p => p.label)])),
    values: answers.values,
    sex: answers.sex, birthYear: answers.birthYear, heightCm: answers.heightCm, weightKg: answers.weightKg, shape: answers.shape,
    bodyMapDone: answers.bodyMapDone,
    bodyPain: Object.fromEntries(answers.discomfort.flatMap(p => {
      const region = regionById.get(p.regionId);
      return region ? [[region.storedAreaLabel, { area: region.storedAreaLabel, intensity: p.intensity, view: 'front' as const, x: .5, y: .5 }]] : [];
    })),
    sleep: answers.sleep, sleepQuality: answers.sleepQuality, dayLoad: answers.dayLoad, days: answers.days,
    rhythm: answers.rhythm, blockWeeks: answers.blockWeeks, push: answers.push, notes: answers.notes ?? '',
  };
}

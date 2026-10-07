import { ConvexError, v } from 'convex/values';
import { WORLDS, VALUES, SHAPES, MAX_COACH_NOTES_LENGTH, regionLabel, type OnboardingAnswers } from '../domains/profile/onboarding';
const literals = <T extends string>(values: readonly T[]) => v.union(...values.map(value => v.literal(value)));
export const onboardingAnswersValidator = v.object({
  practices: v.array(v.object({ id: v.string(), label: v.string(), world: literals(WORLDS), level: v.number() })),
  values: v.array(literals(VALUES)), consent: v.literal(true), sex: literals(['male', 'female', 'other', 'private'] as const),
  birthYear: v.number(), heightCm: v.number(), weightKg: v.number(), shape: literals(SHAPES), bodyMapDone: v.boolean(),
  discomfort: v.array(v.object({ regionId: v.string(), intensity: v.number() })),
  sleep: v.union(v.number(), v.null()), sleepQuality: v.union(v.number(), v.null()),
  dayLoad: v.union(literals(['sitting', 'feet', 'physical', 'varies'] as const), v.null()),
  days: v.array(literals(['free', 'fixed', 'off'] as const)), rhythm: v.union(literals(['plan', 'rotate', 'daily'] as const), v.null()),
  blockWeeks: v.number(), push: v.number(), notes: v.union(v.string(), v.null()),
});
const fields = onboardingAnswersValidator.fields;
export const profileChangeValidator = v.union(
  v.object({ field: v.literal('name'), value: v.string() }),
  v.object({ field: v.literal('sex'), value: fields.sex }),
  v.object({ field: v.literal('birthYear'), value: fields.birthYear }),
  v.object({ field: v.literal('heightCm'), value: fields.heightCm }),
  v.object({ field: v.literal('weightKg'), value: fields.weightKg }),
  v.object({ field: v.literal('shape'), value: fields.shape }),
  v.object({ field: v.literal('practices'), value: fields.practices }),
  v.object({ field: v.literal('values'), value: fields.values }),
  v.object({ field: v.literal('dayLoad'), value: fields.dayLoad }),
  v.object({ field: v.literal('days'), value: fields.days }),
  v.object({ field: v.literal('push'), value: fields.push }),
  v.object({ field: v.literal('notes'), value: fields.notes }),
  v.object({ field: v.literal('sleep'), value: v.object({ sleep: fields.sleep, sleepQuality: fields.sleepQuality }) }),
  v.object({ field: v.literal('rhythm'), value: v.object({ rhythm: fields.rhythm, blockWeeks: fields.blockWeeks }) }),
  v.object({ field: v.literal('discomfort'), value: fields.discomfort }),
);
export function validateOnboarding(name: string, answers: OnboardingAnswers, now: number) {
  const range = (value: number, min: number, max: number, label: string, integer = false) => {
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new ConvexError(`Invalid ${label}.`);
  };
  if (!name.trim() || name.trim().length > 60) throw new ConvexError('Name must be between 1 and 60 characters.');
  if (answers.notes && (answers.notes.length > MAX_COACH_NOTES_LENGTH || answers.notes !== answers.notes.trim())) throw new ConvexError('Invalid coach notes.');
  const year = new Date(now).getUTCFullYear();
  range(answers.birthYear, year - 110, year - 13, 'birth year', true);
  range(answers.heightCm, 100, 240, 'height'); range(answers.weightKg, 25, 250, 'weight');
  range(answers.blockWeeks, 1, 4, 'rotation block', true); range(answers.push, 0, 2, 'push level', true);
  if (answers.sleep !== null) range(answers.sleep, 0, 3, 'sleep', true);
  if (answers.sleepQuality !== null) {
    if (answers.sleep === null) throw new ConvexError('Sleep quality needs a sleep answer.');
    range(answers.sleepQuality, 0, 4, 'sleep quality', true);
  }
  if (answers.days.length !== 7) throw new ConvexError('The week must contain seven days.');
  if (answers.values.length > 3 || new Set(answers.values).size !== answers.values.length) throw new ConvexError('Choose up to three distinct priorities.');
  if (!answers.practices.length || answers.practices.length > 50 || new Set(answers.practices.map(p => p.id)).size !== answers.practices.length) throw new ConvexError('Choose distinct practices.');
  for (const p of answers.practices) {
    range(p.level, 0, 4, 'practice level', true);
    if (!p.label.trim() || p.label.length > 60 || p.label !== p.label.trim() || !(p.id === p.world || p.id === `${p.world}:${p.label}`)) throw new ConvexError('Invalid practice.');
  }
  if (answers.discomfort.length > regionLabel.size || new Set(answers.discomfort.map(p => p.regionId)).size !== answers.discomfort.length) throw new ConvexError('Choose distinct discomfort areas.');
  if (!answers.bodyMapDone && answers.discomfort.length) throw new ConvexError('Discomfort must be answered before saving areas.');
  for (const p of answers.discomfort) {
    if (!regionLabel.has(p.regionId)) throw new ConvexError('Unknown discomfort area.');
    range(p.intensity, 1, 4, 'discomfort severity', true);
  }
}

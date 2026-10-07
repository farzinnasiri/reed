/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import schema from './schema';
import { api, internal } from './_generated/api';
import { onboardingComplete, startingWeeklyTarget, type OnboardingAnswers } from '../domains/profile/onboarding';

const modules = import.meta.glob('./**/*.ts');
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const answers: OnboardingAnswers = {
  practices: [
    { id: 'snow:Snowboarding', label: 'Snowboarding', world: 'snow', level: 2 },
    { id: 'dance:Salsa', label: 'Salsa', world: 'dance', level: 1 },
  ],
  values: ['feel-good', 'social'], consent: true, sex: 'female', birthYear: 1995, heightCm: 170, weightKg: 65,
  shape: 'average_lean', bodyMapDone: true, discomfort: [{ regionId: 'left_forearm', intensity: 2 }],
  sleep: 2, sleepQuality: 3, dayLoad: 'sitting', days: ['free', 'fixed', 'off', 'free', 'off', 'free', 'off'],
  rhythm: 'rotate', blockWeeks: 2, push: 1, notes: 'I prefer quiet sessions.',
};
async function fixture() {
  const t = convexTest(schema, modules);
  const profileId = await t.run(ctx => ctx.db.insert('profiles', { authUserId: 'test|owner', email: 'owner@example.test', displayName: 'Owner', onboardingCompletedAt: 100, updatedAt: 100 }));
  const viewer = t.withIdentity({ tokenIdentifier: 'test|owner', subject: 'owner', email: 'owner@example.test' });
  return { t, viewer, profileId };
}

test('onboarding requires authentication and rejects invalid mandatory answers without writes', async () => {
  const { t, viewer } = await fixture();
  await expect(t.mutation(api.onboarding.complete, { displayName: 'Owner', answers })).rejects.toThrow();
  for (const patch of [{ birthYear: 2020 }, { heightCm: 0 }, { practices: [] }, { values: ['social', 'social'] }, { discomfort: [{ regionId: 'not_a_region', intensity: 2 }] }, { discomfort: [{ regionId: 'left_forearm', intensity: 0 }] }]) {
    await expect(viewer.mutation(api.onboarding.complete, { displayName: 'Owner', answers: { ...answers, ...patch } as OnboardingAnswers })).rejects.toThrow();
  }
  expect(await t.run(ctx => ctx.db.query('trainingProfiles').collect())).toHaveLength(0);
});

test('completion saves only current answers, preserves privacy, and editing priorities does not duplicate weight', async () => {
  const { t, viewer, profileId } = await fixture();
  await viewer.mutation(api.onboarding.complete, { displayName: 'Owner', answers });
  await viewer.mutation(api.onboarding.update, { displayName: 'Owner', answers: { ...answers, values: [], sex: 'private' } });
  const stored = await viewer.query(api.profiles.viewerTrainingProfile, {});
  expect(stored?.trainingProfile.onboarding?.values).toEqual([]);
  expect(stored?.trainingProfile).not.toHaveProperty('baseline');
  expect(stored?.latestBodyMetrics).toHaveLength(1);
  expect(onboardingComplete(await t.run(ctx => ctx.db.get(profileId)))).toBe(true);
  await t.mutation(internal.reedJourney.rebuildLatest, { profileId, trigger: 'onboarding_updated' });
  const journey = await t.query(internal.reedJourney.latestForProfile, { profileId });
  expect(journey?.renderedContext).toContain('Snowboarding, level 2/4');
  expect(journey?.renderedContext).toContain('Motivation was skipped');
  expect(journey?.renderedContext).toContain('Left forearm: Moderate');
  expect(journey?.renderedContext).not.toContain('years old');
  expect((await t.query(internal.profileInsightData.snapshot, { profileId })).topMotivation).toBeNull();
});

test('availability is not a seven-day promise', () => {
  expect(startingWeeklyTarget({ ...answers, days: Array(7).fill('free') })).toBe(3);
  expect(startingWeeklyTarget({ ...answers, days: Array(7).fill('off') })).toBeNull();
  expect(startingWeeklyTarget({ ...answers, values: ['longevity'] })).toBe(3);
  expect(onboardingComplete({ onboardingCompletedAt: 100 })).toBe(false);
});

test('coach notes are optional, bounded, saved and supplied to Reed', async () => {
  const { t, viewer, profileId } = await fixture();
  await expect(viewer.mutation(api.onboarding.complete, { displayName: 'Owner', answers: { ...answers, notes: 'x'.repeat(4001) } })).rejects.toThrow();
  await viewer.mutation(api.onboarding.complete, { displayName: 'Owner', answers });
  await t.mutation(internal.reedJourney.rebuildLatest, { profileId, trigger: 'onboarding_updated' });
  expect((await t.query(internal.reedJourney.latestForProfile, { profileId }))?.renderedContext).toContain('I prefer quiet sessions.');
  await viewer.mutation(api.onboarding.update, { displayName: 'Owner', answers: { ...answers, notes: null } });
  expect((await viewer.query(api.profiles.viewerTrainingProfile, {}))?.trainingProfile.onboarding?.notes).toBeNull();
});

test('focused profile edits preserve newer measurements and other answers', async () => {
  const { t, viewer, profileId } = await fixture();
  await viewer.mutation(api.onboarding.complete, { displayName: 'Owner', answers });
  const before = await t.run(ctx => ctx.db.get(profileId));
  await t.run(ctx => ctx.db.insert('bodyMeasurements', { profileId, metricKey: 'body_weight', value: 71, unit: 'kg', source: 'manual', observedAt: Date.now() + 1 }));
  await viewer.mutation(api.onboarding.updateField, { change: { field: 'birthYear', value: 1990 } });
  await viewer.mutation(api.onboarding.updateField, { change: { field: 'values', value: ['longevity'] } });
  const stored = await viewer.query(api.profiles.viewerTrainingProfile, {});
  expect(stored?.trainingProfile.onboarding).toEqual({ ...answers, birthYear: 1990, weightKg: 71, values: ['longevity'] });
  expect(await t.run(ctx => ctx.db.query('bodyMeasurements').collect())).toHaveLength(2);
  expect((await t.run(ctx => ctx.db.get(profileId)))?.onboardingCompletedAt).toBe(before?.onboardingCompletedAt);
  expect((await t.run(ctx => ctx.db.get(profileId)))?.displayName).toBe('Owner');
});

test('focused saves enforce authentication and validation without modifying the profile', async () => {
  const { t, viewer } = await fixture();
  await viewer.mutation(api.onboarding.complete, { displayName: 'Owner', answers });
  await expect(t.mutation(api.onboarding.updateField, { change: { field: 'birthYear', value: 1990 } })).rejects.toThrow();
  const before = await viewer.query(api.profiles.viewerTrainingProfile, {});
  await expect(viewer.mutation(api.onboarding.updateField, { change: { field: 'birthYear', value: 2025 } })).rejects.toThrow();
  await expect(viewer.mutation(api.onboarding.updateField, { change: { field: 'practices', value: [] } })).rejects.toThrow();
  await expect(viewer.mutation(api.onboarding.updateField, { change: { field: 'discomfort', value: [{ regionId: 'left_forearm', intensity: 0 }] } })).rejects.toThrow();
  expect(await viewer.query(api.profiles.viewerTrainingProfile, {})).toEqual(before);
});

test('weight and discomfort editors save their own facts and refresh Reed context', async () => {
  const { t, viewer, profileId } = await fixture();
  await viewer.mutation(api.onboarding.complete, { displayName: 'Owner', answers: { ...answers, bodyMapDone: false, discomfort: [] } });
  await viewer.mutation(api.onboarding.updateField, { change: { field: 'weightKg', value: 70 } });
  await viewer.mutation(api.onboarding.updateField, { change: { field: 'discomfort', value: [{ regionId: 'left_biceps', intensity: 3 }] } });
  const stored = await viewer.query(api.profiles.viewerTrainingProfile, {});
  expect(stored?.trainingProfile.onboarding).toMatchObject({ weightKg: 70, bodyMapDone: true, discomfort: [{ regionId: 'left_biceps', intensity: 3 }], practices: answers.practices, values: answers.values });
  expect(await t.run(ctx => ctx.db.query('bodyMeasurements').collect())).toHaveLength(2);
  await t.mutation(internal.reedJourney.rebuildLatest, { profileId, trigger: 'onboarding_updated' });
  expect((await t.query(internal.reedJourney.latestForProfile, { profileId }))?.renderedContext).toContain('Left biceps: Strong');
  await viewer.mutation(api.onboarding.updateField, { change: { field: 'discomfort', value: [] } });
  expect((await viewer.query(api.profiles.viewerTrainingProfile, {}))?.trainingProfile.onboarding).toMatchObject({ bodyMapDone: true, discomfort: [] });
});

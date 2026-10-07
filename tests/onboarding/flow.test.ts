import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import type { Draft } from '../../components/onboarding/draft';
import { toggleValue } from '../../components/onboarding/motivations';
const require = createRequire(import.meta.url);
require.extensions['.webp'] = module => { module.exports = 0; };
const { EMPTY_DRAFT, buildSteps, chapterOf, canContinue, derivePractices, isSkippable, proposeFocus } = require('../../components/onboarding/draft') as typeof import('../../components/onboarding/draft');
function fixture(): Draft {
  return { ...EMPTY_DRAFT, categories: ['dance', 'snow'], levels: { 'dance:Salsa': 3, 'snow:Snowboarding': 1 }, values: ['feel-good'] };
}
test('body basics are required while coaching context remains optional', () => {
  for (const step of ['sex', 'born', 'height', 'weight', 'shape'] as const) assert.equal(isSkippable(step), false, step);
  for (const step of ['bodymap', 'sleep', 'day', 'week', 'rhythm', 'notes', 'values', 'world:snow'] as const) assert.equal(isSkippable(step), true, step);
  assert.equal(canContinue('sex', EMPTY_DRAFT), false);
  assert.equal(canContinue('sex', { ...EMPTY_DRAFT, sex: 'private' }), true);
});
test('motivation precedes activities and progress follows the reordered flow', () => {
  for (const draft of [EMPTY_DRAFT, fixture(), { ...fixture(), categories: ['snow'] as Draft['categories'] }]) {
    const steps = buildSteps(draft);
    assert.deepEqual(steps.slice(0, 4), ['welcome', 'hello', 'values', 'worlds']);
    assert.equal(steps.filter(step => step === 'values').length, 1);
    const chapters = steps.map(chapterOf);
    assert.ok(chapters.every((chapter, index) => index === 0 || chapter >= chapters[index - 1]));
  }
});
test('review is followed by optional coach notes and then the letter', () => {
  const steps = buildSteps(fixture());
  assert.deepEqual(steps.slice(-3), ['review', 'notes', 'letter']);
  assert.ok(!steps.some(step => ['direction', 'goal', 'year', 'near', 'dream'].includes(step)));
  assert.equal(isSkippable('notes'), true);
  assert.equal(canContinue('notes', EMPTY_DRAFT), true);
});
test('tap order ranks up to three; removal closes ranks and reselect appends', () => {
  let values = toggleValue(['social', 'longevity'], 'adventure');
  assert.deepEqual(toggleValue(values, 'improve'), values);
  values = toggleValue(values, 'longevity');
  assert.deepEqual(values, ['social', 'adventure']);
  assert.deepEqual(toggleValue(values, 'longevity'), ['social', 'adventure', 'longevity']);
});
test('starting focus uses practice experience and respects recovery preferences', () => {
  const draft = fixture(); const focus = proposeFocus(draft, derivePractices(draft));
  assert.equal(focus.lead?.label, 'Salsa');
  assert.equal(proposeFocus({ ...draft, values: ['longevity'] }, derivePractices(draft)).support.length, 2);
});

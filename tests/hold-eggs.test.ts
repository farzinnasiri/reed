import assert from 'node:assert/strict';
import test from 'node:test';
import { MASCOT_EXPRESSIONS } from '../components/reed/mascot/mascot-engine';
import { HOLD_EGGS, HOLD_LAST_STEP_MS, holdPlayback, pickHoldEgg } from '../components/reed/presence/hold-eggs';

const known = new Set<string>(MASCOT_EXPRESSIONS);

test('every hold egg is a well-formed scene of real faces', () => {
  assert.equal(new Set(HOLD_EGGS.map(egg => egg.id)).size, HOLD_EGGS.length);
  for (const egg of HOLD_EGGS) {
    assert.equal(egg.during[0].at, 0, `${egg.id} starts at once`);
    for (let index = 1; index < egg.during.length; index++) assert.ok(egg.during[index].at > egg.during[index - 1].at, `${egg.id} is in order`);
    for (const step of egg.during) assert.ok(known.has(step.expression), `${egg.id}: ${step.expression}`);
    for (const step of egg.outro) assert.ok(known.has(typeof step === 'string' ? step : step.expression), egg.id);
    assert.ok(egg.outro.length > 0);
  }
});

test('a hold plays its timeline end to end and waits on the last step until release', () => {
  for (const egg of HOLD_EGGS) {
    const { steps, taps } = holdPlayback(egg);
    assert.equal(steps.length, egg.during.length);
    const holds = steps.map(step => typeof step === 'string' ? 0 : step.ms ?? 0);
    holds.slice(0, -1).forEach((ms, index) => assert.equal(ms, egg.during[index + 1].at - egg.during[index].at));
    assert.equal(holds.at(-1), HOLD_LAST_STEP_MS);
    assert.deepEqual(taps.map(tap => tap.at), egg.during.filter(step => step.haptic).map(step => step.at));
  }
});

test('holding twice never gives the same scene, and every scene turns up', () => {
  let previous: string | undefined;
  const seen = new Set<string>();
  for (let hold = 0; hold < 400; hold++) {
    const egg = pickHoldEgg(Math.random, previous);
    assert.notEqual(egg.id, previous);
    seen.add(egg.id);
    previous = egg.id;
  }
  assert.equal(seen.size, HOLD_EGGS.length);
  assert.ok(HOLD_EGGS.some(egg => egg.id === pickHoldEgg(() => 0.999, 'lift').id));
});

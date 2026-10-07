import assert from 'node:assert/strict';
import test from 'node:test';
import { criticalSpring } from '../design/sheet-spring';
import { DEFAULT_KG, MAX_KG, MIN_KG, stepWeight } from '../components/reed/widgets/weight';

test('the sheet spring is the design token as plain physics: critically damped, 450ms', () => {
  const spring = criticalSpring(450);
  // stiffness (2π / 0.45)² and damping 2√stiffness: no overshoot, and it moves at the token's pace.
  assert.ok(Math.abs(spring.stiffness - 194.96) < 0.1);
  assert.ok(Math.abs(spring.damping ** 2 - 4 * spring.stiffness) < 1e-9);
  assert.equal(spring.mass, 1);
  // The sheet used to run on stiffness 100 / damping 20, about 1.4x slower than its own token.
  assert.ok(spring.stiffness > 100 * 1.9);
  // A longer duration is a slower spring.
  assert.ok(criticalSpring(600).stiffness < spring.stiffness);
});

test('weight steps by a tenth, stays on tenths and stays inside what the server accepts', () => {
  assert.equal(stepWeight(70, 1), 70.1);
  assert.equal(stepWeight(70.1, 1), 70.2);
  assert.equal(stepWeight(70.3, -1), 70.2);
  assert.equal(stepWeight(70, 1, 5), 70.5);
  let walked = DEFAULT_KG;
  for (let step = 0; step < 100; step++) walked = stepWeight(walked, 1);
  assert.equal(walked, 80);
  assert.equal(stepWeight(MAX_KG, 1), MAX_KG);
  assert.equal(stepWeight(MIN_KG, -1, 5), MIN_KG);
});

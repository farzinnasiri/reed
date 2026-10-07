import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTargets } from '../components/reed/widgets/format-targets';

test('plan targets count identical sets and keep different ones in order', () => {
  assert.equal(formatTargets([{ metrics: { reps: 10, rpe: 8 } }, { metrics: { reps: 10, rpe: 8 } }, { metrics: { reps: 10, rpe: 8 } }]), '3 × 10');
  assert.equal(formatTargets([{ metrics: { load: 40, reps: 8 } }, { metrics: { load: 42.5, reps: 6 } }]), '1 × 8 · 40 kg, 1 × 6 · 42.5 kg');
});

test('plan targets describe duration, assistance and bodyweight sets', () => {
  assert.equal(formatTargets([{ metrics: { duration: 45 } }, { metrics: { duration: 45 } }]), '2 × 45 s');
  assert.equal(formatTargets([{ metrics: { assistLoad: 20, reps: 5 } }]), '1 × 5 · -20 kg assist');
  assert.equal(formatTargets([{ metrics: { rpe: 7 } }]), '1 set');
});

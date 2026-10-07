import assert from 'node:assert/strict';
import test from 'node:test';
import { createSingleFlight } from '../lib/single-flight';

test('rapid activations create exactly one goal, then permit another intentional command', async () => {
  const flight = createSingleFlight();
  let inserts = 0;
  let finish!: () => void;
  const save = () =>
    flight.run(async () => {
      inserts++;
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
  const first = save();
  assert.equal((await save()).status, 'busy');
  assert.equal(inserts, 1);
  finish();
  await first;
  await flight.run(async () => {
    inserts++;
  });
  assert.equal(inserts, 2);
});

test('a failed submission releases the guard for a retry', async () => {
  const flight = createSingleFlight();
  await assert.rejects(
    flight.run(async () => {
      throw new Error('offline');
    }),
  );
  assert.equal((await flight.run(async () => 'saved')).status, 'completed');
});

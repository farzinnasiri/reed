import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushDeviceLifecycle } from '../lib/push-device-lifecycle';

test('logout follows in-flight registration and prevents queued rotation from re-enabling the device', async () => {
  const writes: string[] = [];
  let finishRegistration!: () => void;
  const owner = createPushDeviceLifecycle({
    register: async () => {
      writes.push('register');
      await new Promise<void>((resolve) => {
        finishRegistration = resolve;
      });
      return 'registered';
    },
    disable: async (reason) => {
      writes.push(reason);
    },
  });
  const registration = owner.register();
  await Promise.resolve();
  const rotation = owner.register();
  const logout = owner.disable('logout');
  finishRegistration();
  await Promise.all([registration, rotation, logout]);
  assert.deepEqual(writes, ['register', 'logout']);
});

test('failed revocation is visible and can be retried', async () => {
  let attempts = 0;
  const owner = createPushDeviceLifecycle({
    register: async () => 'registered',
    disable: async () => {
      if (++attempts === 1) throw new Error('offline');
    },
  });
  await assert.rejects(owner.disable('logout'));
  await owner.disable('logout');
  assert.equal(attempts, 2);
});

test('disposing an identity prevents registration and a new identity can register', async () => {
  let registrations = 0;
  const operations = { register: async () => ++registrations, disable: async () => {} };
  const oldOwner = createPushDeviceLifecycle(operations);
  oldOwner.dispose();
  await oldOwner.register();
  await createPushDeviceLifecycle(operations).register();
  assert.equal(registrations, 1);
});

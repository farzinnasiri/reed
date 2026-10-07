/** Serializes device writes so an in-flight registration cannot undo logout. */
export function createPushDeviceLifecycle<Status>(operations: {
  register: () => Promise<Status>;
  disable: (reason: 'logout' | 'user_disabled') => Promise<void>;
}) {
  let active = true;
  let enabled = true;
  let pending: Promise<unknown> = Promise.resolve();

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.catch(() => undefined);
    return result;
  }

  return {
    activate() {
      active = true;
    },
    register() {
      return enqueue(() => (active && enabled ? operations.register() : Promise.resolve(null)));
    },
    enable() {
      enabled = true;
      return this.register();
    },
    disable(reason: 'logout' | 'user_disabled') {
      enabled = false;
      return enqueue(() => operations.disable(reason));
    },
    dispose() {
      active = false;
    },
  };
}

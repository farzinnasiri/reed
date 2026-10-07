/** Prevents duplicate user commands, including two activations before React rerenders. */
export function createSingleFlight() {
  let pending = false;
  return {
    get pending() {
      return pending;
    },
    async run<T>(action: () => Promise<T>) {
      if (pending) return { status: 'busy' } as const;
      pending = true;
      try {
        return { status: 'completed', value: await action() } as const;
      } finally {
        pending = false;
      }
    },
  };
}

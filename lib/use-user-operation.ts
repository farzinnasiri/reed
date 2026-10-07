import { useCallback, useRef, useState } from 'react';
import { startClientWideEvent } from './client-observability';
import { createSingleFlight } from './single-flight';

export function useUserOperation(name: string, failureMessage: string) {
  const flight = useRef(createSingleFlight()).current;
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const run = useCallback(
    async <T>(action: () => Promise<T>) => {
      if (flight.pending) return { status: 'busy' } as const;
      setIsWorking(true);
      setErrorMessage(null);
      const event = startClientWideEvent(name);
      try {
        const result = await flight.run(action);
        event.end();
        return result.status === 'completed'
          ? { status: 'success', value: result.value } as const
          : { status: 'busy' } as const;
      } catch (error) {
        event.fail(error, `${name.replace(/\./g, '_')}_failed`);
        setErrorMessage(failureMessage);
        return { status: 'error' } as const;
      } finally {
        setIsWorking(false);
      }
    },
    [failureMessage, flight, name],
  );
  const clearError = useCallback(() => setErrorMessage(null), []);
  return { run, isWorking, errorMessage, clearError };
}

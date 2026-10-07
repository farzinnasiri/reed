import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useFiveMinuteNow } from '../use-five-minute-now';

export type PulseData = NonNullable<ReturnType<typeof usePulse>>;

/**
 * The numbers on the collapsed Pulse. `undefined` only until the first result: when the clock
 * bucket changes the previous numbers stay on screen until the new ones arrive, so the strip
 * never blinks empty while it is always visible.
 */
export function usePulse() {
  const now = useFiveMinuteNow();
  const result = useQuery(api.home.getPulse, { now });
  const [lastResult, setLastResult] = useState(result);

  if (result !== undefined && result !== lastResult) {
    setLastResult(result);
  }

  return result ?? lastResult;
}

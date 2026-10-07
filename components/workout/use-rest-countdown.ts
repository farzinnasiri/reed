import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getRestSnapshot, type RestProcessLike } from '@/domains/workout/rest';
import { useRunningTicker } from './use-running-ticker';

/** The clock is local; timer state always comes from the authoritative session. */
export function useRestCountdown(timer: RestProcessLike | null) {
  const [now, setNow] = useState(Date.now);
  const tick = useCallback(() => setNow(Date.now()), []);
  const snapshot = timer ? getRestSnapshot(timer, Math.max(now, timer.startedAt ?? 0)) : null;
  useRunningTicker({ isRunning: snapshot?.isRunning ?? false, onTick: tick });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => subscription.remove();
  }, [tick]);
  return snapshot;
}

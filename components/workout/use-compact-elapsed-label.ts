import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { formatElapsedCompact } from './workout-surface.utils';

export function useCompactElapsedLabel(startedAt: number | null | undefined, manualDurationSeconds?: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || manualDurationSeconds !== undefined) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function schedule() {
      if (timeout) clearTimeout(timeout);
      const current = Date.now();
      setNow(current);
      const elapsedMs = Math.max(0, current - startedAt!);
      const delay = elapsedMs < 60_000
        ? 1000 - (elapsedMs % 1000)
        : 60_000 - (elapsedMs % 60_000);
      timeout = setTimeout(schedule, Math.max(50, delay));
    }

    schedule();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') schedule();
    });
    return () => {
      if (timeout) clearTimeout(timeout);
      subscription.remove();
    };
  }, [startedAt, manualDurationSeconds]);

  return manualDurationSeconds !== undefined
    ? formatElapsedCompact(0, manualDurationSeconds * 1000)
    : startedAt ? formatElapsedCompact(startedAt, now) : null;
}

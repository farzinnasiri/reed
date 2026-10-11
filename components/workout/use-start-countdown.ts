import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useStartCountdownPreference } from '@/design/timer-preference';

/** Preparation is separate from activity time and cannot start an activity in the background. */
export function useStartCountdown(onReady: (at: number) => void, onCancel?: () => void) {
  const { seconds } = useStartCountdownPreference();
  const [remaining, setRemaining] = useState<number | null>(null);
  const deadline = useRef<number | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ onReady, onCancel });
  useEffect(() => { callbacks.current = { onReady, onCancel }; }, [onReady, onCancel]);
  const clear = useCallback(() => {
    if (timeout.current !== null) clearTimeout(timeout.current);
    timeout.current = null;
    deadline.current = null;
  }, []);
  const cancel = useCallback(() => {
    const wasPreparing = deadline.current !== null;
    clear();
    setRemaining(null);
    if (wasPreparing) callbacks.current.onCancel?.();
  }, [clear]);
  const start = useCallback(() => {
    clear();
    if (seconds === 0) {
      setRemaining(null);
      callbacks.current.onReady(Date.now());
      return;
    }
    deadline.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
    const tick = () => {
      if (deadline.current === null) return;
      const now = Date.now();
      const left = Math.max(0, Math.ceil((deadline.current - now) / 1000));
      if (left === 0) {
        clear();
        setRemaining(null);
        callbacks.current.onReady(now);
      } else {
        setRemaining(left);
        timeout.current = setTimeout(tick, deadline.current - now - (left - 1) * 1000);
      }
    };
    timeout.current = setTimeout(tick, 1000);
  }, [clear, seconds]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') cancel(); });
    const visibility = () => { if (document.visibilityState !== 'visible') cancel(); };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility);
      clear();
    };
  }, [cancel, clear]);
  return { remaining, start, cancel };
}

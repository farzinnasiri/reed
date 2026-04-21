import { useEffect, useRef } from 'react';

type UseRunningTickerOptions = {
  intervalMs?: number;
  isRunning: boolean;
  onTick: () => void;
};

export function useRunningTicker({ intervalMs = 1000, isRunning, onTick }: UseRunningTickerOptions) {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = setInterval(() => {
      onTickRef.current();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, isRunning]);
}

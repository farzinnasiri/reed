import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatReedLastSeen } from './reed.presenter';

const REED_ONLINE_IDLE_TIMEOUT_MS = 60_000;
const REED_PRESENCE_TICK_MS = 1_000;

export function useReedPresence(lastSeenAt: number | null = null) {
  const expiresAtRef = useRef(0);
  const lastSeenAtRef = useRef(lastSeenAt ?? 0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setNow(Date.now());
    }, REED_PRESENCE_TICK_MS);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
      }
    };
  }, []);

  const markOnline = useCallback(() => {
    const nextNow = Date.now();
    lastSeenAtRef.current = nextNow;
    expiresAtRef.current = nextNow + REED_ONLINE_IDLE_TIMEOUT_MS;
    setNow(nextNow);
  }, []);

  useEffect(() => {
    if (lastSeenAt !== null && now >= expiresAtRef.current) {
      lastSeenAtRef.current = lastSeenAt;
    }
  }, [lastSeenAt, now]);

  const isOnline = now < expiresAtRef.current;
  const label = useMemo(
    () => (isOnline ? 'Online' : formatReedLastSeen(lastSeenAtRef.current, now)),
    [isOnline, now],
  );

  const shouldDelayAssistantStart = useCallback(() => now >= expiresAtRef.current, [now]);

  return {
    isOnline,
    label,
    markOnline,
    shouldDelayAssistantStart,
  };
}

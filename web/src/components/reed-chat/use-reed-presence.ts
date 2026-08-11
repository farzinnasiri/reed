'use client';

import { useCallback, useEffect, useState } from 'react';

const ONLINE_WINDOW_MS = 60_000;

export function useReedPresence(lastMessageAt: number | null) {
  const [localPresence, setLocalPresence] = useState({ lastSeenAt: 0, onlineUntil: 0 });
  const [now, setNow] = useState(() => Date.now());
  const isOnline = now < localPresence.onlineUntil;
  const effectiveLastSeenAt = isOnline ? localPresence.lastSeenAt : lastMessageAt ?? localPresence.lastSeenAt;

  useEffect(() => {
    const boundary = nextPresenceBoundary(effectiveLastSeenAt, localPresence.onlineUntil, Date.now());
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.max(100, boundary - Date.now()));
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [effectiveLastSeenAt, lastMessageAt, localPresence.onlineUntil, now]);

  const markOnline = useCallback(() => {
    const current = Date.now();
    setLocalPresence({ lastSeenAt: current, onlineUntil: current + ONLINE_WINDOW_MS });
    setNow(current);
  }, []);

  const label = isOnline ? 'Online' : formatLastSeen(effectiveLastSeenAt, now);

  return { isOnline, label, markOnline };
}

function formatLastSeen(lastSeenAt: number, now: number) {
  if (lastSeenAt <= 0) return 'Last seen recently';
  const minutes = Math.max(0, Math.floor((now - lastSeenAt) / 60_000));
  if (minutes < 1) return 'Last seen just now';
  if (minutes === 1) return 'Last seen 1 minute ago';
  if (minutes < 60) return `Last seen ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'Last seen 1 hour ago';
  if (hours < 24) return `Last seen ${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Last seen 1 day ago';
  if (days < 7) return `Last seen ${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `Last seen ${weeks} week${weeks === 1 ? '' : 's'} ago`;
}

function nextPresenceBoundary(lastSeenAt: number, onlineUntil: number, now: number) {
  if (now < onlineUntil) return onlineUntil;
  if (lastSeenAt <= 0) return now + 60_000;
  const elapsed = Math.max(0, now - lastSeenAt);
  if (elapsed < 60_000) return lastSeenAt + 60_000;
  if (elapsed < 3_600_000) return lastSeenAt + (Math.floor(elapsed / 60_000) + 1) * 60_000;
  if (elapsed < 86_400_000) return lastSeenAt + (Math.floor(elapsed / 3_600_000) + 1) * 3_600_000;
  if (elapsed < 604_800_000) return lastSeenAt + (Math.floor(elapsed / 86_400_000) + 1) * 86_400_000;
  return lastSeenAt + (Math.floor(elapsed / 604_800_000) + 1) * 604_800_000;
}

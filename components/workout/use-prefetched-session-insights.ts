import { useCallback, useEffect, useRef, useState } from 'react';
import { useConvex } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import type { LiveSessionFullInsights, LiveSessionStatusStrip, LiveSessionSummary } from './workout-surface.types';

export type PrefetchedSessionInsights = {
  fullInsights: LiveSessionFullInsights;
  statusStrip: LiveSessionStatusStrip;
  summary: LiveSessionSummary;
};

export function usePrefetchedSessionInsights(sessionId: Id<'liveSessions'> | null, manualDurationSeconds?: number) {
  const convex = useConvex();
  const requestGenerationRef = useRef(0);
  const inFlightRef = useRef<Promise<PrefetchedSessionInsights | null> | null>(null);
  const [data, setData] = useState<PrefetchedSessionInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [previousSessionId, setPreviousSessionId] = useState(sessionId);
  if (previousSessionId !== sessionId) {
    setPreviousSessionId(sessionId); setData(null); setError(null); setIsLoading(false);
  }
  const refresh = useCallback(async () => {
    if (!sessionId) return null;
    if (inFlightRef.current) return inFlightRef.current;

    const generation = requestGenerationRef.current;
    setIsLoading(true);
    setError(null);
    const request = convex
      .query(api.liveSessionInsights.getForActiveSession, { sessionId })
      .then(result => {
        if (generation === requestGenerationRef.current) setData(result);
        return result;
      })
      .catch(() => {
        if (generation === requestGenerationRef.current) setError('Could not load session insights.');
        return null;
      })
      .finally(() => {
        if (generation === requestGenerationRef.current) setIsLoading(false);
        if (inFlightRef.current === request) inFlightRef.current = null;
      });
    inFlightRef.current = request;
    return request;
  }, [convex, sessionId]);

  useEffect(() => {
    requestGenerationRef.current += 1;
    inFlightRef.current = null;
    if (!sessionId) return;
    const timeout = setTimeout(() => { void refresh(); }, 500);
    return () => clearTimeout(timeout);
  }, [refresh, sessionId, manualDurationSeconds]);

  return { data, error, isLoading, refresh };
}

import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

/** History owns its cursors, selection, and bounded queries, independently of live capture. */
export function useWorkoutHistory(selectedEndedSessionId: Id<'liveSessions'> | null) {
  const [sessionPageCursorStack, setSessionPageCursorStack] = useState<number[]>([]);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [expandedQuickLogDays, setExpandedQuickLogDays] = useState<string[]>([]);
  const latestEndedSummary = useQuery(api.liveSessions.getLatestEndedSummary, selectedEndedSessionId ? 'skip' : {});
  const endedSessionsPage = useQuery(
    api.liveSessions.listEndedSummaries,
    !selectedEndedSessionId
      ? {
          beforeStartedAt: sessionPageCursorStack.at(-1),
          limit: 5,
        }
      : 'skip',
  );
  const quickLogActivity = useQuery(api.quickLogs.listRecentActivity, selectedEndedSessionId ? 'skip' : { limit: 40 });
  const endedSessionInsights = useQuery(
    api.liveSessionInsights.getForSession,
    selectedEndedSessionId ? { sessionId: selectedEndedSessionId } : 'skip',
  );
  const endedSessionTimeline = useQuery(
    api.liveSessions.getEndedTimeline,
    selectedEndedSessionId ? { sessionId: selectedEndedSessionId } : 'skip',
  );
  const quickLogDayGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof quickLogActivity>>();
    for (const entry of quickLogActivity ?? []) {
      const date = new Date(entry.loggedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const logs = groups.get(key) ?? [];
      logs.push(entry);
      groups.set(key, logs);
    }
    return Array.from(groups, ([dayKey, logs]) => ({ dayKey, latestLoggedAt: logs[0]?.loggedAt ?? 0, logs }));
  }, [quickLogActivity]);
  return {
    latestEndedSummary,
    endedSessionsPage,
    quickLogActivity,
    quickLogDayGroups,
    endedSessionInsights,
    endedSessionTimeline,
    isHistoryExpanded,
    toggleHistory: () => setIsHistoryExpanded(current => !current),
    expandedQuickLogDays,
    toggleQuickLogDay: (day: string) => setExpandedQuickLogDays(current => current.includes(day) ? current.filter(value => value !== day) : [...current, day]),
    canPageNewer: sessionPageCursorStack.length > 0,
    newerPage: () => setSessionPageCursorStack((current) => current.slice(0, -1)),
    olderPage: () => {
      const cursor = endedSessionsPage?.nextBeforeStartedAt;
      if (cursor !== null && cursor !== undefined) setSessionPageCursorStack(current => [...current, cursor]);
    },
  };
}

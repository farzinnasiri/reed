import { useCallback, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

const PAGE_SIZE = 8;
const QUICK_PAGE_SIZE = 40;

type SummariesPage = FunctionReturnType<
  typeof api.liveSessions.listEndedSummaries
>;
type QuickLogPage = FunctionReturnType<typeof api.quickLogs.listRecentActivity>;
export type EndedSummary = SummariesPage['summaries'][number];
type LoadedPage = {
  range: string;
  cursor: number | undefined;
  result: SummariesPage;
};
type LoadedQuickPage = {
  range: string;
  cursor: number | undefined;
  result: QuickLogPage;
};

/**
 * History owns its pages, selection, and bounded queries, independently of live capture. Sessions
 * and quick logs load a page at a time as the list is scrolled. Only the newest page being
 * read is live, and coming back from a session starts over so edits show.
 */
export function useWorkoutHistory(
  selectedEndedSessionId: Id<'liveSessions'> | null,
  bounds: { since?: number; before: number },
) {
  const range = `${bounds.since ?? 0}:${bounds.before}`;
  const [position, setPosition] = useState<{ range: string; cursor?: number }>({
    range,
  });
  const cursor = position.range === range ? position.cursor : undefined;
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [pages, setPages] = useState<LoadedPage[]>([]);
  const [quickPosition, setQuickPosition] = useState<{
    range: string;
    cursor?: number;
  }>({ range });
  const quickCursor =
    quickPosition.range === range ? quickPosition.cursor : undefined;
  const [quickPages, setQuickPages] = useState<LoadedQuickPage[]>([]);
  const [expandedQuickLogDays, setExpandedQuickLogDays] = useState<string[]>(
    [],
  );
  const result = useQuery(
    api.liveSessions.listEndedSummaries,
    !selectedEndedSessionId
      ? {
          beforeStartedAt: cursor ?? bounds.before,
          sinceStartedAt: bounds.since,
          limit: PAGE_SIZE,
        }
      : 'skip',
  );
  const quickResult = useQuery(
    api.quickLogs.listRecentActivity,
    selectedEndedSessionId
      ? 'skip'
      : {
          limit: QUICK_PAGE_SIZE,
          sinceLoggedAt: bounds.since,
          beforeLoggedAt: quickCursor ?? bounds.before,
        },
  );
  const endedSessionInsights = useQuery(
    api.liveSessionInsights.getForSession,
    selectedEndedSessionId ? { sessionId: selectedEndedSessionId } : 'skip',
  );
  const endedSessionTimeline = useQuery(
    api.liveSessions.getEndedTimeline,
    selectedEndedSessionId ? { sessionId: selectedEndedSessionId } : 'skip',
  );

  // Adjusting state while rendering, the way React asks: keep the page being read in step with its query.
  if (result !== undefined) {
    const stored = pages.find(
      (page) => page.range === range && page.cursor === cursor,
    );
    if (stored?.result !== result) {
      setPages((current) => [
        ...current.filter(
          (page) => page.range !== range || page.cursor !== cursor,
        ),
        { range, cursor, result },
      ]);
    }
  }
  if (quickResult !== undefined) {
    const stored = quickPages.find(
      (page) => page.range === range && page.cursor === quickCursor,
    );
    if (stored?.result !== quickResult) {
      setQuickPages((current) => [
        ...current.filter(
          (page) => page.range !== range || page.cursor !== quickCursor,
        ),
        { range, cursor: quickCursor, result: quickResult },
      ]);
    }
  }
  const [wasReadingSession, setWasReadingSession] = useState(false);
  if (wasReadingSession !== Boolean(selectedEndedSessionId)) {
    setWasReadingSession(Boolean(selectedEndedSessionId));
    if (!selectedEndedSessionId) {
      setPosition({ range });
      setPages((current) => current.filter((page) => page.range !== range));
      setQuickPosition({ range });
      setQuickPages((current) => current.filter((page) => page.range !== range));
    }
  }

  const sessions = useMemo(() => {
    const currentPages = pages.filter((page) => page.range === range);
    if (currentPages.length === 0) return undefined;
    const seen = new Set<string>();
    // A session ended since the first page was read moves the page edges, so the same one can appear twice.
    return currentPages
      .flatMap((page) => page.result.summaries)
      .filter(
        (summary) =>
          !deletedIds.has(summary.sessionId) &&
          !seen.has(summary.sessionId) &&
          seen.add(summary.sessionId),
      )
      .sort((a, b) => b.startedAt - a.startedAt);
  }, [pages, deletedIds, range]);
  const nextCursor =
    pages.find((page) => page.range === range && page.cursor === cursor)?.result
      .nextBeforeStartedAt ?? null;

  const quickLogActivity = useMemo(() => {
    const currentPages = quickPages.filter((page) => page.range === range);
    if (currentPages.length === 0) return undefined;
    const seen = new Set<string>();
    return currentPages
      .flatMap((page) => page.result.logs)
      .filter(
        (log) => !seen.has(log._id) && seen.add(log._id),
      )
      .sort((a, b) => b.loggedAt - a.loggedAt);
  }, [quickPages, range]);
  const quickNextCursor =
    quickPages.find((page) => page.range === range && page.cursor === quickCursor)
      ?.result.nextBeforeLoggedAt ?? null;

  const quickLogDayGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof quickLogActivity>>();
    for (const entry of quickLogActivity ?? []) {
      const date = new Date(entry.loggedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const logs = groups.get(key) ?? [];
      logs.push(entry);
      groups.set(key, logs);
    }
    return Array.from(groups, ([dayKey, logs]) => ({
      dayKey,
      latestLoggedAt: logs[0]?.loggedAt ?? 0,
      logs,
    }));
  }, [quickLogActivity]);

  const loadMore = useCallback(() => {
    if (nextCursor !== null && result !== undefined)
      setPosition({ range, cursor: nextCursor });
  }, [nextCursor, result, range]);
  const loadOlderQuickLogs = useCallback(() => {
    if (quickNextCursor !== null && quickResult !== undefined)
      setQuickPosition({ range, cursor: quickNextCursor });
  }, [quickNextCursor, quickResult, range]);

  return {
    sessions,
    forgetDeletedSession: (id: Id<'liveSessions'>) =>
      setDeletedIds((current) => new Set([...current, id])),
    hasMore: nextCursor !== null,
    hasMoreQuickLogs: quickNextCursor !== null,
    isLoadingMore:
      (result === undefined && cursor !== undefined) ||
      (quickResult === undefined && quickCursor !== undefined),
    loadMore,
    loadOlderQuickLogs,
    quickLogActivity,
    quickLogDayGroups,
    endedSessionInsights,
    endedSessionTimeline,
    expandedQuickLogDays,
    toggleQuickLogDay: (day: string) =>
      setExpandedQuickLogDays((current) =>
        current.includes(day)
          ? current.filter((value) => value !== day)
          : [...current, day],
      ),
  };
}

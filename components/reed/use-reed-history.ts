import { useCallback, useMemo } from 'react';
import { usePaginatedQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';

const PAGE_SIZE = 30;
export type ServerReedMessage = FunctionReturnType<
  typeof api.reed.listMessagesPaginated
>['page'][number];
type Presence = FunctionReturnType<typeof api.reed.getPresence> | undefined;

/** Chapters mark moments inside one continuous, bounded, reactive message timeline. */
export function useReedHistory(presence: Presence) {
  const current = usePaginatedQuery(
    api.reed.listMessagesPaginated,
    presence === undefined ? 'skip' : {},
    {
      initialNumItems: PAGE_SIZE,
    },
  );
  const { status, loadMore } = current;
  const fetchedMessages = useMemo(
    () =>
      status === 'LoadingFirstPage'
        ? undefined
        : [...current.results].sort((a, b) => a.createdAt - b.createdAt),
    [current.results, status],
  );
  const loadOlderMessages = useCallback(() => {
    if (status === 'CanLoadMore') loadMore(PAGE_SIZE);
  }, [loadMore, status]);
  return {
    fetchedMessages,
    hasMoreMessages: status !== 'Exhausted',
    isLoadingInitialMessages:
      presence === undefined || status === 'LoadingFirstPage',
    isLoadingOlderMessages: status === 'LoadingMore',
    loadOlderMessages,
  };
}

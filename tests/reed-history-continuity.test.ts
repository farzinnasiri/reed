import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { platformModule } from './helpers/platform-module';
import {
  formatMessageDate,
  isSameMessageDay,
} from '../components/reed/reed.presenter';

test('a chapter change preserves loaded messages and the same thread-wide subscription', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const query = {};
  const subscriptions: unknown[] = [];
  const loads: number[] = [];
  let status = 'CanLoadMore';
  let rows = [
    { _id: 'old-2', chapterId: 'old', createdAt: 2 },
    { _id: 'old-1', chapterId: 'old', createdAt: 1 },
  ];
  const loadMore = (count: number) => {
    loads.push(count);
  };
  const { useReedHistory } = platformModule<
    typeof import('../components/reed/use-reed-history')
  >('components/reed/use-reed-history.ts', {
    '@/convex/_generated/api': {
      api: { reed: { listMessagesPaginated: query } },
    },
    'convex/react': {
      usePaginatedQuery: (fn: unknown, args: unknown) => {
        assert.equal(fn, query);
        subscriptions.push(args);
        return { results: rows, status, loadMore };
      },
    },
  });
  let chapterId = 'old';
  let history!: ReturnType<typeof useReedHistory>;
  function History() {
    // Only the changing chapter ID matters to this regression; auth/pagination belong to Convex.
    history = useReedHistory({ currentChapterId: chapterId } as Parameters<
      typeof useReedHistory
    >[0]);
    return null;
  }
  const root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(createElement(History)));
  assert.deepEqual(
    history.fetchedMessages?.map((row) => row._id),
    ['old-1', 'old-2'],
  );
  chapterId = 'new';
  await act(async () => root.render(createElement(History)));
  assert.deepEqual(
    history.fetchedMessages?.map((row) => row._id),
    ['old-1', 'old-2'],
  );
  assert.equal(history.isLoadingInitialMessages, false);
  rows = [{ _id: 'new-1', chapterId: 'new', createdAt: 3 }, ...rows];
  await act(async () => root.render(createElement(History)));
  assert.deepEqual(
    history.fetchedMessages?.map((row) => row._id),
    ['old-1', 'old-2', 'new-1'],
  );
  assert.ok(subscriptions.every((args) => JSON.stringify(args) === '{}'));
  history.loadOlderMessages();
  assert.deepEqual(loads, [30]);
  status = 'LoadingMore';
  await act(async () => root.render(createElement(History)));
  history.loadOlderMessages();
  assert.deepEqual(loads, [30]);
  await act(async () => root.unmount());
});

test('day separators use the profile timezone and yesterday remains correct across DST', () => {
  const zone = 'Europe/Rome';
  const beforeMidnight = Date.parse('2026-10-05T21:59:00Z');
  const afterMidnight = Date.parse('2026-10-05T22:01:00Z');
  assert.equal(isSameMessageDay(beforeMidnight, afterMidnight, zone), false);
  assert.equal(formatMessageDate(afterMidnight, zone, afterMidnight), 'Today');
  assert.equal(
    formatMessageDate(beforeMidnight, zone, afterMidnight),
    'Yesterday',
  );
  assert.equal(
    formatMessageDate(
      Date.parse('2026-10-24T21:30:00Z'),
      zone,
      Date.parse('2026-10-25T22:30:00Z'),
    ),
    'Yesterday',
  );
});

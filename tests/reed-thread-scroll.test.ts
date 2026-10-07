import assert from 'node:assert/strict';
import test from 'node:test';
import { act, cloneElement, createElement, useLayoutEffect, type ReactElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { platformModule } from './helpers/platform-module';
import type { ReedMessage } from '../components/reed/reed.types';

test('reply commits and layout scrolls follow without animation frames, while gestures can interrupt', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: (fn: FrameRequestCallback) => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  const flushFrame = async () => act(async () => {
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(0));
  });
  type ListProps = {
    data: ReedMessage[];
    renderItem: (item: { item: ReedMessage; index: number }) => ReactElement<{ children?: ReactNode }>;
    ref: (node: unknown) => void;
    onLayout: (event: { nativeEvent: { layout: { height: number } } }) => void;
    onContentSizeChange: (width: number, height: number) => void;
    onScroll: (event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => void;
    onScrollBeginDrag?: () => void;
  };
  let list!: ListProps;
  const scrolls: { offset: number; animated: boolean }[] = [];
  let liveHost: { scrollHeight: number; clientHeight: number; scrollTop: number } | null = null;
  const nativeList = {
    scrollToOffset: (options: { offset: number; animated: boolean }) => scrolls.push(options),
    scrollToEnd: () => {}, getScrollableNode: () => liveHost,
  };
  function List(props: ListProps) {
    list = props;
    const { ref } = props;
    useLayoutEffect(() => { ref(nativeList); return () => ref(null); }, [ref]);
    // Render the real latest-row commit hook; row content itself is unrelated to positioning.
    const index = props.data.length - 1;
    return cloneElement(props.renderItem({ item: props.data[index], index }), { children: null });
  }
  const Empty = () => null;
  const View = ({ children }: { children: ReactNode }) => createElement('div', null, children);
  const { ReedThread } = platformModule<typeof import('../components/reed/reed-thread')>('components/reed/reed-thread.tsx', {
    'react-native': { FlatList: List, View, Image: Empty, Pressable: Empty, Platform: { OS: 'web' }, StyleSheet: { create: (x: unknown) => x, flatten: (x: unknown) => x } },
    'react-native-reanimated': { __esModule: true, default: { FlatList: List, View: Empty } },
    '@gorhom/bottom-sheet': { BottomSheetFlatList: List },
    '@expo/vector-icons/Ionicons': { default: Empty },
    '@/design/haptics': {},
    '@/design/system': { reedThreadMetrics: { historyPrefetch: 160 } },
    '@/design/motion': {},
    '@/design/provider': {},
    '@/design/use-entry-animation': {},
    '@/design/use-reed-reduced-motion': { useReedReducedMotion: () => false },
    '@/components/ui/reed-text': { ReedText: Empty },
    './message-actions': {},
    './reed.styles': { styles: {} },
    './thread/reply-reveal': {},
    './presence/use-presence-activity': { usePresenceActivity: () => true },
  });
  // Render the production scroll owner, replacing the native list and unrelated row UI only.
  const messages: ReedMessage[] = [
    { id: 'user', createdAt: 1, role: 'user', status: 'sent', source: 'typed', text: 'Question' },
    { id: 'reply', createdAt: 2, role: 'assistant', status: 'sent', source: 'typed', text: 'Reply', replies: ['Yes', 'No'] },
  ];
  const readings: boolean[] = [];
  const scrollRef = { current: null as import('../components/reed/reed-thread').ReedThreadScroll | null };
  const root = createRoot(document.getElementById('root')!);
  const render = (rows = messages) => act(async () => root.render(createElement(ReedThread, {
    layout: { bottom: 120, top: 100 }, messages: rows, scrollRef,
    history: { hasMore: false, loading: false, load: () => {}, timeZone: 'UTC' },
    interaction: { ready: true, onReady: () => {}, reading: value => readings.push(value), openSession: () => {}, retryAssistant: () => {}, retryUser: () => {}, offline: false },
  })));
  await render();
  const scroll = (offset: number, height: number) => list.onScroll({ nativeEvent: {
    contentOffset: { y: offset }, contentSize: { height }, layoutMeasurement: { height: 600 },
  } });
  list.onLayout({ nativeEvent: { layout: { height: 600 } } });
  list.onContentSizeChange(400, 1200);
  assert.equal(scrolls.at(-1)?.offset, 600, 'positioning does not wait for an animation frame');
  await flushFrame(); await flushFrame();
  scroll(600, 1200);
  scrolls.length = 0;
  scroll(450, 1200);
  assert.equal(scrolls.at(-1)?.offset, 600, 'browser focus scrolling is corrected without another layout event');
  scroll(600, 1200);
  scrolls.length = 0;
  // Browser anchoring/focus can emit a scroll with the new content size before the list's
  // measurement callback. This is not a user gesture and must not turn following off.
  scroll(610, 1342);
  list.onContentSizeChange(400, 1342);
  await flushFrame(); await flushFrame();
  assert.equal(scrolls.at(-1)?.offset, 742, 'layout-driven scroll before measurement still follows the reply');
  assert.equal(readings.includes(true), false);
  scroll(742, 1342);
  scrolls.length = 0;
  list.onContentSizeChange(400, 1500);
  await flushFrame(); await flushFrame();
  scroll(650, 1500); // The platform is still animating toward 900.
  list.onContentSizeChange(400, 1700); // Final text/actions/widget layout arrives mid-scroll.
  await flushFrame();
  assert.equal(scrolls.at(-1)?.offset, 1100, 'retarget to the final measured bottom');
  assert.equal(readings.includes(true), false, 'automatic scrolling must not become history reading');
  scroll(1100, 1700);
  list.onScrollBeginDrag?.();
  scroll(650, 1700);
  assert.equal(readings.at(-1), true);
  scrolls.length = 0;
  list.onContentSizeChange(400, 1900);
  await flushFrame();
  assert.equal(scrolls.length, 0, 'leave someone reading history in place');
  scrollRef.current?.scrollToEnd({ animated: true });
  await flushFrame();
  assert.equal(scrolls.at(-1)?.offset, 1300);
  assert.equal(readings.at(-1), false, 'Latest resumes following');
  scroll(900, 1900);
  list.onContentSizeChange(400, 2000);
  await flushFrame();
  assert.equal(scrolls.at(-1)?.offset, 1400, 'Latest also follows subsequent layout');
  scroll(1400, 2000);
  // The row commits before ResizeObserver reports its new dimensions. No frame or size
  // callback is delivered: the production row hook must read the current scroll host.
  liveHost = { scrollHeight: 2180, clientHeight: 600, scrollTop: 1400 };
  await render([messages[0], { ...messages[1], text: 'Completed reply with suggestions' }]);
  assert.equal(scrolls.at(-1)?.offset, 1580, 'latest-row commit uses live geometry before measurement');
  assert.equal(scrolls.at(-1)?.animated, false, 'web placement works with its frame clock suspended');
  assert.equal(frames.size, 0, 'essential positioning never schedules an animation frame');
  await act(async () => root.unmount());
});

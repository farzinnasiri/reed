import assert from 'node:assert/strict';
import test from 'node:test';
import {
  act,
  createElement,
  useImperativeHandle,
  useLayoutEffect,
  type ReactNode,
  type Ref,
} from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { reedTheme } from '../design/system';
import { platformModule } from './helpers/platform-module';

const dom = new JSDOM('<!doctype html><div id="root"></div>');
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
});

type NativeProps = {
  children?: ReactNode;
  ref?: Ref<unknown>;
  onPress?: () => void;
  onLayout?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  disabled?: boolean;
};
function View({ children, ref, onLayout }: NativeProps) {
  useImperativeHandle(
    ref,
    () => ({
      measureInWindow: (callback: (...args: number[]) => void) =>
        callback(14, 232, 328, 60),
    }),
    [],
  );
  useLayoutEffect(() => {
    onLayout?.();
  }, [onLayout]);
  return createElement('div', null, children);
}
function Pressable({
  children,
  ref,
  onPress,
  accessibilityLabel,
  disabled,
}: NativeProps) {
  useImperativeHandle(
    ref,
    () => ({
      measureInWindow: (callback: (...args: number[]) => void) =>
        callback(18, 300, 44, 44),
    }),
    [],
  );
  return createElement(
    'button',
    { onClick: onPress, 'aria-label': accessibilityLabel, disabled },
    children,
  );
}
function Text({ children, accessibilityRole }: NativeProps) {
  return createElement('span', { role: accessibilityRole }, children);
}

test('message reactions close optimistically, serialize saves, roll back failure', async () => {
  const calls: unknown[] = [];
  let reject!: (reason: Error) => void;
  let resolve!: () => void;
  let pending = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const mutate = (args: unknown) => {
    calls.push(args);
    return pending;
  };
  const { MessageActions } = platformModule<
    typeof import('../components/reed/message-actions')
  >('components/reed/message-actions.tsx', {
    'react-native': {
      View,
      Pressable,
      ScrollView: View,
      StyleSheet: { absoluteFill: {} },
      Platform: { OS: 'web' },
      useWindowDimensions: () => ({ width: 356, height: 771 }),
    },
    'react-native-reanimated': { __esModule: true, default: { View } },
    'react-native-gesture-handler': {
      Gesture: { Pan: () => new GestureBuilder() },
      GestureDetector: View,
    },
    '@gorhom/portal': { Portal: View },
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
    },
    'convex/react': { useMutation: () => mutate },
    '@/convex/_generated/api': { api: { reed: { setMessageReaction: {} } } },
    '@expo/vector-icons/Ionicons': { __esModule: true, default: () => null },
    'expo-clipboard': { setStringAsync: async () => {} },
    '@/components/ui/reed-text': { ReedText: Text },
    '@/design/provider': { useReedTheme: () => ({ theme: reedTheme }) },
    '@/design/motion': {
      getTapScaleStyle: () => ({}),
      reedMotion: {
        messageActions: {
          holdMs: 300,
          slideActivation: 8,
          enterScale: 0.96,
          copyFeedbackMs: 1200,
        },
      },
    },
    '@/design/use-entry-animation': { useEntryAnimation: () => ({}) },
    '@/design/haptics': { selection() {}, warning() {} },
    './presence/use-presence-activity': { usePresenceActivity: () => true },
    '@/lib/client-observability': {
      startClientWideEvent: () => ({ end() {}, fail() {} }),
    },
    [process.cwd() + '/lib/client-observability.ts']: {
      startClientWideEvent: () => ({ end() {}, fail() {} }),
    },
  });
  const root = createRoot(document.getElementById('root')!);
  const find = (label: string) =>
    [...document.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === label,
    )!;
  const click = (label: string) =>
    act(async () => {
      find(label).click();
    });
  await act(async () =>
    root.render(
      createElement(MessageActions, {
        text: 'A reply',
        messageId: 'message',
        reaction: '❤️',
        children: createElement('p', null, 'A reply'),
      }),
    ),
  );
  assert.ok(find('Copy response'));
  await click('Change reaction ❤️');
  await click('React 💪');
  assert.ok(find('Change reaction 💪'));
  assert.equal(find('Close reactions'), undefined);
  assert.equal(find('Change reaction 💪').disabled, true);
  assert.deepEqual(calls, [{ messageId: 'message', reaction: '💪' }]);
  await act(async () => {
    reject(new Error('Save unavailable'));
  });
  assert.ok(find('Change reaction ❤️'));
  assert.match(
    document.querySelector('[role="alert"]')!.textContent!,
    /Could not save/,
  );

  pending = new Promise<void>((yes) => {
    resolve = yes;
  });
  await click('Change reaction ❤️');
  await click('React ❤️');
  assert.ok(find('React to response'));
  await act(async () => {
    resolve();
  });
  assert.deepEqual(calls.at(-1), { messageId: 'message', reaction: null });
  await act(async () => root.unmount());
});

class GestureBuilder {
  enabled() {
    return this;
  }
  activateAfterLongPress() {
    return this;
  }
  shouldCancelWhenOutside() {
    return this;
  }
  runOnJS() {
    return this;
  }
  onStart() {
    return this;
  }
  onUpdate() {
    return this;
  }
  onEnd() {
    return this;
  }
  onFinalize() {
    return this;
  }
}

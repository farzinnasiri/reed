import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createHapticPolicy, type HapticMoment } from '../design/haptic-policy';
import { deliverHaptic as deliverWeb } from '../design/haptics-driver.web';
import { platformModule } from './helpers/platform-module';

function policy() {
  const delivered: HapticMoment[] = [];
  let time = 1000;
  const feedback = createHapticPolicy(moment => delivered.push(moment), () => time);
  return { feedback, delivered, advance: (ms = 100) => { time += ms; } };
}

test('preference loading is silent, explicit choices beat late hydration, and muted arrivals never replay', () => {
  const { feedback, delivered, advance } = policy();
  feedback.emit('saved');
  feedback.emit('reply', 'old');
  feedback.setEnabled(false);
  feedback.hydrate(true);
  assert.equal(feedback.preference().enabled, false);
  feedback.setEnabled(true);
  assert.equal(feedback.emit('reply', 'old'), false);
  feedback.emit('saved'); advance();
  feedback.setActive(false); feedback.emit('reply', 'hidden');
  feedback.setActive(true); feedback.emit('reply', 'hidden');
  feedback.emit('reply', 'completed-while-asleep', 900);
  advance(); feedback.emit('reply', 'completed-while-asleep', 2000);
  assert.deepEqual(delivered, ['saved']);
});

test('shared events deduplicate, rapid detents are bounded, and reduced motion keeps useful confirmations', () => {
  const { feedback, delivered, advance } = policy();
  feedback.hydrate(true);
  feedback.emit('reply', 'reply-1');
  advance(); feedback.emit('reply', 'reply-1');
  feedback.emit('detent'); advance(30); feedback.emit('detent');
  advance(40); feedback.emit('detent'); advance();
  feedback.setReduced(true); feedback.emit('play'); feedback.emit('saved');
  assert.deepEqual(delivered, ['reply', 'detent', 'detent', 'saved']);
  const unavailable = createHapticPolicy(() => { throw new Error('No hardware'); });
  unavailable.hydrate(true);
  assert.doesNotThrow(() => unavailable.emit('completed'));
});

test('reply failure feedback deduplicates each attempt while allowing a later failed retry', context => {
  let time = 1000;
  context.mock.method(Date, 'now', () => time);
  const calls: HapticMoment[] = [];
  const haptics = platformModule<typeof import('../design/haptics')>('design/haptics.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    './haptics-driver': { deliverHaptic: (moment: HapticMoment) => calls.push(moment) },
  });
  haptics.hapticPolicy.hydrate(true);
  haptics.replyFailed('same-reply', time);
  time += 100;
  haptics.replyFailed('same-reply', 1000);
  haptics.replyFailed('same-reply', time);
  assert.deepEqual(calls, ['error', 'error']);
  haptics.hapticPolicy.setActive(false);
  time += 100;
  haptics.hapticPolicy.setActive(true);
  haptics.replyFailed('same-reply', 1150);
  assert.deepEqual(calls, ['error', 'error']);
});

test('web uses brief Android patterns, stays silent for iOS, hidden pages and unactivated documents', () => {
  const dom = new JSDOM('', { pretendToBeVisual: true });
  const priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const calls: unknown[] = [];
  const navigator = { userAgent: 'Android Chrome', userActivation: { hasBeenActive: true }, vibrate: (value: unknown) => { calls.push(value); return true; } };
  Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
  try {
    deliverWeb('selection'); deliverWeb('completed'); deliverWeb('detent');
    navigator.userActivation.hasBeenActive = false; deliverWeb('saved');
    navigator.userActivation.hasBeenActive = true;
    navigator.userAgent = 'iPhone Safari'; deliverWeb('reply');
    navigator.userAgent = 'Android Chrome';
    Object.defineProperty(dom.window.document, 'visibilityState', { value: 'hidden' }); deliverWeb('attention');
    assert.deepEqual(calls, [12, [18, 65, 18]]);
  } finally {
    if (priorNavigator) Object.defineProperty(globalThis, 'navigator', priorNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
    if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument); else Reflect.deleteProperty(globalThis, 'document');
    dom.window.close();
  }
});

test('native Android uses system feedback; iOS ordinary saves stay lighter than workout completion', async () => {
  for (const os of ['android', 'ios']) {
    const calls: unknown[] = [];
    const android = { Segment_Tick: 'tick', Toggle_On: 'on', Toggle_Off: 'off', Segment_Frequent_Tick: 'detent', Confirm: 'confirm', Virtual_Key: 'key', Context_Click: 'context', Long_Press: 'attention', Reject: 'reject' };
    const driver = platformModule<typeof import('../design/haptics-driver')>('design/haptics-driver.ts', {
      'react-native': { Platform: { OS: os } },
      'expo-haptics': {
        AndroidHaptics: android, ImpactFeedbackStyle: { Light: 'light', Soft: 'soft' }, NotificationFeedbackType: { Success: 'success', Error: 'error' },
        performAndroidHapticsAsync: async (value: unknown) => { calls.push(value); },
        selectionAsync: async () => { calls.push('selection'); },
        impactAsync: async (value: unknown) => { calls.push(value); },
        notificationAsync: async (value: unknown) => { calls.push(value); },
      },
    });
    driver.deliverHaptic('saved'); driver.deliverHaptic('completed'); driver.deliverHaptic('detent'); driver.deliverHaptic('toggleOff');
    assert.deepEqual(calls, os === 'android' ? ['confirm', 'confirm', 'detent', 'off'] : ['light', 'success', 'selection', 'selection']);
  }
});

test('the shared conversation ignores history, hidden completion, widget updates and reconnect catch-up', () => {
  const calls: string[] = [];
  const module = platformModule<typeof import('../components/reed/reed-feedback')>('components/reed/reed-feedback.ts', {
    '@/design/haptics': { reply: (id: string) => calls.push(id), replyFailed: () => calls.push('error'), warning: () => calls.push('error') },
    '@/design/sounds': { replyArrived() {} },
  });
  const observe = module.createConversationFeedback();
  const owner = Symbol(); module.setConversationFeedbackVisible(owner, true);
  const row = (id: string, status: 'pending' | 'sent' | 'failed', at = Date.now() + 100) => ({ id, createdAt: at, role: 'assistant' as const, source: 'typed' as const, status, text: '' });
  const history = row('history', 'sent', 1);
  observe([history], true, true);
  observe([history, row('new', 'pending')], true, true);
  observe([history, row('new', 'sent')], true, true);
  observe([history, { ...row('new', 'sent'), text: 'with a widget' }], true, true);
  module.setConversationFeedbackVisible(owner, false);
  observe([history, row('hidden', 'sent')], true, true);
  module.setConversationFeedbackVisible(owner, true);
  observe([history, row('hidden', 'sent')], true, true);
  observe([row('offline', 'pending', 2)], true, false);
  observe([row('offline', 'pending', 2)], true, true);
  observe([row('offline', 'sent', 2)], true, true);
  observe([row('fresh', 'pending')], true, true);
  observe([row('fresh', 'failed')], true, true);
  assert.deepEqual(calls, ['new', 'error']);
});

test('iPhone tap input keeps one accessible control, checks state and cancels dragged actions; disabling feedback removes it', async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  let enabled = true;
  let calls = 0;
  const View = ({ children }: { children?: ReactNode }) => createElement('div', null, children);
  const Pressable = ({ children, onPress, disabled, accessibilityLabel, 'aria-checked': ariaChecked }: { children?: ReactNode; onPress?: () => void; disabled?: boolean; accessibilityLabel?: string; 'aria-checked'?: boolean }) => createElement('button', { onClick: onPress, disabled, 'aria-label': accessibilityLabel, 'aria-checked': ariaChecked }, children);
  const { HapticPressable } = platformModule<typeof import('../components/ui/haptic-pressable.web')>('components/ui/haptic-pressable.web.tsx', {
    'react-native': { View, Pressable },
    '@/design/haptic-feedback': { useHapticPreference: () => ({ ready: true, enabled }) },
    '@/design/provider': { useReedTheme: () => ({ theme: { colors: { accent: '#888' } } }) },
    '@/design/haptics-driver.web': { isIPhoneSwitchAvailable: () => true },
    '@/design/haptics': { toggle() {}, selection() {} },
  });
  const root = createRoot(document.getElementById('root')!);
  const render = (disabled = false) => act(async () => root.render(createElement(HapticPressable, {
    accessibilityLabel: 'Warm-up', accessibilityRole: 'switch', hapticValue: false,
    accessibilityState: { checked: false }, disabled, onPress: () => { calls++; }, children: 'Warm-up',
  })));
  await render();
  const input = document.querySelector('input')!;
  assert.equal(input.getAttribute('switch'), '');
  assert.equal(input.getAttribute('role'), 'switch');
  assert.equal(input.getAttribute('aria-label'), 'Warm-up');
  assert.equal(document.querySelectorAll('input, button').length, 1);
  await act(async () => input.click()); assert.equal(calls, 1);
  await act(async () => {
    input.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }));
    input.dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: 0, clientY: 35 }));
    input.click();
  }); assert.equal(calls, 1);
  enabled = false; await render(); assert.equal(document.querySelector('input[switch]'), null);
  assert.equal(document.querySelector('input'), input);
  await act(async () => input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))); assert.equal(calls, 2);
  await render(true); await act(async () => document.querySelector('input')!.click()); assert.equal(calls, 2);
  await act(async () => root.render(createElement(HapticPressable, {
    accessibilityLabel: 'Next set', accessibilityRole: 'radio', accessibilityState: { checked: true },
    onPress() {}, children: 'Next set',
  })));
  assert.equal(document.querySelector('input'), null);
  assert.equal(document.querySelector('button')?.getAttribute('aria-checked'), 'true');
  await act(async () => root.render(createElement(HapticPressable, {
    systemSwitch: false, accessibilityLabel: 'Open workout', accessibilityRole: 'button', onPress() {}, children: 'Open',
  })));
  assert.equal(document.querySelector('input'), null);
  assert.equal(document.querySelector('button')?.getAttribute('aria-label'), 'Open workout');
  await act(async () => root.unmount()); dom.window.close();
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { useReedReducedMotion } from './use-reed-reduced-motion';
import { reedHaptics } from './haptic-policy';
import { detent, settled, hapticPolicy } from './haptics';

const KEY = 'reed.haptics.v1';
let writes: Promise<unknown> = Promise.resolve();

export function HapticFeedbackLifecycle() {
  const reduced = useReedReducedMotion();
  useEffect(() => { hapticPolicy.setReduced(reduced); }, [reduced]);
  useEffect(() => {
    void AsyncStorage.getItem(KEY).then(value => hapticPolicy.hydrate(value !== 'off'), () => hapticPolicy.hydrate(true));
    const foreground = () => {
      const active = AppState.currentState === 'active'
        && (Platform.OS !== 'web' || document.visibilityState === 'visible');
      hapticPolicy.setActive(active);
      if (!active && Platform.OS === 'web' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(0); } catch { /* Best effort cancellation. */ }
      }
    };
    foreground();
    const subscription = AppState.addEventListener('change', foreground);
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', foreground);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', foreground);
      hapticPolicy.setActive(false);
    };
  }, []);
  return null;
}

export function useHapticPreference() {
  useSyncExternalStore(hapticPolicy.subscribe, hapticPolicy.snapshot, () => 0);
  return { ...hapticPolicy.preference(), setEnabled };
}

function setEnabled(value: boolean) {
  hapticPolicy.setEnabled(value);
  if (!value && Platform.OS === 'web' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(0); } catch { /* Best effort cancellation. */ }
  }
  writes = writes.catch(() => {}).then(() => AsyncStorage.setItem(KEY, value ? 'on' : 'off'));
  void writes.catch(() => {});
}

/** For scroll-based draft pickers: no Android-web pulse train during momentum. */
export function usePickerHaptics() {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
  }, []);
  const settle = useCallback(() => {
    const hadChange = pending.current !== null;
    cancel();
    if (hadChange) settled();
  }, [cancel]);
  const preview = useCallback(() => {
    if (!hapticPolicy.available()) { cancel(); return; }
    detent();
    if (Platform.OS === 'web') {
      cancel();
      pending.current = setTimeout(settle, reedHaptics.pickerSettleMs);
    }
  }, [cancel, settle]);
  useEffect(() => cancel, [cancel]);
  return { preview, settle, cancel };
}

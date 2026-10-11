import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

export type StartCountdownSeconds = 0 | 3 | 5;
const KEY = 'reed.start-countdown.v1';
let seconds: StartCountdownSeconds = 3;
let touched = false;
let writes: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
const snapshot = () => seconds;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function publish(value: StartCountdownSeconds) {
  seconds = value;
  listeners.forEach(listener => listener());
}

export function TimerPreferenceLifecycle() {
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(KEY).then(value => {
      if (mounted && !touched) publish(value === '0' ? 0 : value === '5' ? 5 : 3);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  return null;
}

export function useStartCountdownPreference() {
  const seconds = useSyncExternalStore(subscribe, snapshot, () => 3 as StartCountdownSeconds);
  return { seconds, setSeconds };
}
function setSeconds(value: StartCountdownSeconds) {
  touched = true;
  publish(value);
  writes = writes.catch(() => {}).then(() => AsyncStorage.setItem(KEY, String(value)));
  void writes.catch(() => {});
}

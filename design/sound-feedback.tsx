import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { prepareForegroundSoundsAsync, releaseForegroundSounds, unlockForegroundSounds } from '@/lib/foreground-audio';
import { soundPolicy, soundSources } from './sounds';

const KEY = 'reed.sounds.v1';
let writes: Promise<unknown> = Promise.resolve();

export function SoundFeedbackLifecycle() {
  const { ready, enabled } = useSoundPreference();
  useEffect(() => {
    void AsyncStorage.getItem(KEY).then(value => soundPolicy.hydrate(value !== 'off'), () => soundPolicy.hydrate(true));
    const foreground = () => soundPolicy.setActive(AppState.currentState === 'active'
      && (Platform.OS !== 'web' || document.visibilityState === 'visible'));
    foreground();
    const subscription = AppState.addEventListener('change', foreground);
    const unlock = (event: Event) => {
      if (!event.isTrusted) return;
      if (soundPolicy.available()) unlockForegroundSounds();
      void soundPolicy.retryPending();
    };
    if (Platform.OS === 'web') {
      document.addEventListener('visibilitychange', foreground);
      document.addEventListener('pointerup', unlock, true);
      document.addEventListener('keydown', unlock, true);
    }
    return () => {
      subscription.remove(); soundPolicy.setActive(false); releaseForegroundSounds();
      if (Platform.OS === 'web') {
        document.removeEventListener('visibilitychange', foreground);
        document.removeEventListener('pointerup', unlock, true);
        document.removeEventListener('keydown', unlock, true);
      }
    };
  }, []);
  useEffect(() => {
    if (ready && enabled) void prepareForegroundSoundsAsync(Object.values(soundSources)).catch(() => {});
  }, [ready, enabled]);
  return null;
}

export function useSoundPreference() {
  useSyncExternalStore(soundPolicy.subscribe, soundPolicy.snapshot, () => 0);
  return { ...soundPolicy.preference(), setEnabled };
}
function setEnabled(value: boolean) {
  soundPolicy.setEnabled(value);
  writes = writes.catch(() => {}).then(() => AsyncStorage.setItem(KEY, value ? 'on' : 'off'));
  void writes.catch(() => {});
}

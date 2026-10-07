import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { useCallback, useEffect, useState } from 'react';

const INTRO_KEY = 'reed.launch-intro.v1';
let seenThisSession = false;
export const launchCutouts = [
  require('@/assets/launch/shoe.png'),
  require('@/assets/launch/snowboard.png'),
  require('@/assets/launch/kettlebell.png'),
] as const;

/** Device-local, independent of profile data. Review replay never rewrites the flag. */
export function useLaunchIntroduction(enabled: boolean, replay = false) {
  const [phase, setPhase] = useState<'checking' | 'intro' | 'welcome'>('checking');
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    async function prepare() {
      const seen = !replay && (seenThisSession || await AsyncStorage.getItem(INTRO_KEY).then(value => value === 'seen').catch(() => false));
      if (!seen) await Asset.loadAsync([...launchCutouts]).catch(() => {});
      if (mounted) setPhase(seen ? 'welcome' : 'intro');
    }
    void prepare();
    return () => { mounted = false; };
  }, [enabled, replay]);
  const finish = useCallback(() => {
    setPhase('welcome');
    if (!replay) {
      seenThisSession = true;
      void AsyncStorage.setItem(INTRO_KEY, 'seen').catch(() => {});
    }
  }, [replay]);
  return { phase: enabled ? phase : 'welcome', finish };
}

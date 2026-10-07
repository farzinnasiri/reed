import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { addLowPowerModeListener, isLowPowerModeEnabledAsync } from 'expo-battery';
export function useLowPower() {
  const [lowPower, setLowPower] = useState(false);
  useEffect(() => {
    let live = true;
    const refresh = () => { void isLowPowerModeEnabledAsync().then(value => { if (live) setLowPower(value); }).catch(() => {}); };
    refresh();
    const power = addLowPowerModeListener(event => setLowPower(event.lowPowerMode));
    const app = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { live = false; power.remove(); app.remove(); };
  }, []);
  return lowPower;
}

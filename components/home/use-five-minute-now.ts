import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export const FIVE_MINUTE_BUCKET_MS = 5 * 60 * 1000;

function currentBucket() {
  return Math.floor(Date.now() / FIVE_MINUTE_BUCKET_MS) * FIVE_MINUTE_BUCKET_MS;
}

/**
 * Client time rounded down to five minutes: the `now` that `home.getPulse` and the Consistency
 * queries require. A stable value keeps those subscriptions cached, and refreshing it on the
 * bucket boundary and on foreground makes them re-run across midnight.
 */
export function useFiveMinuteNow() {
  const [now, setNow] = useState(currentBucket);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function sync() {
      if (timeout) clearTimeout(timeout);
      setNow(currentBucket());
      timeout = setTimeout(sync, currentBucket() + FIVE_MINUTE_BUCKET_MS - Date.now() + 50);
    }

    sync();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') sync();
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      subscription.remove();
    };
  }, []);

  return now;
}

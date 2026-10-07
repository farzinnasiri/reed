import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { startClientWideEvent } from '@/lib/client-observability';

function getDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Keeps the profile time zone equal to the device's, on mount and whenever the app returns to the
 * foreground. The Pulse and Consistency count local days and weeks from it. The backend treats an
 * equivalent zone (including an alias) as a no-op, so comparing names here cannot loop.
 */
export function useDeviceTimeZoneSync() {
  const viewer = useQuery(api.profiles.viewer, {});
  const updateTimeZone = useMutation(api.profiles.updateTimeZone);
  const [timeZone, setTimeZone] = useState(getDeviceTimeZone);
  // Bumped on every foreground so a failed sync retries even when the zone itself did not change.
  const [foregroundCount, setForegroundCount] = useState(0);
  const inFlightZoneRef = useRef<string | null>(null);
  const storedTimeZone = viewer?.timeZone;
  const isViewerReady = Boolean(viewer);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      setTimeZone(getDeviceTimeZone());
      setForegroundCount(count => count + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isViewerReady || !timeZone || storedTimeZone === timeZone || inFlightZoneRef.current === timeZone) return;

    // Released on completion so a failure retries on the next foreground.
    inFlightZoneRef.current = timeZone;
    const event = startClientWideEvent('profile_time_zone_sync');
    updateTimeZone({ timeZone })
      .then(() => event.end())
      .catch(error => event.fail(error, 'profile_time_zone_sync_failed'))
      .finally(() => {
        inFlightZoneRef.current = null;
      });
  }, [foregroundCount, isViewerReady, storedTimeZone, timeZone, updateTimeZone]);
}

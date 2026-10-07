import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useMutation } from 'convex/react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '@/convex/_generated/api';
import { createPushDeviceLifecycle } from './push-device-lifecycle';
import { disablePushDeviceAsync, registerPushDeviceAsync } from './push-notifications';

const Context = createContext<ReturnType<typeof createDeviceOwner> | null>(null);

function createDeviceOwner(
  disableDevice: Parameters<typeof registerPushDeviceAsync>[0]['disableDevice'],
  registerDevice: Parameters<typeof registerPushDeviceAsync>[0]['registerDevice'],
) {
  return createPushDeviceLifecycle({
    register: () => registerPushDeviceAsync({ disableDevice, registerDevice }),
    disable: (reason) => disablePushDeviceAsync(disableDevice, reason),
  });
}

export function PushDeviceProvider({
  profileId,
  children,
}: {
  profileId: string | null;
  children: ReactNode;
}) {
  const disableDevice = useMutation(api.notificationDevices.disableCurrentDevice);
  const registerDevice = useMutation(api.notificationDevices.registerDevice);
  const owner = useMemo(() => {
    const next = createDeviceOwner(disableDevice, registerDevice);
    if (!profileId) next.dispose();
    return next;
  }, [disableDevice, registerDevice, profileId]);

  useEffect(() => {
    if (!profileId || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;
    owner.activate();
    void owner.register();
    // Expo emits a native FCM/APNs token here. Registration resolves an Expo token instead.
    const subscription = Notifications.addPushTokenListener(() => {
      void owner.register();
    });
    return () => {
      subscription.remove();
      owner.dispose();
    };
  }, [owner, profileId]);

  return <Context.Provider value={owner}>{children}</Context.Provider>;
}

export function usePushDevice() {
  const value = useContext(Context);
  if (!value) throw new Error('Push devices require the authenticated navigation provider.');
  return value;
}

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { requestAppNotificationPermissionsAsync } from '@/lib/background-alerts';

const CLIENT_INSTALL_ID_KEY = 'reed.push.clientInstallId.v1';
const REMOTE_NOTIFICATION_CHANNEL_ID = 'reed-updates-v1';

type RegisterDevice = (args: {
  appVersion?: string;
  clientInstallId: string;
  expoPushToken: string;
  platform: 'android' | 'ios';
}) => Promise<null>;

type DisableDevice = (args: {
  clientInstallId: string;
  reason: 'logout' | 'permission_denied';
}) => Promise<null>;

let responseHandlerInstalled = false;
let tokenListenerInstalled = false;

export async function registerPushDeviceAsync({
  disableDevice,
  registerDevice,
}: {
  disableDevice: DisableDevice;
  registerDevice: RegisterDevice;
}) {
  if (Platform.OS === 'web') return;
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

  const clientInstallId = await getClientInstallIdAsync();
  const permissionStatus = await requestAppNotificationPermissionsAsync();
  if (permissionStatus !== 'granted') {
    await disableDevice({ clientInstallId, reason: 'permission_denied' }).catch(() => null);
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMOTE_NOTIFICATION_CHANNEL_ID, {
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      name: 'Reed updates',
      sound: 'default',
      vibrationPattern: [0, 250, 200, 250],
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.info('[push-notifications] missing EAS project id');
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerDevice({
    appVersion: Application.nativeApplicationVersion ?? Constants.expoConfig?.version,
    clientInstallId,
    expoPushToken: token.data,
    platform: Platform.OS,
  });

  installNotificationResponseHandler();
  installPushTokenRotationListener(registerDevice, clientInstallId);
}

function installNotificationResponseHandler() {
  if (responseHandlerInstalled) return;
  responseHandlerInstalled = true;

  Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    const destination = getNotificationDestination(data);
    if (destination) {
      router.push(destination);
    }
  });
}

function installPushTokenRotationListener(registerDevice: RegisterDevice, clientInstallId: string) {
  if (tokenListenerInstalled) return;
  tokenListenerInstalled = true;

  Notifications.addPushTokenListener(token => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    void registerDevice({
      appVersion: Application.nativeApplicationVersion ?? Constants.expoConfig?.version,
      clientInstallId,
      expoPushToken: token.data,
      platform: Platform.OS,
    }).catch(() => null);
  });
}

async function getClientInstallIdAsync() {
  const existing = await SecureStore.getItemAsync(CLIENT_INSTALL_ID_KEY);
  if (existing) return existing;

  const next = createClientInstallId();
  await SecureStore.setItemAsync(CLIENT_INSTALL_ID_KEY, next);
  return next;
}

function createClientInstallId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getNotificationDestination(data: Notifications.NotificationContent['data']) {
  if (!data) return null;

  const screen = typeof data.screen === 'string' ? data.screen : null;

  if (screen === 'goals') return '/(app)/goals' as const;
  if (screen === 'home') return '/(app)/(tabs)/home' as const;
  if (screen === 'profile') return '/(app)/(tabs)/profile' as const;
  if (screen === 'reed') return '/(app)/(tabs)/reed' as const;
  if (screen === 'workout') return '/(app)/(tabs)/workout' as const;

  return null;
}

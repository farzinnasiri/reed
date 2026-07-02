import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { requestAppNotificationPermissionsAsync } from '@/lib/background-alerts';
import { startClientWideEvent } from '@/lib/client-observability';

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
  reason: 'logout' | 'permission_denied' | 'user_disabled';
}) => Promise<null>;

export type PushDeviceRegistrationStatus =
  | 'failed'
  | 'missing_project_id'
  | 'permission_denied'
  | 'registered'
  | 'unavailable_platform'
  | 'unavailable_web';

let responseHandlerInstalled = false;
let tokenListenerInstalled = false;

export async function registerPushDeviceAsync({
  disableDevice,
  registerDevice,
}: {
  disableDevice: DisableDevice;
  registerDevice: RegisterDevice;
}): Promise<PushDeviceRegistrationStatus> {
  const event = startClientWideEvent('push_device_registration', {
    'push.platform': Platform.OS,
  });

  try {
    if (Platform.OS === 'web') {
      event.end({ 'push.status': 'unavailable_web' });
      return 'unavailable_web';
    }
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      event.end({ 'push.status': 'unavailable_platform' });
      return 'unavailable_platform';
    }

    const clientInstallId = await getClientInstallIdAsync();
    event.set({ 'push.step': 'permission' });
    const permissionStatus = await requestAppNotificationPermissionsAsync();
    event.set({ 'push.permission.status': permissionStatus });
    if (permissionStatus !== 'granted') {
      await disableDevice({ clientInstallId, reason: 'permission_denied' }).catch(() => null);
      event.end({ 'push.status': permissionStatus });
      return 'permission_denied';
    }

    if (Platform.OS === 'android') {
      event.set({ 'push.step': 'android_channel' });
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
      event.end({ 'push.status': 'missing_project_id' });
      return 'missing_project_id';
    }

    event.set({ 'push.step': 'expo_token' });
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    event.set({ 'push.step': 'convex_register' });
    await registerDevice({
      appVersion: Application.nativeApplicationVersion ?? Constants.expoConfig?.version,
      clientInstallId,
      expoPushToken: token.data,
      platform: Platform.OS,
    });

    installNotificationResponseHandler();
    installPushTokenRotationListener(registerDevice, clientInstallId);
    event.end({ 'push.status': 'registered' });
    return 'registered';
  } catch (error) {
    event.fail(error, 'push_device_registration_failed');
    return 'failed';
  }
}

export async function disablePushDeviceAsync(disableDevice: DisableDevice) {
  const event = startClientWideEvent('push_device_disable', {
    'push.platform': Platform.OS,
  });

  try {
    if (Platform.OS === 'web' || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
      event.end({ 'push.status': 'unavailable_platform' });
      return;
    }

    const clientInstallId = await getClientInstallIdAsync();
    await disableDevice({ clientInstallId, reason: 'user_disabled' });
    event.end({ 'push.status': 'disabled' });
  } catch (error) {
    event.fail(error, 'push_device_disable_failed');
  }
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

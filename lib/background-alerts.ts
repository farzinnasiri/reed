import { AppState, Platform } from 'react-native';
import type { AudioSource } from 'expo-audio';

export type ScheduledAlertPermissionStatus = 'granted' | 'permission_denied' | 'unavailable';
export type ScheduledAlertStatus = 'scheduled' | 'expired' | ScheduledAlertPermissionStatus;

export type ScheduledAlertDefinition<Payload> = {
  androidChannelId: string;
  androidChannelName: string;
  foregroundSound?: AudioSource;
  sound: 'default' | string;
  vibrationPattern?: number[];
  buildContent: (payload: Payload) => {
    body: string;
    title: string;
  };
};

type NotificationModule = typeof import('expo-notifications');
type NotificationPermissionStatus = Awaited<ReturnType<NotificationModule['getPermissionsAsync']>>;

let configuredNotificationHandler = false;
let notificationsModulePromise: Promise<NotificationModule | null> | null = null;
let appNotificationPermissionRequest: Promise<ScheduledAlertPermissionStatus> | null = null;
const activeNotificationIdsByChannel = new Map<string, string>();

function logScheduledAlert(message: string, details?: Record<string, unknown>) {
  console.info('[background-alerts]', message, details ?? {});
}

async function getNotificationsModule() {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications');
  }

  return notificationsModulePromise;
}

async function configureNotificationHandlerOnce() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return false;
  }

  if (configuredNotificationHandler) {
    return true;
  }

  configuredNotificationHandler = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: AppState.currentState !== 'active',
      shouldShowList: AppState.currentState !== 'active',
    }),
  });

  return true;
}

export async function ensureScheduledAlertPermissionsAsync<Payload>(
  definition: ScheduledAlertDefinition<Payload>,
): Promise<ScheduledAlertPermissionStatus> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return 'unavailable';
  }

  const handlerReady = await configureNotificationHandlerOnce();
  if (!handlerReady) {
    return 'unavailable';
  }

  if (Platform.OS === 'android') {
    logScheduledAlert('ensure-channel', {
      channelId: definition.androidChannelId,
      platform: Platform.OS,
      sound: definition.sound,
    });
    await Notifications.setNotificationChannelAsync(definition.androidChannelId, {
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      name: definition.androidChannelName,
      sound: definition.sound,
      vibrationPattern: definition.vibrationPattern ?? [0, 250, 200, 250],
    });
  }

  return requestNotificationPermissionsAsync(Notifications);
}

export async function requestAppNotificationPermissionsAsync(): Promise<ScheduledAlertPermissionStatus> {
  if (appNotificationPermissionRequest) {
    return appNotificationPermissionRequest;
  }

  appNotificationPermissionRequest = requestAppNotificationPermissionsOnceAsync();
  return appNotificationPermissionRequest;
}

export async function scheduleBackgroundAlertAsync<Payload>({
  definition,
  fireAt,
  payload,
}: {
  definition: ScheduledAlertDefinition<Payload>;
  fireAt: number;
  payload: Payload;
}): Promise<{ notificationId: string | null; status: ScheduledAlertStatus }> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return { notificationId: null, status: 'unavailable' };
  }

  const permissionStatus = await ensureScheduledAlertPermissionsAsync(definition);
  if (permissionStatus !== 'granted') {
    return { notificationId: null, status: permissionStatus };
  }

  const content = definition.buildContent(payload);
  await clearBackgroundAlertDefinitionAsync(definition);
  const seconds = Math.ceil((fireAt - Date.now()) / 1000);
  if (seconds <= 0) return { notificationId: null, status: 'expired' };
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      body: content.body,
      sound: definition.sound,
      title: content.title,
    },
    trigger: {
      channelId: Platform.OS === 'android' ? definition.androidChannelId : undefined,
      seconds,
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    },
  });
  activeNotificationIdsByChannel.set(definition.androidChannelId, notificationId);
  logScheduledAlert('scheduled', {
    channelId: definition.androidChannelId,
    notificationId,
    seconds,
  });

  return { notificationId, status: 'scheduled' };
}

export async function showImmediateBackgroundAlertAsync<Payload>({
  definition,
  payload,
}: {
  definition: ScheduledAlertDefinition<Payload>;
  payload: Payload;
}) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  const permissionStatus = await ensureScheduledAlertPermissionsAsync(definition);
  if (permissionStatus !== 'granted') {
    return null;
  }

  const content = definition.buildContent(payload);
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      body: content.body,
      sound: definition.sound,
      title: content.title,
    },
    trigger: null,
  });
  activeNotificationIdsByChannel.set(definition.androidChannelId, notificationId);
  logScheduledAlert('shown-immediate', {
    channelId: definition.androidChannelId,
    notificationId,
  });

  return notificationId;
}

export async function clearBackgroundAlertAsync(notificationId: string | null) {
  const Notifications = await getNotificationsModule();
  if (!Notifications || !notificationId) {
    return;
  }

  const results = await Promise.allSettled([
    Notifications.cancelScheduledNotificationAsync(notificationId),
    Notifications.dismissNotificationAsync(notificationId),
  ]);
  const failure = results.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  logScheduledAlert('cleared', { notificationId });

  for (const [channelId, activeNotificationId] of activeNotificationIdsByChannel) {
    if (activeNotificationId === notificationId) {
      activeNotificationIdsByChannel.delete(channelId);
    }
  }
}

export async function clearBackgroundAlertDefinitionAsync<Payload>(
  definition: ScheduledAlertDefinition<Payload>,
) {
  const notificationId = activeNotificationIdsByChannel.get(definition.androidChannelId) ?? null;
  await clearBackgroundAlertAsync(notificationId);
}

function isNotificationPermissionGranted(permission: NotificationPermissionStatus) {
  if (Platform.OS !== 'ios') {
    return permission.granted;
  }

  return permission.granted || (permission.ios?.status ?? 0) >= 2;
}

async function requestNotificationPermissionsAsync(
  Notifications: NotificationModule,
): Promise<ScheduledAlertPermissionStatus> {
  const permission = await Notifications.getPermissionsAsync();
  if (isNotificationPermissionGranted(permission)) {
    return 'granted';
  }

  if (!permission.canAskAgain) {
    return 'permission_denied';
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  return isNotificationPermissionGranted(requested) ? 'granted' : 'permission_denied';
}

async function requestAppNotificationPermissionsOnceAsync(): Promise<ScheduledAlertPermissionStatus> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return 'unavailable';
  }

  const handlerReady = await configureNotificationHandlerOnce();
  if (!handlerReady) {
    return 'unavailable';
  }

  return requestNotificationPermissionsAsync(Notifications);
}

import { AppState, Platform } from 'react-native';

export type ScheduledAlertPermissionStatus = 'granted' | 'permission_denied' | 'unavailable';
export type ScheduledAlertStatus = 'scheduled' | ScheduledAlertPermissionStatus;

export type ScheduledAlertDefinition<Payload> = {
  androidChannelId: string;
  androidChannelName: string;
  foregroundSound?: unknown;
  sound: 'default';
  vibrationPattern?: number[];
  buildContent: (payload: Payload) => {
    body: string;
    title: string;
  };
};

type NotificationPermissionStatus = {
  canAskAgain: boolean;
  granted: boolean;
  ios?: {
    status?: number;
  } | null;
};

type NotificationHandlerResponse = {
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
  shouldShowBanner: boolean;
  shouldShowList: boolean;
};

type NotificationRequest = {
  content: {
    body: string;
    sound: 'default';
    title: string;
  };
  trigger:
    | null
    | {
        channelId?: string;
        seconds: number;
        type: string;
      };
};

type NotificationModule = {
  AndroidImportance: {
    MAX: number;
  };
  AndroidNotificationVisibility: {
    PUBLIC: number;
  };
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: string;
  };
  cancelScheduledNotificationAsync: (identifier: string) => Promise<void>;
  dismissNotificationAsync: (identifier: string) => Promise<void>;
  getPermissionsAsync: () => Promise<NotificationPermissionStatus>;
  requestPermissionsAsync: (request: {
    ios: {
      allowAlert: boolean;
      allowBadge: boolean;
      allowSound: boolean;
    };
  }) => Promise<NotificationPermissionStatus>;
  scheduleNotificationAsync: (request: NotificationRequest) => Promise<string>;
  setNotificationChannelAsync: (
    channelId: string,
    config: {
      importance: number;
      lockscreenVisibility: number;
      name: string;
      sound: 'default';
      vibrationPattern: number[];
    },
  ) => Promise<void>;
  setNotificationHandler: (handler: {
    handleNotification: () => Promise<NotificationHandlerResponse>;
  }) => void;
};

let configuredNotificationHandler = false;
let notificationsModulePromise: Promise<NotificationModule | null> | null = null;
let appNotificationPermissionRequest: Promise<ScheduledAlertPermissionStatus> | null = null;
const activeNotificationIdsByChannel = new Map<string, string>();

async function getNotificationsModule() {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').then(
      module => module as unknown as NotificationModule,
    );
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
  fireInSeconds,
  payload,
}: {
  definition: ScheduledAlertDefinition<Payload>;
  fireInSeconds: number;
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
  const seconds = Math.max(1, Math.round(fireInSeconds));
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

  return notificationId;
}

export async function clearBackgroundAlertAsync(notificationId: string | null) {
  const Notifications = await getNotificationsModule();
  if (!Notifications || !notificationId) {
    return;
  }

  await Promise.allSettled([
    Notifications.cancelScheduledNotificationAsync(notificationId),
    Notifications.dismissNotificationAsync(notificationId),
  ]);

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

import { AppState, Platform } from 'react-native';

const REST_TIMER_CHANNEL_ID = 'rest-timer';

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
  trigger: {
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

export type RestTimerAlertPermissionStatus = 'granted' | 'permission_denied' | 'unavailable';
export type RestTimerAlertScheduleStatus = 'scheduled' | RestTimerAlertPermissionStatus;

let configuredNotificationHandler = false;
let notificationsModulePromise: Promise<NotificationModule | null> | null = null;
let scheduledRestTimerNotificationId: string | null = null;

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
      shouldPlaySound: AppState.currentState !== 'active',
      shouldSetBadge: false,
      shouldShowBanner: AppState.currentState !== 'active',
      shouldShowList: AppState.currentState !== 'active',
    }),
  });

  return true;
}

export async function ensureRestTimerAlertPermissionsAsync(): Promise<RestTimerAlertPermissionStatus> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return 'unavailable';
  }

  const handlerReady = await configureNotificationHandlerOnce();
  if (!handlerReady) {
    return 'unavailable';
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      name: 'Rest timer',
      sound: 'default',
      vibrationPattern: [0, 250, 200, 250],
    });
  }

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

export async function scheduleRestTimerBackgroundAlertAsync({
  exerciseName,
  nextSetNumber,
  secondsUntilFinish,
}: {
  exerciseName: string;
  nextSetNumber: number;
  secondsUntilFinish: number;
}): Promise<RestTimerAlertScheduleStatus> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return 'unavailable';
  }

  const permissionStatus = await ensureRestTimerAlertPermissionsAsync();
  if (permissionStatus !== 'granted') {
    return permissionStatus;
  }

  await cancelRestTimerBackgroundAlertsAsync();

  const seconds = Math.max(1, Math.round(secondsUntilFinish));
  scheduledRestTimerNotificationId = await Notifications.scheduleNotificationAsync({
    content: {
      body: `${exerciseName} · Set ${nextSetNumber} is ready.`,
      sound: 'default',
      title: 'Rest complete',
    },
    trigger: {
      channelId: Platform.OS === 'android' ? REST_TIMER_CHANNEL_ID : undefined,
      seconds,
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    },
  });

  return 'scheduled';
}

export async function cancelRestTimerBackgroundAlertsAsync() {
  const Notifications = await getNotificationsModule();
  if (!Notifications || !scheduledRestTimerNotificationId) {
    scheduledRestTimerNotificationId = null;
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(scheduledRestTimerNotificationId);
  scheduledRestTimerNotificationId = null;
}

function isNotificationPermissionGranted(permission: NotificationPermissionStatus) {
  if (Platform.OS !== 'ios') {
    return permission.granted;
  }

  return permission.granted || (permission.ios?.status ?? 0) >= 2;
}

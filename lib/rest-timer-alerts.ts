import { restCompleteAlert, type RestCompleteAlertPayload } from '@/domains/alerts/alert-definitions';
import {
  clearBackgroundAlertDefinitionAsync,
  clearBackgroundAlertAsync,
  ensureScheduledAlertPermissionsAsync,
  showImmediateBackgroundAlertAsync,
} from '@/lib/background-alerts';
import { playForegroundSoundAsync } from '@/lib/foreground-audio';

export type RestTimerAlertPermissionStatus = 'granted' | 'permission_denied' | 'unavailable';

let fallbackNotificationId: string | null = null;

export async function ensureRestTimerAlertPermissionsAsync(): Promise<RestTimerAlertPermissionStatus> {
  return ensureScheduledAlertPermissionsAsync(restCompleteAlert);
}

export async function cancelRestTimerBackgroundAlertsAsync() {
  await Promise.all([
    clearBackgroundAlertDefinitionAsync(restCompleteAlert),
    clearBackgroundAlertAsync(fallbackNotificationId),
  ]);
  fallbackNotificationId = null;
}

export async function playRestTimerCompletionCueAsync(payload: RestCompleteAlertPayload) {
  const playedLocalCue = restCompleteAlert.foregroundSound
    ? await playForegroundSoundAsync(restCompleteAlert.foregroundSound).catch(() => false)
    : false;

  if (playedLocalCue) {
    return;
  }

  await cancelRestTimerBackgroundAlertsAsync();
  fallbackNotificationId = await showImmediateBackgroundAlertAsync({
    definition: restCompleteAlert,
    payload,
  });
}

import { restCompleteAlert } from '@/lib/rest-alert-definition';
import { ensureScheduledAlertPermissionsAsync } from '@/lib/background-alerts';
import { restCompleted } from '@/design/sounds';

export type RestTimerAlertPermissionStatus = 'granted' | 'permission_denied' | 'unavailable';

export async function ensureRestTimerAlertPermissionsAsync(): Promise<RestTimerAlertPermissionStatus> {
  return ensureScheduledAlertPermissionsAsync(restCompleteAlert);
}

export async function playRestTimerCompletionCueAsync(key: string) {
  return await restCompleted(key) ? 'local' as const : 'unavailable' as const;
}

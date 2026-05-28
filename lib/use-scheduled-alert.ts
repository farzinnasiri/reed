import { useEffect, useRef } from 'react';
import {
  clearBackgroundAlertAsync,
  scheduleBackgroundAlertAsync,
  type ScheduledAlertDefinition,
  type ScheduledAlertPermissionStatus,
} from '@/lib/background-alerts';

type UseScheduledAlertParams<Payload> = {
  alertKey: string | null;
  definition: ScheduledAlertDefinition<Payload>;
  enabled: boolean;
  fireInSeconds: number;
  onPermissionDenied: () => void;
  payload: Payload | null;
};

export function useScheduledAlert<Payload>({
  alertKey,
  definition,
  enabled,
  fireInSeconds,
  onPermissionDenied,
  payload,
}: UseScheduledAlertParams<Payload>) {
  const activeAlertKeyRef = useRef<string | null>(null);
  const notificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    const nextPayload = payload;
    const nextAlertKey = enabled && nextPayload && fireInSeconds > 0 ? alertKey : null;

    if (!nextAlertKey || !nextPayload) {
      if (activeAlertKeyRef.current !== null || notificationIdRef.current !== null) {
        void clearBackgroundAlertAsync(notificationIdRef.current);
        activeAlertKeyRef.current = null;
        notificationIdRef.current = null;
      }
      return;
    }

    if (nextAlertKey === activeAlertKeyRef.current) {
      return;
    }

    const previousNotificationId = notificationIdRef.current;
    activeAlertKeyRef.current = nextAlertKey;
    notificationIdRef.current = null;

    void clearBackgroundAlertAsync(previousNotificationId).then(() =>
      scheduleBackgroundAlertAsync({
        definition,
        fireInSeconds,
        payload: nextPayload,
      }).then(result => {
        if (activeAlertKeyRef.current !== nextAlertKey) {
          void clearBackgroundAlertAsync(result.notificationId);
          return;
        }

        notificationIdRef.current = result.notificationId;
        if (result.status === 'permission_denied') {
          onPermissionDenied();
        }
      }),
    );
  }, [alertKey, definition, enabled, fireInSeconds, onPermissionDenied, payload]);

  useEffect(() => {
    return () => {
      void clearBackgroundAlertAsync(notificationIdRef.current);
      activeAlertKeyRef.current = null;
      notificationIdRef.current = null;
    };
  }, []);
}

export type { ScheduledAlertPermissionStatus };

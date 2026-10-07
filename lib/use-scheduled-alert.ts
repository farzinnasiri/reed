import { useEffect, useRef } from 'react';
import { startClientWideEvent } from './client-observability';
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
  fireAt: number | null;
  onPermissionDenied: () => void;
  payload: Payload | null;
};

export function useScheduledAlert<Payload>({
  alertKey,
  definition,
  enabled,
  fireAt,
  onPermissionDenied,
  payload,
}: UseScheduledAlertParams<Payload>) {
  const generationRef = useRef(0);
  const notificationIdRef = useRef<string | null>(null);
  const queueRef = useRef(Promise.resolve());

  useEffect(() => {
    const generation = ++generationRef.current;
    const event = startClientWideEvent('alert.schedule');
    const synchronize = async () => {
      // Serialize native writes, including late schedules and failed cancellation retries.
      if (generation !== generationRef.current) {
        event.end({ 'alert.status': 'superseded' });
        return;
      }
      await clearBackgroundAlertAsync(notificationIdRef.current);
      notificationIdRef.current = null;
      if (generation !== generationRef.current) {
        event.end({ 'alert.status': 'superseded' });
        return;
      }
      if (!enabled || !alertKey || !payload || fireAt === null || fireAt <= Date.now()) {
        event.end({ 'alert.status': 'cleared' });
        return;
      }
      const result = await scheduleBackgroundAlertAsync({
        definition,
        fireAt,
        payload,
      });
      notificationIdRef.current = result.notificationId;
      if (generation !== generationRef.current) {
        await clearBackgroundAlertAsync(notificationIdRef.current);
        notificationIdRef.current = null;
      } else if (result.status === 'permission_denied') {
        onPermissionDenied();
      }
      event.end({ 'alert.status': result.status });
    };
    queueRef.current = queueRef.current.then(synchronize).catch((error) => {
      event.fail(error, 'alert_schedule_failed');
    });
    return () => {
      generationRef.current += 1;
    };
  }, [alertKey, definition, enabled, fireAt, onPermissionDenied, payload]);

  useEffect(
    () => () => {
      generationRef.current += 1;
      const event = startClientWideEvent('alert.clear');
      queueRef.current = queueRef.current
        .then(async () => {
          await clearBackgroundAlertAsync(notificationIdRef.current);
          notificationIdRef.current = null;
          event.end();
        })
        .catch((error) => event.fail(error, 'alert_clear_failed'));
    },
    [],
  );
}

export type { ScheduledAlertPermissionStatus };

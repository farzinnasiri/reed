import { useEffect, useMemo, useRef } from 'react';
import { getRestDeadline } from '@/domains/workout/rest';
import { restCompleteAlert } from '@/lib/rest-alert-definition';
import { ensureRestTimerAlertPermissionsAsync } from '@/lib/rest-timer-alerts';
import { useScheduledAlert } from '@/lib/use-scheduled-alert';
import { startClientWideEvent } from '@/lib/client-observability';
import type { RestCard } from './workout-surface.types';

type UseRestBackgroundAlertsParams = {
  cardMode: 'capture' | 'live_cardio' | 'rest';
  onPermissionDenied: () => void;
  restCard: RestCard | null;
};

export function useRestBackgroundAlerts({
  cardMode,
  onPermissionDenied,
  restCard,
}: UseRestBackgroundAlertsParams) {
  const hasCheckedPermissionRef = useRef(false);
  const loggedAlertKeyRef = useRef<string | null>(null);
  const isRestRunning = cardMode === 'rest' && Boolean(restCard?.isRunning);
  const fireAt = restCard ? getRestDeadline(restCard) : null;
  const alertKey = isRestRunning && restCard && fireAt !== null
    ? `${restCard.sessionExerciseId}:${restCard.nextSetNumber}:${fireAt}`
    : null;
  const exerciseName = restCard?.exerciseName;
  const nextSetNumber = restCard?.nextSetNumber;
  const payload = useMemo(
    () =>
      exerciseName !== undefined && nextSetNumber !== undefined
        ? {
            exerciseName,
            nextSetNumber,
          }
        : null,
    [exerciseName, nextSetNumber],
  );

  useScheduledAlert({
    alertKey,
    definition: restCompleteAlert,
    enabled: isRestRunning,
    fireAt,
    onPermissionDenied,
    payload,
  });

  useEffect(() => {
    if (!alertKey) {
      loggedAlertKeyRef.current = null;
      return;
    }

    if (!restCard || loggedAlertKeyRef.current === alertKey) {
      return;
    }

    loggedAlertKeyRef.current = alertKey;
    console.info('[rest-timer-alerts]', 'schedule-requested', {
      durationSeconds: restCard.durationSeconds,
      fireAt,
      nextSetNumber: restCard.nextSetNumber,

    });
  }, [alertKey, fireAt, restCard]);

  useEffect(() => {
    if (!isRestRunning || hasCheckedPermissionRef.current) {
      return;
    }

    hasCheckedPermissionRef.current = true;
    const event = startClientWideEvent('alert.permission');
    void ensureRestTimerAlertPermissionsAsync().then(status => {
      event.end({ 'alert.status': status });
      if (status === 'permission_denied') {
        onPermissionDenied();
      }
    }).catch(error => event.fail(error, 'alert_permission_failed'));
  }, [isRestRunning, onPermissionDenied]);
}

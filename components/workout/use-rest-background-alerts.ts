import { useEffect, useMemo, useRef } from 'react';
import { restCompleteAlert } from '@/domains/alerts/alert-definitions';
import { ensureRestTimerAlertPermissionsAsync } from '@/lib/rest-timer-alerts';
import { useScheduledAlert } from '@/lib/use-scheduled-alert';
import type { RestCard } from './workout-surface.types';

type UseRestBackgroundAlertsParams = {
  cardMode: 'capture' | 'live_cardio' | 'rest';
  onPermissionDenied: () => void;
  restCard: RestCard | null;
  restRemaining: number;
};

export function useRestBackgroundAlerts({
  cardMode,
  onPermissionDenied,
  restCard,
  restRemaining,
}: UseRestBackgroundAlertsParams) {
  const hasCheckedPermissionRef = useRef(false);
  const loggedAlertKeyRef = useRef<string | null>(null);
  const isRestRunning = cardMode === 'rest' && Boolean(restCard?.isRunning);
  const scheduledRemainingSeconds = restCard?.remainingSeconds ?? null;
  const alertKey =
    isRestRunning && restCard
      ? `${restCard.sessionExerciseId}:${restCard.nextSetNumber}:${restCard.durationSeconds}:${scheduledRemainingSeconds}:${restCard.isRunning ? 'running' : 'idle'}`
      : null;
  const payload = useMemo(
    () =>
      restCard
        ? {
            exerciseName: restCard.exerciseName,
            nextSetNumber: restCard.nextSetNumber,
          }
        : null,
    [restCard?.exerciseName, restCard?.nextSetNumber],
  );

  useScheduledAlert({
    alertKey,
    definition: restCompleteAlert,
    enabled: isRestRunning && restRemaining > 0,
    fireInSeconds: restRemaining,
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
      fireInSeconds: restRemaining,
      nextSetNumber: restCard.nextSetNumber,
      scheduledRemainingSeconds,
    });
  }, [alertKey, restCard, restRemaining, scheduledRemainingSeconds]);

  useEffect(() => {
    if (!isRestRunning || hasCheckedPermissionRef.current) {
      return;
    }

    hasCheckedPermissionRef.current = true;
    void ensureRestTimerAlertPermissionsAsync().then(status => {
      if (status === 'permission_denied') {
        onPermissionDenied();
      }
    });
  }, [isRestRunning, onPermissionDenied]);
}

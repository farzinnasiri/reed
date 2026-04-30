import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  cancelRestTimerBackgroundAlertsAsync,
  ensureRestTimerAlertPermissionsAsync,
  scheduleRestTimerBackgroundAlertAsync,
} from '@/lib/rest-timer-alerts';
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
  const [appState, setAppState] = useState(AppState.currentState);
  const hasCheckedPermissionRef = useRef(false);
  const previousAppStateRef = useRef(AppState.currentState);
  const previousRestAlertKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (cardMode !== 'rest' || !restCard?.isRunning || hasCheckedPermissionRef.current) {
      return;
    }

    hasCheckedPermissionRef.current = true;
    void ensureRestTimerAlertPermissionsAsync().then(status => {
      if (status === 'permission_denied') {
        onPermissionDenied();
      }
    });
  }, [cardMode, onPermissionDenied, restCard?.isRunning]);

  useEffect(() => {
    const nextRestAlert =
      cardMode === 'rest' && restCard?.isRunning && restRemaining > 0
        ? {
            exerciseName: restCard.exerciseName,
            key: `${restCard.sessionExerciseId}:${restCard.nextSetNumber}:${restCard.isRunning ? 'running' : 'idle'}`,
            nextSetNumber: restCard.nextSetNumber,
            secondsUntilFinish: restRemaining,
          }
        : null;

    const previousAppState = previousAppStateRef.current;
    const wasActive = previousAppState === 'active';
    const isActive = appState === 'active';
    const restAlertKeyChanged = nextRestAlert?.key !== previousRestAlertKeyRef.current;

    if (isActive) {
      if (!wasActive || previousRestAlertKeyRef.current !== null) {
        void cancelRestTimerBackgroundAlertsAsync();
      }
    } else if (!nextRestAlert) {
      if (previousRestAlertKeyRef.current !== null) {
        void cancelRestTimerBackgroundAlertsAsync();
      }
    } else if (wasActive || restAlertKeyChanged) {
      void scheduleRestTimerBackgroundAlertAsync({
        exerciseName: nextRestAlert.exerciseName,
        nextSetNumber: nextRestAlert.nextSetNumber,
        secondsUntilFinish: nextRestAlert.secondsUntilFinish,
      }).then(status => {
        if (status === 'permission_denied') {
          onPermissionDenied();
        }
      });
    }

    previousAppStateRef.current = appState;
    previousRestAlertKeyRef.current = nextRestAlert?.key ?? null;
  }, [
    appState,
    cardMode,
    onPermissionDenied,
    restCard?.exerciseName,
    restCard?.isRunning,
    restCard?.nextSetNumber,
    restCard?.sessionExerciseId,
    restRemaining,
  ]);

  useEffect(() => {
    return () => {
      void cancelRestTimerBackgroundAlertsAsync();
    };
  }, []);
}

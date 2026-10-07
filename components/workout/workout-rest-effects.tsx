import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { startClientWideEvent } from '@/lib/client-observability';
import { playRestTimerCompletionCueAsync } from '@/lib/rest-timer-alerts';
import type { RestCard } from './workout-surface.types';
import { useRestBackgroundAlerts } from './use-rest-background-alerts';
import { useRestCountdown } from './use-rest-countdown';

export function WorkoutRestEffects({
  onPermissionDenied,
  restCard,
}: {
  onPermissionDenied: () => void;
  restCard: RestCard | null;
}) {
  const remaining = useRestCountdown(restCard)?.remainingSeconds ?? 0;
  const previousRemainingRef = useRef<number | null>(null);

  useEffect(() => {
    const previous = previousRemainingRef.current;
    previousRemainingRef.current = remaining;
    if (
      restCard &&
      previous !== null &&
      previous > 0 &&
      remaining === 0 &&
      AppState.currentState === 'active'
    ) {
      const event = startClientWideEvent('alert.foreground');
      void playRestTimerCompletionCueAsync({
        exerciseName: restCard.exerciseName,
        nextSetNumber: restCard.nextSetNumber,
      })
        .then(() => event.end())
        .catch((error) => event.fail(error, 'alert_foreground_failed'));
    }
  }, [remaining, restCard]);

  useRestBackgroundAlerts({
    cardMode: restCard ? 'rest' : 'capture',
    onPermissionDenied,
    restCard,
  });

  return null;
}

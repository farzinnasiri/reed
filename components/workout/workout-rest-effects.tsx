import { useEffect, useRef } from 'react';
import * as haptics from '@/design/haptics';
import { getRestDeadline } from '@/domains/workout/rest';
import { AppState, Platform } from 'react-native';
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
  const previousRemainingRef = useRef<{ key: string | null; remaining: number; visible: boolean } | null>(null);

  useEffect(() => {
    // Inactive apps can suspend JS: clear the baseline at the event, before the resumed clock ticks.
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') previousRemainingRef.current = null;
    });
    const visibility = () => { if (document.hidden) previousRemainingRef.current = null; };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    const previous = previousRemainingRef.current;
    const key = restCard ? `${restCard.sessionExerciseId}:${restCard.nextSetNumber}:${getRestDeadline(restCard)}` : null;
    const visible = AppState.currentState === 'active' && (Platform.OS !== 'web' || !document.hidden);
    previousRemainingRef.current = { key, remaining, visible };
    if (
      restCard &&
      previous !== null &&
      previous.key === key &&
      previous.visible &&
      previous.remaining > 0 &&
      remaining === 0 &&
      visible && key
    ) {
      const event = startClientWideEvent('alert.foreground');
      haptics.attention(key);
      void playRestTimerCompletionCueAsync(key)
        .then(() => {
          event.end();
        })
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

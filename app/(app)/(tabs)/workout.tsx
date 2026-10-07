import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { appModeRoutes, type WorkoutEntryIntent } from '@/components/home/app-routes';
import { WorkoutSurface } from '@/components/workout/workout-surface';

export default function WorkoutRoute() {
  const params = useLocalSearchParams<{ intent?: string; session?: string }>();
  const entryIntent = useMemo<WorkoutEntryIntent | null>(() => {
    if (typeof params.session === 'string' && params.session) return { kind: 'session', sessionId: params.session };
    if (params.intent === 'start' || params.intent === 'resume' || params.intent === 'sessions') return { kind: params.intent };
    return null;
  }, [params.intent, params.session]);
  // Params are one-shot: clearing them keeps a later tab switch from reopening the same entry.
  const clearEntryIntent = useCallback(() => {
    if (Platform.OS === 'web') router.replace(appModeRoutes.workout);
    else router.setParams({ intent: undefined, session: undefined });
  }, []);

  return (
    <WorkoutSurface
      entryIntent={entryIntent}
      onBack={() => router.navigate(appModeRoutes.chat)}
      onEntryIntentHandled={clearEntryIntent}
    />
  );
}

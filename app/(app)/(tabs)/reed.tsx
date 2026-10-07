import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { appModeRoutes } from '@/components/home/app-routes';
import { ReedSurface } from '@/components/reed/reed-surface';
import { useAppShell } from '@/components/home/app-shell-context';

export default function ReedRoute() {
  const { displayName } = useAppShell();
  const params = useLocalSearchParams<{ pulse?: string; you?: string }>();
  // The params are one-shot: clearing them keeps a later visit from reopening the Pulse or the
  // sheet, and lets the same link work again. On web `setParams` leaves them in the URL and the
  // router state, so the clean path replaces them there.
  const clearPulseParam = useCallback(() => {
    if (Platform.OS === 'web') router.replace(appModeRoutes.chat);
    else router.setParams({ pulse: undefined });
  }, []);
  const clearYouParam = useCallback(() => {
    if (Platform.OS === 'web') router.replace(appModeRoutes.chat);
    else router.setParams({ you: undefined });
  }, []);

  return (
    <ReedSurface
      displayName={displayName}
      onPulseOpened={clearPulseParam}
      onYouOpened={clearYouParam}
      openPulse={params.pulse === 'open'}
      openYou={params.you === 'open'}
    />
  );
}

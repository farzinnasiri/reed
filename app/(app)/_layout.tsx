import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useQuery } from 'convex/react';
import { AppShell } from '@/components/home/app-shell';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';
import { api } from '@/convex/_generated/api';
import { useReedTheme } from '@/design/provider';
import { authClient } from '@/lib/auth-client';

export default function AuthenticatedAppLayout() {
  const { theme } = useReedTheme();
  const { data: session, isPending: isAuthPending } = authClient.useSession();
  const viewer = useQuery(api.profiles.viewer, session ? {} : 'skip');

  if (isAuthPending) {
    return null;
  }

  if (!session) {
    return null;
  }

  if (viewer === undefined || viewer === null) {
    return null;
  }

  if (!viewer.onboardingCompletedAt) {
    return null;
  }

  return (
    <ScreenBackdrop>
      <AppShell displayName={viewer.displayName ?? session.user.name ?? 'there'}>
        <Stack
          screenOptions={{
            animation: Platform.OS === 'web' ? 'none' : 'fade',
            contentStyle: { backgroundColor: theme.colors.canvas },
            fullScreenGestureEnabled: false,
            fullScreenGestureShadowEnabled: false,
            gestureEnabled: false,
            headerShown: false,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="goals" />
        </Stack>
      </AppShell>
    </ScreenBackdrop>
  );
}

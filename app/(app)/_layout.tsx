import { Stack } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { Platform } from 'react-native';
import { useConvexAuth, useQuery } from 'convex/react';
import { AppShell } from '@/components/home/app-shell';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';
import { api } from '@/convex/_generated/api';
import { useReedTheme } from '@/design/provider';

export default function AuthenticatedAppLayout() {
  const { theme } = useReedTheme();
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const { user } = useUser();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : 'skip');

  if (!isClerkLoaded || isConvexAuthLoading) {
    return null;
  }

  if (!isSignedIn || !isAuthenticated) {
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
      <AppShell displayName={viewer.displayName ?? user?.fullName ?? 'there'}>
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

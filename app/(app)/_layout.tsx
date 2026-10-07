import { onboardingComplete } from '@/domains/profile/onboarding';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { Platform } from 'react-native';
import { useConvexAuth, useQuery } from 'convex/react';
import { AppShell } from '@/components/home/app-shell';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';
import { api } from '@/convex/_generated/api';
import { useReedTheme } from '@/design/provider';
import { MessageActionsHost } from '@/components/reed/message-actions';
import { SessionMascotHost } from '@/components/reed/session/session-mascot';
import { ReedConversationProvider } from '@/components/reed/reed-conversation-context';
import { WorkoutSessionRuntimeProvider } from '@/components/workout/workout-session-runtime';

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

  if (!onboardingComplete(viewer)) {
    return null;
  }

  return (
    <ScreenBackdrop>
      <WorkoutSessionRuntimeProvider>
        <ReedConversationProvider>
          <AppShell displayName={viewer.displayName ?? user?.fullName ?? 'there'}>
            <BottomSheetModalProvider>
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
                <Stack.Screen name="progress" />
                <Stack.Screen name="you" />
                <Stack.Screen name="goals" />
              </Stack>
              <SessionMascotHost />
              <MessageActionsHost />
            </BottomSheetModalProvider>
          </AppShell>
        </ReedConversationProvider>
      </WorkoutSessionRuntimeProvider>
    </ScreenBackdrop>
  );
}

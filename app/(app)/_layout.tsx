import { Redirect, Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useQuery } from 'convex/react';
import { AppShell } from '@/components/home/app-shell';
import { AppSplash } from '@/components/ui/app-splash';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';
import { api } from '@/convex/_generated/api';
import { useReedTheme } from '@/design/provider';
import { authClient } from '@/lib/auth-client';

export default function AuthenticatedAppLayout() {
  const { theme } = useReedTheme();
  const { data: session, isPending: isAuthPending } = authClient.useSession();
  const viewer = useQuery(api.profiles.viewer, session ? {} : 'skip');

  if (isAuthPending) {
    return (
      <ScreenBackdrop>
        <AppSplash message="Checking the current session." />
      </ScreenBackdrop>
    );
  }

  if (!session) {
    return <Redirect href="/" />;
  }

  if (viewer === undefined || viewer === null) {
    return (
      <ScreenBackdrop>
        <AppSplash message="Finishing your account setup." />
      </ScreenBackdrop>
    );
  }

  if (!viewer.onboardingCompletedAt) {
    return <Redirect href="/" />;
  }

  return (
    <ScreenBackdrop>
      <AppShell displayName={viewer.displayName ?? session.user.name ?? 'there'}>
        <Stack
          screenOptions={{
            animation: 'slide_from_right',
            animationDuration: Platform.OS === 'web' ? 160 : undefined,
            contentStyle: { backgroundColor: theme.colors.canvas },
            headerShown: false,
          }}
        />
      </AppShell>
    </ScreenBackdrop>
  );
}

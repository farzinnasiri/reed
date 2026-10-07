import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { analytics } from '@/lib/analytics';
import { api } from '@/convex/_generated/api';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';
import { AuthEntry } from '@/components/home/auth-entry';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { onboardingPayload } from '@/components/onboarding/persistence';
import { EMPTY_DRAFT } from '@/components/onboarding/draft';
import { onboardingComplete } from '@/domains/profile/onboarding';
import { useReedTheme } from '@/design/provider';
import { appRouteFromModeParam } from '@/components/home/app-routes';
import { useAuthEntry } from '@/components/home/use-auth-entry';
import { startClientWideEvent } from '@/lib/client-observability';

export default function HomeScreen() {
  const params = useLocalSearchParams<{ mode?: string; auth?: string }>();
  const { isLoaded: isAuthLoaded, isSignedIn, userId } = useAuth();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const auth = useAuthEntry(params.auth === 'verify' ? 'verification' : 'credentials');
  const session = isSignedIn && isAuthenticated;
  const viewer = useQuery(api.profiles.viewer, session ? {} : 'skip');
  const ensureViewerProfile = useMutation(api.profiles.ensureViewerProfile);
  const { theme } = useReedTheme();
  const [enteredAuth, setEnteredAuth] = useState(params.auth === 'verify');
  const completeOnboarding = useMutation(api.onboarding.complete);

  const viewerProfile = viewer ?? null;
  const needsOnboarding = Boolean(session && viewerProfile && !onboardingComplete(viewerProfile));

  const isPending = !isAuthLoaded || (isSignedIn && isConvexAuthLoading);

  useEffect(() => {
    if (!userId || !isAuthenticated) {
      return;
    }

    const operation = startClientWideEvent('profile.ensure');
    void ensureViewerProfile({}).then(() => operation.end()).catch(error => {
      operation.fail(error, 'profile.ensure_failed');
    });
  }, [ensureViewerProfile, isAuthenticated, userId]);

  const [previousSession, setPreviousSession] = useState(session);
  if (previousSession !== session) {
    setPreviousSession(session);
    if (!session) {
      setEnteredAuth(false);
    }
  }

  return (
    <ScreenBackdrop>
      {isPending ? (
        null
      ) : session && viewer === undefined ? (
        null
      ) : session && viewer === null ? (
        null
      ) : session && needsOnboarding ? (
        <OnboardingFlow
          initialDraft={{ ...EMPTY_DRAFT, name: viewerProfile?.displayName ?? '' }}
          initialStep="hello"
          onComplete={async draft => {
            const payload = onboardingPayload(draft);
            await completeOnboarding(payload);
            analytics.onboardingCompleted({ practiceCount: payload.answers.practices.length, valueCount: payload.answers.values.length });
          }}
        />
      ) : session ? (
        <Redirect href={appRouteFromModeParam(typeof params.mode === 'string' ? params.mode : undefined)} />
      ) : !enteredAuth ? (
        <OnboardingFlow
          welcomeOnly
          onComplete={() => { void auth.actions.changeMode('sign-up'); setEnteredAuth(true); }}
          onSignIn={() => { void auth.actions.changeMode('sign-in'); setEnteredAuth(true); }}
        />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboard}
        >
          <ScrollView
            contentContainerStyle={[
              styles.content,
              {
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.xl,
              },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <AuthEntry controller={auth} onBack={() => setEnteredAuth(false)} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});

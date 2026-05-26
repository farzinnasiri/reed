import { Redirect, useLocalSearchParams } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/convex/_generated/api';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';
import { AppSplash } from '@/components/ui/app-splash';
import { AuthEntry } from '@/components/home/auth-entry';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { LoveLetter } from '@/components/onboarding/love-letter';
import { useReedTheme } from '@/design/provider';
import { appRouteFromModeParam } from '@/components/home/app-routes';
import type { AuthMode } from '@/components/home/types';

export default function HomeScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { data: session, isPending: isAuthPending } = authClient.useSession();
  const viewer = useQuery(api.profiles.viewer, session ? {} : 'skip');
  const ensureViewerProfile = useMutation(api.profiles.ensureViewerProfile);
  const { theme } = useReedTheme();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [hasDismissedOnboarding, setHasDismissedOnboarding] = useState(false);
  const [hasCompletedOnboardingLocally, setHasCompletedOnboardingLocally] = useState(false);

  const viewerProfile = viewer ?? null;
  const needsOnboarding = Boolean(
    session &&
      viewerProfile &&
      !viewerProfile.onboardingCompletedAt &&
      !hasDismissedOnboarding &&
      !hasCompletedOnboardingLocally,
  );
  
  const isPending = isAuthPending;

  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  useEffect(() => {
    if (!session?.user.id) {
      return;
    }

    void ensureViewerProfile({}).catch(error => {
      setErrorMessage(getErrorMessage(error));
    });
  }, [ensureViewerProfile, session?.user.id]);

  useEffect(() => {
    if (!session) {
      setHasCompletedOnboardingLocally(false);
      setHasDismissedOnboarding(false);
      setWelcomeName(null);
    }
  }, [session]);

  async function runAuthAction(action: () => Promise<void>) {
    setIsWorking(true);
    setFeedback(null);
    setErrorMessage(null);

    try {
      await action();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSignUp() {
    const nextEmail = email.trim().toLowerCase();

    if (!nextEmail) {
      setErrorMessage('Email is required.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    await runAuthAction(async () => {
      const fallbackName = nextEmail.split('@')[0]?.trim() || 'User';
      const result = await authClient.signUp.email({
        name: fallbackName,
        email: nextEmail,
        password,
      });

      if (result.error) {
        throw result.error;
      }

      setFeedback('Account created.');
      setPassword('');
    });
  }

  async function handleSignIn() {
    const nextEmail = email.trim().toLowerCase();

    if (!nextEmail || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }

    await runAuthAction(async () => {
      const result = await authClient.signIn.email({
        email: nextEmail,
        password,
        rememberMe: true,
      });

      if (result.error) {
        throw result.error;
      }

      setFeedback('Signed in.');
      setPassword('');
    });
  }

  async function handleGoogleSignIn() {
    if (isExpoGo) {
      setErrorMessage(
        'Google OAuth is not supported in Expo Go. Use a development build on your Android device for that path.',
      );
      return;
    }

    await runAuthAction(async () => {
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/',
      });

      if (result.error) {
        throw result.error;
      }

      setFeedback('Google sign-in started in the system browser.');
    });
  }

  return (
    <ScreenBackdrop>
      {isPending ? (
        <AppSplash />
      ) : session && viewer === undefined ? (
        <AppSplash />
      ) : session && viewer === null ? (
        <AppSplash />
      ) : session && welcomeName ? (
        <LoveLetter
          displayName={welcomeName}
          onContinue={() => setWelcomeName(null)}
        />
      ) : session && needsOnboarding ? (
        <OnboardingFlow
          onComplete={async draft => {
            setHasCompletedOnboardingLocally(true);
            setWelcomeName(draft.displayName);
          }}
          onDecline={async () => {
            setHasDismissedOnboarding(true);
          }}
        />
      ) : session ? (
        <Redirect href={appRouteFromModeParam(typeof params.mode === 'string' ? params.mode : undefined)} />
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
            <AuthEntry
              email={email}
              errorMessage={errorMessage}
              feedback={feedback}
              isExpoGo={isExpoGo}
              isWorking={isWorking}
              mode={mode}
              onChangeEmail={setEmail}
              onChangeMode={setMode}
              onChangePassword={setPassword}
              onGoogleSignIn={handleGoogleSignIn}
              onSubmit={mode === 'sign-up' ? handleSignUp : handleSignIn}
              password={password}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </ScreenBackdrop>
  );
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      code?: string;
      message?: string;
      status?: number;
      statusText?: string;
    };

    if (maybeError.code === 'SESSION_EXPIRED') {
      return 'This action needs a fresh login. Sign in again, then retry.';
    }

    if (maybeError.message) {
      return maybeError.message;
    }

    if (maybeError.statusText) {
      return maybeError.statusText;
    }
  }

  return 'Something went wrong while talking to auth.';
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: 18,
    justifyContent: 'center',
  },
});

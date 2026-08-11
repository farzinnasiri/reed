import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth, useSignIn, useSignUp } from '@clerk/expo';
import { useSSO } from '@clerk/expo/experimental';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { analytics } from '@/lib/analytics';
import { api } from '@/convex/_generated/api';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';
import { AuthEntry } from '@/components/home/auth-entry';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { LoveLetter } from '@/components/onboarding/love-letter';
import { useReedTheme } from '@/design/provider';
import { appRouteFromModeParam } from '@/components/home/app-routes';
import type { AuthMode } from '@/components/home/types';

export default function HomeScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { isLoaded: isAuthLoaded, isSignedIn, userId } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();
  const session = isSignedIn;
  const viewer = useQuery(api.profiles.viewer, session ? {} : 'skip');
  const ensureViewerProfile = useMutation(api.profiles.ensureViewerProfile);
  const { theme } = useReedTheme();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
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
  
  const isPending = !isAuthLoaded;

  useEffect(() => {
    if (!userId) {
      return;
    }

    void ensureViewerProfile({}).catch(error => {
      setErrorMessage(getErrorMessage(error));
    });
  }, [ensureViewerProfile, userId]);

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

    if (password.length < 15) {
      setErrorMessage('Password must be at least 15 characters.');
      return;
    }

    await runAuthAction(async () => {
      const result = await signUp.password({
        emailAddress: nextEmail,
        password,
      });

      if (result.error) {
        throw result.error;
      }

      const verification = await signUp.verifications.sendEmailCode();
      if (verification.error) {
        throw verification.error;
      }

      setIsAwaitingVerification(true);
      setFeedback('We sent a verification code to your email.');
    });
  }

  async function handleVerifyEmail() {
    if (!verificationCode.trim()) {
      setErrorMessage('Enter the verification code from your email.');
      return;
    }

    await runAuthAction(async () => {
      const result = await signUp.verifications.verifyEmailCode({ code: verificationCode.trim() });
      if (result.error) {
        throw result.error;
      }

      const finalized = await signUp.finalize();
      if (finalized.error) {
        throw finalized.error;
      }

      analytics.userSignedUp();
      setFeedback('Account created.');
      setPassword('');
      setVerificationCode('');
      setIsAwaitingVerification(false);
    });
  }

  async function handleSignIn() {
    const nextEmail = email.trim().toLowerCase();

    if (!nextEmail || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }

    await runAuthAction(async () => {
      const result = await signIn.password({
        emailAddress: nextEmail,
        password,
      });

      if (result.error) {
        throw result.error;
      }

      const finalized = await signIn.finalize();
      if (finalized.error) {
        throw finalized.error;
      }

      analytics.userSignedIn({ method: 'email' });
      setFeedback('Signed in.');
      setPassword('');
    });
  }

  async function handleGoogleSignIn() {
    await runAuthAction(async () => {
      await startSSOFlow({ strategy: 'oauth_google' });

      analytics.userSignedIn({ method: 'google' });
    });
  }

  return (
    <ScreenBackdrop>
      {isPending ? (
        null
      ) : session && viewer === undefined ? (
        null
      ) : session && viewer === null ? (
        null
      ) : session && welcomeName ? (
        <LoveLetter
          displayName={welcomeName}
          onContinue={() => setWelcomeName(null)}
        />
      ) : session && needsOnboarding ? (
        <OnboardingFlow
          onComplete={async draft => {
            analytics.onboardingCompleted({ rankedGoalCount: draft.rankedGoals.length });
            setHasCompletedOnboardingLocally(true);
            setWelcomeName(draft.displayName);
          }}
          onDecline={async () => {
            analytics.onboardingDeclined();
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
              isAwaitingVerification={isAwaitingVerification}
              isWorking={isWorking}
              mode={mode}
              onChangeEmail={setEmail}
              onChangeMode={nextMode => {
                setMode(nextMode);
                setIsAwaitingVerification(false);
                setVerificationCode('');
                void signUp.reset();
                void signIn.reset();
              }}
              onChangePassword={setPassword}
              onChangeVerificationCode={setVerificationCode}
              onGoogleSignIn={handleGoogleSignIn}
              onSubmit={isAwaitingVerification ? handleVerifyEmail : mode === 'sign-up' ? handleSignUp : handleSignIn}
              password={password}
              verificationCode={verificationCode}
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

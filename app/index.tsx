import { useLocalSearchParams } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/convex/_generated/api';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';
import { AuthEntry } from '@/components/home/auth-entry';
import { SignedInShell } from '@/components/home/signed-in-shell';
import { useReedTheme } from '@/design/provider';
import type { AuthMode, AppMode } from '@/components/home/types';

export default function HomeScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { data: session, isPending } = authClient.useSession();
  const viewerProfile = useQuery(api.profiles.viewer, session ? {} : 'skip');
  const ensureViewerProfile = useMutation(api.profiles.ensureViewerProfile);
  const { theme } = useReedTheme();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [appMode, setAppMode] = useState<AppMode>('workout');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

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
    if (!session || typeof params.mode !== 'string') {
      return;
    }

    if (params.mode === 'home' || params.mode === 'workout' || params.mode === 'chat' || params.mode === 'settings') {
      setAppMode(params.mode);
    }
  }, [params.mode, session]);

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

    if (!name.trim()) {
      setErrorMessage('Name is required.');
      return;
    }

    if (!nextEmail) {
      setErrorMessage('Email is required.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    await runAuthAction(async () => {
      const result = await authClient.signUp.email({
        name: name.trim(),
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
        <View
          style={[
            styles.loadingScreen,
            {
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.xl,
            },
          ]}
        >
          <GlassSurface>
            <View style={styles.loadingRow}>
              <ActivityIndicator color={String(theme.colors.accentPrimary)} />
              <ReedText tone="muted">Checking the current session.</ReedText>
            </View>
          </GlassSurface>
        </View>
      ) : session && viewerProfile === undefined ? (
        <View
          style={[
            styles.loadingScreen,
            {
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.xl,
            },
          ]}
        >
          <GlassSurface>
            <View style={styles.loadingRow}>
              <ActivityIndicator color={String(theme.colors.accentPrimary)} />
              <ReedText tone="muted">Finishing your account setup.</ReedText>
            </View>
          </GlassSurface>
        </View>
      ) : session ? (
        <SignedInShell
          appMode={appMode}
          displayName={viewerProfile?.displayName ?? session.user.name ?? 'there'}
          onChangeMode={setAppMode}
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
            <AuthEntry
              email={email}
              errorMessage={errorMessage}
              feedback={feedback}
              isExpoGo={isExpoGo}
              isWorking={isWorking}
              mode={mode}
              name={name}
              onChangeEmail={setEmail}
              onChangeMode={setMode}
              onChangeName={setName}
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
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    gap: 18,
    justifyContent: 'center',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});

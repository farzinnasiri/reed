import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/convex/_generated/api';

type AuthMode = 'sign-in' | 'sign-up';

type AuthAccount = {
  accountId: string;
  providerId: string;
};

type AuthSession = {
  expiresAt?: Date;
  token: string;
};

export default function HomeScreen() {
  const { data: session, isPending } = authClient.useSession();
  const viewerProfile = useQuery(api.profiles.viewer, session ? {} : 'skip');
  const ensureViewerProfile = useMutation(api.profiles.ensureViewerProfile);
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<AuthAccount[]>([]);
  const [activeSessions, setActiveSessions] = useState<AuthSession[]>([]);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);

  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  useEffect(() => {
    if (!session?.user.id) {
      setLinkedAccounts([]);
      setActiveSessions([]);
      setDeletePassword('');
      return;
    }

    let cancelled = false;

    void ensureViewerProfile({})
      .catch(error => {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
        }
      });

    setIsMetadataLoading(true);
    void Promise.all([authClient.listAccounts(), authClient.listSessions()])
      .then(([accountsResult, sessionsResult]) => {
        if (cancelled) {
          return;
        }

        if (accountsResult.error) {
          throw accountsResult.error;
        }

        if (sessionsResult.error) {
          throw sessionsResult.error;
        }

        setLinkedAccounts((accountsResult.data ?? []) as AuthAccount[]);
        setActiveSessions((sessionsResult.data ?? []) as AuthSession[]);
      })
      .catch(error => {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsMetadataLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ensureViewerProfile, session?.user.id]);

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

  function normalizedEmail() {
    return email.trim().toLowerCase();
  }

  async function handleSignUp() {
    const nextEmail = normalizedEmail();

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

      setFeedback(`Account created and signed in as ${nextEmail}.`);
      setPassword('');
    });
  }

  async function handleSignIn() {
    const nextEmail = normalizedEmail();

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

  async function handleSignOut() {
    await runAuthAction(async () => {
      const result = await authClient.signOut();

      if (result.error) {
        throw result.error;
      }

      setFeedback('Signed out.');
      setMode('sign-in');
    });
  }

  async function handleSignOutOtherSessions() {
    await runAuthAction(async () => {
      const result = await authClient.revokeOtherSessions();

      if (result.error) {
        throw result.error;
      }

      setActiveSessions(current => current.slice(0, 1));
      setFeedback('Signed out the other active sessions.');
    });
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently removes your auth account and app profile. This cannot be undone.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          style: 'destructive',
          text: 'Delete',
          onPress: () => {
            void handleDeleteAccount();
          },
        },
      ],
    );
  }

  async function handleDeleteAccount() {
    await runAuthAction(async () => {
      const result = await authClient.deleteUser({
        password: deletePassword.trim() || undefined,
      });

      if (result.error) {
        throw result.error;
      }

      setDeletePassword('');
      setFeedback('Account deleted.');
      setMode('sign-in');
    });
  }

  const displayName = viewerProfile?.displayName ?? session?.user.name ?? 'Reed user';
  const linkedProviderNames =
    linkedAccounts.length > 0
      ? linkedAccounts.map(account => readableProviderName(account.providerId)).join(', ')
      : 'Loading account methods';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Reed</Text>
        <Text style={styles.title}>Auth foundation is live on Convex.</Text>
        <Text style={styles.copy}>
          The app syncs an app-owned profile from Better Auth, and keeps account and session
          operations on the auth system itself.
        </Text>

        {isPending ? (
          <View style={styles.card}>
            <View style={styles.inlineRow}>
              <ActivityIndicator color="#38bdf8" />
              <Text style={styles.cardCopy}>Checking the current session.</Text>
            </View>
          </View>
        ) : session ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{displayName}</Text>
            <Text style={styles.cardCopy}>{viewerProfile?.email ?? session.user.email}</Text>
            <Text style={styles.detailLabel}>Linked accounts</Text>
            <Text style={styles.cardCopy}>
              {isMetadataLoading ? 'Loading linked accounts...' : linkedProviderNames}
            </Text>
            <Text style={styles.detailLabel}>Active sessions</Text>
            <Text style={styles.cardCopy}>
              {isMetadataLoading ? 'Loading active sessions...' : `${activeSessions.length} active`}
            </Text>
            <Text style={styles.hint}>
              Email/password users should enter their password before deleting the account. Social
              users may need to sign in again if their current session is no longer fresh.
            </Text>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}

            <Pressable style={styles.primaryButton} onPress={handleSignOut} disabled={isWorking}>
              <Text style={styles.primaryButtonText}>Sign out</Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, isWorking ? styles.buttonDisabled : null]}
              onPress={handleSignOutOtherSessions}
              disabled={isWorking || activeSessions.length <= 1}
            >
              <Text style={styles.secondaryButtonText}>Sign out other sessions</Text>
            </Pressable>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setDeletePassword}
              placeholder="Current password for deletion (email accounts)"
              placeholderTextColor="#64748b"
              secureTextEntry
              style={styles.input}
              value={deletePassword}
            />

            <Pressable
              style={[styles.dangerButton, isWorking ? styles.buttonDisabled : null]}
              onPress={confirmDeleteAccount}
              disabled={isWorking}
            >
              <Text style={styles.dangerButtonText}>Delete account</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeButton, mode === 'sign-in' ? styles.modeButtonActive : null]}
                onPress={() => setMode('sign-in')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === 'sign-in' ? styles.modeButtonTextActive : null,
                  ]}
                >
                  Sign in
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, mode === 'sign-up' ? styles.modeButtonActive : null]}
                onPress={() => setMode('sign-up')}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === 'sign-up' ? styles.modeButtonTextActive : null,
                  ]}
                >
                  Create account
                </Text>
              </Pressable>
            </View>

            {mode === 'sign-up' ? (
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={setName}
                placeholder="Name"
                placeholderTextColor="#64748b"
                style={styles.input}
                value={name}
              />
            ) : null}

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#64748b"
              style={styles.input}
              value={email}
            />

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#64748b"
              secureTextEntry
              style={styles.input}
              value={password}
            />

            <Text style={styles.hint}>
              {mode === 'sign-up'
                ? 'Every auth method maps into the same app profile layer.'
                : 'Use email/password in Expo Go, or Google in a development build.'}
            </Text>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}

            <Pressable
              style={[styles.primaryButton, isWorking ? styles.buttonDisabled : null]}
              onPress={mode === 'sign-up' ? handleSignUp : handleSignIn}
              disabled={isWorking}
            >
              <Text style={styles.primaryButtonText}>
                {isWorking ? 'Working...' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.secondaryButton,
                (isWorking || isExpoGo) ? styles.buttonDisabled : null,
              ]}
              onPress={handleGoogleSignIn}
              disabled={isWorking || isExpoGo}
            >
              <Text style={styles.secondaryButtonText}>
                {isExpoGo ? 'Google sign-in needs a dev build' : 'Continue with Google'}
              </Text>
            </Pressable>

            <Text style={styles.hint}>
              Google OAuth requires a development build because Expo Go cannot use your custom app
              scheme for OAuth redirects.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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

function readableProviderName(providerId: string) {
  switch (providerId) {
    case 'credential':
      return 'Email and password';
    case 'google':
      return 'Google';
    default:
      return providerId;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 12,
  },
  brand: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
  },
  copy: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    marginTop: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 12,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  cardCopy: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  inlineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  modeButtonActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  modeButtonText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: '#020617',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  hint: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 19,
  },
  feedbackText: {
    color: '#7dd3fc',
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#38bdf8',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#020617',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerButton: {
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#7f1d1d',
    paddingVertical: 14,
  },
  dangerButtonText: {
    color: '#fee2e2',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});

import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { authClient } from '@/lib/auth-client';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedIconButton } from '@/components/ui/reed-icon-button';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useReedTheme } from '@/design/provider';

const THEME_OPTIONS = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
] as const;

export default function SettingsScreen() {
  const { data: session } = authClient.useSession();
  const { preference, setPreference, theme } = useReedTheme();
  const router = useRouter();
  const [deletePassword, setDeletePassword] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  async function runAction(action: () => Promise<void>) {
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

  async function handleSignOut() {
    await runAction(async () => {
      const result = await authClient.signOut();

      if (result.error) {
        throw result.error;
      }

      router.replace('/');
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
    await runAction(async () => {
      const result = await authClient.deleteUser({
        password: deletePassword.trim() || undefined,
      });

      if (result.error) {
        throw result.error;
      }

      router.replace('/');
    });
  }

  const themeOptions = [
    {
      accessibilityLabel: 'Use system theme',
      icon: (
        <Ionicons
          color={String(preference === 'system' ? theme.colors.pillActiveText : theme.colors.textMuted)}
          name="phone-portrait-outline"
          size={18}
        />
      ),
      value: 'system' as const,
    },
    {
      accessibilityLabel: 'Use light theme',
      icon: (
        <Ionicons
          color={String(preference === 'light' ? theme.colors.pillActiveText : theme.colors.textMuted)}
          name="sunny-outline"
          size={18}
        />
      ),
      value: 'light' as const,
    },
    {
      accessibilityLabel: 'Use dark theme',
      icon: (
        <Ionicons
          color={String(preference === 'dark' ? theme.colors.pillActiveText : theme.colors.textMuted)}
          name="moon-outline"
          size={18}
        />
      ),
      value: 'dark' as const,
    },
  ];

  return (
    <ScreenBackdrop>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.xl,
          },
        ]}
      >
        <View style={styles.header}>
          <ReedIconButton accessibilityLabel="Close settings" onPress={() => router.back()}>
            <Ionicons color={String(theme.colors.textPrimary)} name="chevron-back" size={20} />
          </ReedIconButton>
          <View style={styles.headerSpacer} />
        </View>

        <GlassSurface>
          <SegmentedControl
            compact
            iconOnly
            onChange={value => setPreference(value)}
            options={themeOptions}
            value={preference}
          />
        </GlassSurface>

        <GlassSurface>
          <View style={styles.rowHeader}>
            <Ionicons color={String(theme.colors.textMuted)} name="person-outline" size={18} />
            <ReedText variant="bodyStrong">{session?.user.email ?? 'Signed in'}</ReedText>
          </View>
          <FeedbackBlock errorMessage={errorMessage} feedback={feedback} />
          <ReedButton disabled={isWorking} label="Sign out" onPress={handleSignOut} />
        </GlassSurface>

        <GlassSurface tone="danger">
          <View style={styles.rowHeader}>
            <Ionicons color={String(theme.colors.dangerText)} name="trash-outline" size={18} />
            <ReedText tone="danger" variant="bodyStrong">
              Delete account
            </ReedText>
          </View>
          <ReedText tone="muted">
            Email/password accounts should provide the current password. Social accounts may need a
            fresh sign-in before deletion works.
          </ReedText>
          <ReedInput
            autoCapitalize="none"
            autoCorrect={false}
            label="Current password"
            onChangeText={setDeletePassword}
            placeholder="Required for email/password accounts"
            secureTextEntry
            value={deletePassword}
          />
          <ReedButton disabled={isWorking} label="Delete account" onPress={confirmDeleteAccount} variant="danger" />
        </GlassSurface>
      </ScrollView>
    </ScreenBackdrop>
  );
}

function FeedbackBlock({
  errorMessage,
  feedback,
}: {
  errorMessage: string | null;
  feedback: string | null;
}) {
  if (!errorMessage && !feedback) {
    return null;
  }

  return (
    <View style={styles.feedbackBlock}>
      {errorMessage ? <ReedText tone="danger">{errorMessage}</ReedText> : null}
      {feedback ? <ReedText tone="success">{feedback}</ReedText> : null}
    </View>
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
  content: {
    gap: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerSpacer: {
    height: 44,
    width: 44,
  },
  feedbackBlock: {
    gap: 6,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});

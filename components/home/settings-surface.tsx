import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { getGlassControlTokens } from '@/components/ui/glass-material';
import { authClient } from '@/lib/auth-client';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useReedTheme } from '@/design/provider';

export function SettingsSurface() {
  const { data: session } = authClient.useSession();
  const { preference, setPreference, theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);
  const [deletePassword, setDeletePassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  async function runAction(action: () => Promise<void>) {
    setIsWorking(true);
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
    });
  }

  const themeOptions = [
    {
      accessibilityLabel: 'Use system theme',
      label: 'System',
      icon: (
        <Ionicons
          color={String(preference === 'system' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name="phone-portrait-outline"
          size={18}
        />
      ),
      value: 'system' as const,
    },
    {
      accessibilityLabel: 'Use light theme',
      label: 'Light',
      icon: (
        <Ionicons
          color={String(preference === 'light' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name="sunny-outline"
          size={18}
        />
      ),
      value: 'light' as const,
    },
    {
      accessibilityLabel: 'Use dark theme',
      label: 'Dark',
      icon: (
        <Ionicons
          color={String(preference === 'dark' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name="moon-outline"
          size={18}
        />
      ),
      value: 'dark' as const,
    },
  ];

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xl,
          paddingBottom: 132,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBlock}>
        <View style={styles.headerCopy}>
          <ReedText variant="brand">Account</ReedText>
          <ReedText variant="display">Settings</ReedText>
        </View>
      </View>

      <GlassSurface>
        <View style={styles.sectionHeader}>
          <Ionicons color={String(theme.colors.textMuted)} name="color-palette-outline" size={18} />
          <ReedText variant="bodyStrong">Appearance</ReedText>
        </View>
        <ReedText tone="muted">Choose how Reed looks across your device.</ReedText>
        <SegmentedControl
          onChange={value => setPreference(value)}
          options={themeOptions}
          value={preference}
        />
      </GlassSurface>

      <GlassSurface>
        <View style={styles.sectionHeader}>
          <Ionicons color={String(theme.colors.textMuted)} name="person-outline" size={18} />
          <ReedText variant="bodyStrong">Account</ReedText>
        </View>
        <View
          style={[
            styles.accountEmailShell,
            {
              backgroundColor: glassControls.shellBackgroundColor,
              borderColor: glassControls.shellBorderColor,
            },
          ]}
        >
          <ReedText tone="muted" variant="caption">
            Signed in as
          </ReedText>
          <ReedText variant="bodyStrong">{session?.user.email ?? 'Signed in'}</ReedText>
        </View>
        <FeedbackBlock errorMessage={errorMessage} />
        <ReedButton disabled={isWorking} label="Sign out" onPress={handleSignOut} />
      </GlassSurface>

      <GlassSurface tone="danger">
        <View style={styles.sectionHeader}>
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
  );
}

function FeedbackBlock({
  errorMessage,
}: {
  errorMessage: string | null;
}) {
  if (!errorMessage) {
    return null;
  }

  return (
    <View style={styles.feedbackBlock}>
      {errorMessage ? <ReedText tone="danger">{errorMessage}</ReedText> : null}
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
    gap: 16,
  },
  headerBlock: {
    gap: 8,
  },
  headerCopy: {
    gap: 4,
  },
  feedbackBlock: {
    gap: 6,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  accountEmailShell: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});

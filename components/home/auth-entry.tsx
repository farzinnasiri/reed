import { ReedButton } from '@/components/ui/reed-button';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { GlassSurface } from '@/components/ui/glass-surface';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useReedTheme } from '@/design/provider';
import type { AuthMode } from './types';
import { StyleSheet, View } from 'react-native';

const AUTH_OPTIONS = [
  { label: 'Sign in', value: 'sign-in' },
  { label: 'Create account', value: 'sign-up' },
] as const;

type AuthEntryProps = {
  email: string;
  errorMessage: string | null;
  feedback: string | null;
  isExpoGo: boolean;
  isWorking: boolean;
  mode: AuthMode;
  name: string;
  onChangeEmail: (value: string) => void;
  onChangeMode: (mode: AuthMode) => void;
  onChangeName: (value: string) => void;
  onChangePassword: (value: string) => void;
  onGoogleSignIn: () => void;
  onSubmit: () => void;
  password: string;
};

export function AuthEntry({
  email,
  errorMessage,
  feedback,
  isExpoGo,
  isWorking,
  mode,
  name,
  onChangeEmail,
  onChangeMode,
  onChangeName,
  onChangePassword,
  onGoogleSignIn,
  onSubmit,
  password,
}: AuthEntryProps) {
  const { theme } = useReedTheme();

  return (
    <View style={styles.authShell}>
      <View style={styles.authMark}>
        <ReedText style={styles.brandWordmark} variant="bodyStrong">
          REED
        </ReedText>
      </View>

      <GlassSurface>
        <SegmentedControl<AuthMode>
          onChange={onChangeMode}
          options={AUTH_OPTIONS as unknown as { label: string; value: AuthMode }[]}
          value={mode}
        />

        {mode === 'sign-up' ? (
          <ReedInput
            autoCapitalize="words"
            autoCorrect={false}
            label="Name"
            onChangeText={onChangeName}
            placeholder="Your name"
            value={name}
          />
        ) : null}

        <ReedInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          label="Email"
          onChangeText={onChangeEmail}
          placeholder="name@example.com"
          value={email}
        />

        <ReedInput
          autoCapitalize="none"
          autoCorrect={false}
          label="Password"
          onChangeText={onChangePassword}
          placeholder="At least 8 characters"
          secureTextEntry
          value={password}
        />

        <FeedbackBlock errorMessage={errorMessage} feedback={feedback} />

        <ReedButton
          disabled={isWorking}
          label={isWorking ? 'Working...' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
          onPress={onSubmit}
        />
        <ReedButton
          disabled={isWorking || isExpoGo}
          label={isExpoGo ? 'Google needs a dev build' : 'Continue with Google'}
          onPress={onGoogleSignIn}
          variant="secondary"
        />
      </GlassSurface>

      <ReedText
        style={[styles.authFootnote, { color: theme.colors.textMuted }]}
        variant="caption"
      >
        Google stays for development builds. Email and password remain the fast path in Expo Go.
      </ReedText>
    </View>
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

const styles = StyleSheet.create({
  authShell: {
    gap: 16,
    justifyContent: 'center',
  },
  authMark: {
    alignItems: 'center',
    marginBottom: 8,
  },
  authFootnote: {
    textAlign: 'center',
  },
  brandWordmark: {
    letterSpacing: 3.2,
  },
  feedbackBlock: {
    gap: 6,
  },
});

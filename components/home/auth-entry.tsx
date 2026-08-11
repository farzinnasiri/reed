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
  isAwaitingVerification: boolean;
  isWorking: boolean;
  mode: AuthMode;
  onChangeEmail: (value: string) => void;
  onChangeMode: (mode: AuthMode) => void;
  onChangePassword: (value: string) => void;
  onChangeVerificationCode: (value: string) => void;
  onGoogleSignIn: () => void;
  onSubmit: () => void;
  password: string;
  verificationCode: string;
};

export function AuthEntry({
  email,
  errorMessage,
  feedback,
  isAwaitingVerification,
  isWorking,
  mode,
  onChangeEmail,
  onChangeMode,
  onChangePassword,
  onChangeVerificationCode,
  onGoogleSignIn,
  onSubmit,
  password,
  verificationCode,
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
        {isAwaitingVerification ? (
          <ReedInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            label="Verification code"
            onChangeText={onChangeVerificationCode}
            placeholder="Enter the code from your email"
            value={verificationCode}
          />
        ) : (
          <>
            <SegmentedControl<AuthMode>
              onChange={onChangeMode}
              options={AUTH_OPTIONS as unknown as { label: string; value: AuthMode }[]}
              value={mode}
            />

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
              placeholder="At least 15 characters"
              secureTextEntry
              value={password}
            />
          </>
        )}

        {mode === 'sign-up' ? <View nativeID="clerk-captcha" /> : null}

        <FeedbackBlock errorMessage={errorMessage} feedback={feedback} />

        <ReedButton
          disabled={isWorking}
          label={isWorking ? 'Working...' : isAwaitingVerification ? 'Verify email' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
          onPress={onSubmit}
        />
        {!isAwaitingVerification ? (
          <ReedButton
            disabled={isWorking}
            label="Continue with Google"
            onPress={onGoogleSignIn}
            variant="secondary"
          />
        ) : null}
      </GlassSurface>

      <ReedText
        style={[styles.authFootnote, { color: theme.colors.textMuted }]}
        variant="caption"
      >
        One Reed account works across mobile and web.
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

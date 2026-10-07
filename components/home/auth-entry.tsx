import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedIconButton } from '@/components/ui/reed-icon-button';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { ReedMascot } from '@/components/reed/mascot';
import { useReedTheme } from '@/design/provider';
import { reedAuthMetrics } from '@/design/system';
import type { AuthEntryController } from './use-auth-entry';

export function AuthEntry({ controller: { state, actions }, onBack }: { controller: AuthEntryController; onBack: () => void }) {
  const { theme } = useReedTheme();
  const { height } = useWindowDimensions();
  const [showPassword, setShowPassword] = useState(false);
  const { mode, stage, email, password, code, error, feedback, working } = state;
  const credentials = stage === 'credentials';
  const verification = stage === 'verification' || stage === 'recovery-code';
  const recovery = stage.startsWith('recovery');
  const signup = mode === 'sign-up';
  const title = stage === 'recovery-email' ? 'Forgot your password?'
    : stage === 'recovery-password' ? 'A fresh start.'
      : verification ? 'Check your email.' : signup ? 'Meet your coach.' : 'Welcome back.';
  const subtitle = stage === 'recovery-email' ? 'I’ll send you a code to reset it.'
    : stage === 'recovery-password' ? 'Choose a new password. At least 12 characters.'
      : verification ? 'Enter the code to continue.' : signup ? 'One account for everything you do.' : 'Your corner is right here.';
  const submitLabel = stage === 'recovery-email' ? 'Send reset code'
    : stage === 'recovery-password' ? 'Set new password' : verification ? 'Verify code' : signup ? 'Create account' : 'Sign in';
  const spacing = theme.spacing;

  return <View style={[styles.shell, { gap: spacing.lg }]}>
    <View style={styles.back}>
      <ReedIconButton accessibilityLabel={credentials ? 'Back to welcome' : 'Back to sign in'} variant="ghost" disabled={working}
        onPress={() => credentials ? onBack() : void actions.changeMode('sign-in')}>
        <Ionicons name="arrow-back" size={22} color={theme.colors.inkSecondary} />
      </ReedIconButton>
    </View>
    <View style={[styles.heading, { gap: spacing.sm }]}>
      <ReedMascot expression={working ? 'thinking' : error ? 'concerned' : 'happy'}
        size={height < reedAuthMetrics.compactHeight ? reedAuthMetrics.compactMascot : reedAuthMetrics.mascot} />
      <ReedText variant="display" style={styles.center}>{title}</ReedText>
      <ReedText tone="secondary" style={styles.center}>{subtitle}</ReedText>
    </View>
    {credentials ? <>
      <View style={{ gap: spacing.sm }}>
        <ReedButton accessibilityLabel="Continue with Apple" label="Continue with Apple" variant="secondary" disabled={working}
          leading={<Ionicons name="logo-apple" size={20} color={theme.colors.ink} />}
          onPress={() => void actions.social('apple')} />
        <ReedButton accessibilityLabel="Continue with Google" label="Continue with Google" variant="secondary" disabled={working}
          leading={<Ionicons name="logo-google" size={19} color={theme.colors.ink} />}
          onPress={() => void actions.social('google')} />
      </View>
      <View style={[styles.divider, { gap: spacing.md }]}>
        <View style={[styles.rule, { backgroundColor: theme.colors.line }]} />
        <ReedText variant="caption" tone="muted">or with email</ReedText>
        <View style={[styles.rule, { backgroundColor: theme.colors.line }]} />
      </View>
    </> : null}
    <View style={{ gap: spacing.md }}>
      {credentials || stage === 'recovery-email' ? <ReedInput label="Email" value={email} editable={!working}
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
        placeholder="you@example.com" onChangeText={actions.setEmail}
        onSubmitEditing={stage === 'recovery-email' ? () => void actions.submit() : undefined} /> : null}
      {verification ? <ReedInput label="Email code" value={code} editable={!working}
        autoCapitalize="none" autoCorrect={false} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode"
        maxLength={6} placeholder="6-digit code" onChangeText={actions.setCode} onSubmitEditing={() => void actions.submit()} /> : null}
      {credentials || stage === 'recovery-password' ? <View>
        <ReedInput label={recovery ? 'New password' : 'Password'} value={password} editable={!working}
          autoCapitalize="none" autoCorrect={false} secureTextEntry={!showPassword}
          autoComplete={signup || recovery ? 'new-password' : 'current-password'} textContentType={signup || recovery ? 'newPassword' : 'password'}
          placeholder={signup || recovery ? 'At least 12 characters' : 'Your password'}
          style={{ paddingRight: 56 }} onChangeText={actions.setPassword} onSubmitEditing={() => void actions.submit()} />
        <View style={styles.visibility}>
          <ReedIconButton variant="ghost" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            onPress={() => setShowPassword(value => !value)}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.inkMuted} />
          </ReedIconButton>
        </View>
      </View> : null}
      {credentials && !signup ? <View style={styles.right}>
        <ReedButton label="Forgot password?" variant="quiet" disabled={working} onPress={() => void actions.recover()} />
      </View> : null}
      {signup ? <View nativeID="clerk-captcha" /> : null}
      {error || feedback ? <View accessibilityLiveRegion="polite">
        <ReedText tone={error ? 'danger' : 'secondary'} variant="caption">{error ?? feedback}</ReedText>
      </View> : null}
      <ReedButton label={working ? 'One moment…' : submitLabel} disabled={working} onPress={() => void actions.submit()} />
      {verification ? <ReedButton label="Send a new code" variant="quiet" disabled={working} onPress={() => void actions.resend()} /> : null}
    </View>
    <View style={[styles.switch, { gap: spacing.xxs }]}>
      <ReedText tone="muted" variant="caption">{credentials ? signup ? 'Already have an account?' : 'New to Reed?' : 'Remember your password?'}</ReedText>
      <ReedButton label={credentials && !signup ? 'Create account' : 'Sign in'} variant="ghost" disabled={working}
        onPress={() => void actions.changeMode(credentials && !signup ? 'sign-up' : 'sign-in')} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  shell: { width: '100%', maxWidth: reedAuthMetrics.maxWidth, alignSelf: 'center' },
  back: { position: 'absolute', top: 0, left: 0, zIndex: 1 },
  heading: { alignItems: 'center' },
  center: { textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center' },
  rule: { flex: 1, height: 1 },
  visibility: { position: 'absolute', right: 6, bottom: 6 },
  right: { alignItems: 'flex-end' },
  switch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
});

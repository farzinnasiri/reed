import { useEffect, useRef, useState } from 'react';
import { useAuth, useClerk, useSignIn, useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { BootSplash } from '@/components/launch/boot-splash';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { authErrorMessage, finishSocialRedirect } from '@/components/home/auth-flow';
import { useReedTheme } from '@/design/provider';

export default function SsoCallback() {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useReedTheme();

  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;
    if (isSignedIn) {
      router.replace('/');
      return;
    }
    void finishSocialRedirect(signIn, signUp, session => clerk.setActive({ session }))
      .then(result => router.replace(result === 'verification' ? '/?auth=verify' : '/'))
      .catch(failure => setError(authErrorMessage(failure)));
  }, [clerk, isLoaded, isSignedIn, router, signIn, signUp]);

  if (!error) return <BootSplash />;
  return <View style={[styles.error, { gap: theme.spacing.lg, padding: theme.spacing.xl, backgroundColor: theme.colors.canvas }]}>
    <ReedText variant="title">Let’s try that again.</ReedText>
    <ReedText tone="secondary">{error}</ReedText>
    <ReedButton label="Back to Reed" onPress={() => router.replace('/')} />
  </View>;
}
const styles = StyleSheet.create({ error: { flex: 1, justifyContent: 'center' } });

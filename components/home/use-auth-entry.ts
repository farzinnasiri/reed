import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSignIn, useSignUp } from '@clerk/expo';
import { useSSO } from '@clerk/expo/experimental';
import { analytics } from '@/lib/analytics';
import type { AuthMode } from './types';
import { authErrorMessage, finishEmailSignIn, sendRecoveryCode, type AuthStage } from './auth-flow';

export function useAuthEntry(initialStage: AuthStage = 'credentials') {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [stage, setStage] = useState<AuthStage>(initialStage);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setError(null);
    setFeedback(null);
    try { await action(); }
    catch (failure) { setError(authErrorMessage(failure)); }
    finally { inFlight.current = false; setWorking(false); }
  }

  async function changeMode(nextMode: AuthMode, nextStage: AuthStage = 'credentials') {
    await run(async () => {
      const resetIn = await signIn.reset();
      if (resetIn.error) throw resetIn.error;
      const resetUp = await signUp.reset();
      if (resetUp.error) throw resetUp.error;
      setMode(nextMode);
      setStage(nextStage);
      setPassword('');
      setCode('');
    });
  }

  async function completeSignIn() {
    const next = await finishEmailSignIn(signIn);
    if (next === 'verification') {
      setStage('verification');
      setCode('');
      setFeedback('Check your email for a sign-in code.');
    } else {
      analytics.userSignedIn({ method: 'email' });
      setPassword('');
      setCode('');
    }
  }

  async function submit() {
    await run(async () => {
      if ((stage === 'credentials' || stage === 'recovery-email') && !email.trim()) throw new Error('Enter your email address.');
      if ((stage === 'credentials' || stage === 'recovery-password') && !password) throw new Error('Enter your password.');
      if ((stage === 'recovery-password' || (stage === 'credentials' && mode === 'sign-up')) && password.length < 12) throw new Error('Use at least 12 characters for your password.');
      if ((stage === 'verification' || stage === 'recovery-code') && !code.trim()) throw new Error('Enter the code from your email.');

      if (stage === 'recovery-email') {
        await sendRecoveryCode(signIn, email);
        setStage('recovery-code');
        setFeedback('Check your email for a password reset code.');
      } else if (stage === 'recovery-code') {
        const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
        if (error) throw error;
        if (signIn.status !== 'needs_new_password') throw new Error('The reset code could not be verified.');
        setCode('');
        setStage('recovery-password');
      } else if (stage === 'recovery-password') {
        const { error } = await signIn.resetPasswordEmailCode.submitPassword({ password, signOutOfOtherSessions: true });
        if (error) throw error;
        await completeSignIn();
      } else if (stage === 'verification') {
        if (mode === 'sign-up') {
          const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
          if (error) throw error;
          if (signUp.status !== 'complete') throw new Error('Account verification is not complete.');
          const finalized = await signUp.finalize();
          if (finalized.error) throw finalized.error;
          analytics.userSignedUp();
          setPassword('');
          setCode('');
        } else {
          const { error } = await signIn.mfa.verifyEmailCode({ code: code.trim() });
          if (error) throw error;
          await completeSignIn();
        }
      } else if (mode === 'sign-up') {
        const { error } = await signUp.password({ emailAddress: email.trim().toLowerCase(), password });
        if (error) throw error;
        if (signUp.status === 'complete') {
          const finalized = await signUp.finalize();
          if (finalized.error) throw finalized.error;
          analytics.userSignedUp();
          setPassword('');
        } else {
          const verification = await signUp.verifications.sendEmailCode();
          if (verification.error) throw verification.error;
          setStage('verification');
          setFeedback('Check your email for a verification code.');
        }
      } else {
        const { error } = await signIn.password({ emailAddress: email.trim().toLowerCase(), password });
        if (error) throw error;
        await completeSignIn();
      }
    });
  }

  async function resend() {
    await run(async () => {
      const result = stage === 'recovery-code' ? await signIn.resetPasswordEmailCode.sendCode()
        : mode === 'sign-up' ? await signUp.verifications.sendEmailCode() : await signIn.mfa.sendEmailCode();
      if (result.error) throw result.error;
      setFeedback('A new code is on its way.');
    });
  }

  async function social(provider: 'apple' | 'google') {
    await run(async () => {
      if (Platform.OS === 'web') {
        // A full-page redirect has no popup or browser user-activation deadline.
        const { error } = await signIn.sso({
          strategy: provider === 'apple' ? 'oauth_apple' : 'oauth_google',
          redirectUrl: '/sso-callback',
          redirectCallbackUrl: '/sso-callback',
        });
        if (error) throw error;
        return;
      }
      // The installed experimental hook finalizes and activates native sessions itself.
      const result = await startSSOFlow({ strategy: provider === 'apple' ? 'oauth_apple' : 'oauth_google' });
      if (result.createdSessionId || result.signIn?.existingSession) analytics.userSignedIn({ method: provider });
      else if (result.authSessionResult?.type === 'success') throw new Error('Sign-in could not be completed. Please try again.');
    });
  }

  return {
    state: { mode, stage, email, password, code, error, feedback, working },
    actions: { setEmail, setPassword, setCode, changeMode, submit, resend, social,
      recover: () => changeMode('sign-in', 'recovery-email') },
  };
}
export type AuthEntryController = ReturnType<typeof useAuthEntry>;

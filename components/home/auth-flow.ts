import type { SignInFutureResource, SignUpFutureResource } from '@clerk/shared/types';

export type AuthStage = 'credentials' | 'verification' | 'recovery-email' | 'recovery-code' | 'recovery-password';

/** Shared completion path for password sign-in and recovery, including Device Trust. */
export async function finishEmailSignIn(signIn: SignInFutureResource): Promise<'complete' | 'verification'> {
  if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
    if (!signIn.supportedSecondFactors?.some(factor => factor.strategy === 'email_code')) {
      throw new Error('This account needs a verification method Reed cannot use.');
    }
    const { error } = await signIn.mfa.sendEmailCode();
    if (error) throw error;
    return 'verification';
  }
  if (signIn.status !== 'complete') throw new Error('Sign-in is not complete. Please try again.');
  const { error } = await signIn.finalize();
  if (error) throw error;
  return 'complete';
}

export async function sendRecoveryCode(signIn: SignInFutureResource, email: string) {
  const { error: createError } = await signIn.create({ identifier: email.trim().toLowerCase() });
  if (createError) throw createError;
  const { error } = await signIn.resetPasswordEmailCode.sendCode();
  if (error) throw error;
}

export function authErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { message?: string; longMessage?: string; errors?: { longMessage?: string; message?: string }[] };
    return candidate.errors?.[0]?.longMessage ?? candidate.errors?.[0]?.message
      ?? candidate.longMessage ?? candidate.message ?? 'Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

/** Finish a full-page OAuth return using Clerk's current resources. */
export async function finishSocialRedirect(
  signIn: SignInFutureResource,
  signUp: SignUpFutureResource,
  activateExisting: (sessionId: string) => Promise<unknown>,
): Promise<'complete' | 'verification'> {
  if (signUp.isTransferable) {
    const { error } = await signIn.create({ transfer: true });
    if (error) throw error;
  } else if (signIn.isTransferable) {
    const { error } = await signUp.create({ transfer: true });
    if (error) throw error;
  }
  if (signIn.status === 'complete') return finishEmailSignIn(signIn);
  if (signUp.status === 'complete') {
    const { error } = await signUp.finalize();
    if (error) throw error;
    return 'complete';
  }
  const existing = signIn.existingSession ?? signUp.existingSession;
  if (existing) {
    await activateExisting(existing.sessionId);
    return 'complete';
  }
  if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
    return finishEmailSignIn(signIn);
  }
  throw new Error('Sign-in could not be completed. Please return and try another sign-in method.');
}

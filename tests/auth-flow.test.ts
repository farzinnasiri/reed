import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SignInFutureResource } from '@clerk/shared/types';
import { finishEmailSignIn, sendRecoveryCode } from '../components/home/auth-flow';

function resource(status: SignInFutureResource['status'], calls: string[]) {
  return {
    status, supportedSecondFactors: [{ strategy: 'email_code' }],
    create: async ({ identifier }: { identifier: string }) => { calls.push(`create:${identifier}`); return { error: null }; },
    resetPasswordEmailCode: { sendCode: async () => { calls.push('reset-code'); return { error: null }; } },
    mfa: { sendEmailCode: async () => { calls.push('trust-code'); return { error: null }; } },
    finalize: async () => { calls.push('finalize'); return { error: null }; },
  } as unknown as SignInFutureResource;
}
test('recovery identifies the account before sending a reset code', async () => {
  const calls: string[] = [];
  await sendRecoveryCode(resource('needs_identifier', calls), ' Person@Example.com ');
  assert.deepEqual(calls, ['create:person@example.com', 'reset-code']);
});
test('recovery stops if Clerk rejects the identifier', async () => {
  const calls: string[] = [];
  const signIn = resource('needs_identifier', calls);
  signIn.create = async () => { throw new Error('unknown account'); };
  await assert.rejects(sendRecoveryCode(signIn, 'person@example.com'), /unknown account/);
  assert.deepEqual(calls, []);
});
for (const status of ['needs_client_trust', 'needs_second_factor'] as const) {
  test(`${status} sends verification and never finalizes prematurely`, async () => {
    const calls: string[] = [];
    assert.equal(await finishEmailSignIn(resource(status, calls)), 'verification');
    assert.deepEqual(calls, ['trust-code']);
  });
}
test('an unsupported second factor cannot silently activate a session', async () => {
  const calls: string[] = [];
  const signIn = { ...resource('needs_second_factor', calls), supportedSecondFactors: [] };
  await assert.rejects(finishEmailSignIn(signIn), /verification method/);
  assert.deepEqual(calls, []);
});
test('only complete sign-ins finalize', async () => {
  const calls: string[] = [];
  await assert.rejects(finishEmailSignIn(resource('needs_new_password', calls)), /not complete/);
  assert.equal(await finishEmailSignIn(resource('complete', calls)), 'complete');
  assert.deepEqual(calls, ['finalize']);
});
test('a failed finalize remains an error', async () => {
  const signIn = resource('complete', []);
  signIn.finalize = async () => { throw new Error('session activation failed'); };
  await assert.rejects(finishEmailSignIn(signIn), /activation failed/);
});

test('OAuth callback finalizes an existing sign-in', async () => {
  const calls: string[] = [];
  const { finishSocialRedirect } = await import('../components/home/auth-flow');
  const { signUp } = socialFixture(calls);
  assert.equal(await finishSocialRedirect(resource('complete', calls), signUp, async () => {}), 'complete');
  assert.deepEqual(calls, ['finalize']);
});
test('OAuth callback transfers a new social identity into sign-up', async () => {
  const calls: string[] = [];
  const { finishSocialRedirect } = await import('../components/home/auth-flow');
  const { signUp } = socialFixture(calls);
  const signIn = { ...resource('needs_first_factor', calls), isTransferable: true };
  assert.equal(await finishSocialRedirect(signIn, signUp, async () => {}), 'complete');
  assert.deepEqual(calls, ['transfer', 'finalize-up']);
});
test('OAuth callback preserves Device Trust instead of prematurely signing in', async () => {
  const calls: string[] = [];
  const { finishSocialRedirect } = await import('../components/home/auth-flow');
  const { signUp } = socialFixture(calls);
  assert.equal(await finishSocialRedirect(resource('needs_client_trust', calls), signUp, async () => {}), 'verification');
  assert.deepEqual(calls, ['trust-code']);
});
test('OAuth callback activates a previously existing session', async () => {
  const calls: string[] = [];
  const { finishSocialRedirect } = await import('../components/home/auth-flow');
  const { signUp } = socialFixture(calls);
  const signIn = { ...resource('needs_identifier', calls), existingSession: { sessionId: 'session_existing' } } as unknown as SignInFutureResource;
  assert.equal(await finishSocialRedirect(signIn, signUp, async id => { calls.push(id); }), 'complete');
  assert.deepEqual(calls, ['session_existing']);
});
test('incomplete OAuth callback fails without activating anything', async () => {
  const calls: string[] = [];
  const { finishSocialRedirect } = await import('../components/home/auth-flow');
  const { signUp } = socialFixture(calls);
  await assert.rejects(finishSocialRedirect(resource('needs_identifier', calls), signUp, async () => {}), /could not be completed/);
  assert.deepEqual(calls, []);
});
function socialFixture(calls: string[]) {
  let status: 'complete' | null = null;
  return { signUp: {
    get status() { return status; },
    isTransferable: false,
    create: async ({ transfer }: { transfer: boolean }) => { assert.equal(transfer, true); calls.push('transfer'); status = 'complete'; return { error: null }; },
    finalize: async () => { calls.push('finalize-up'); return { error: null }; },
  } as unknown as import('@clerk/shared/types').SignUpFutureResource };
}

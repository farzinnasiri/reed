// Convex generates the `_generated` types after `npx convex dev` or `npm run convex:codegen`.
// Until then, keep this file out of the root app typecheck and use it as server plumbing only.
import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { expo } from '@better-auth/expo';
import { components } from './_generated/api';
import { internal } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import authConfig from './auth.config';
import { getAuthBaseURL, getTrustedOrigin } from './auth_support';

export const authComponent = createClient<DataModel>(components.betterAuth);

export function createAuth(ctx: GenericCtx<DataModel>) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    baseURL: getAuthBaseURL(),
    trustedOrigins: [getTrustedOrigin()],
    database: authComponent.adapter(ctx),
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
        enabled: true,
        trustedProviders: ['google', 'apple'],
        updateUserInfoOnLink: true,
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      freshAge: 60 * 15,
      updateAge: 60 * 60 * 24,
    },
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
              prompt: 'select_account',
            },
          }
        : undefined,
    user: {
      deleteUser: {
        afterDelete: async user => {
          if ('runMutation' in ctx) {
            await ctx.runMutation(internal.profiles.deleteByAuthUserId, {
              authUserId: user.id,
            });
          }
        },
        enabled: true,
      },
    },
    plugins: [expo(), convex({ authConfig })],
  } satisfies BetterAuthOptions);
}

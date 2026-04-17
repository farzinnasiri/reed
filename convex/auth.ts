// Convex generates the `_generated` types after `npx convex dev` or `npm run convex:codegen`.
// Until then, keep this file out of the root app typecheck and use it as server plumbing only.
import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { expo } from '@better-auth/expo';
import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import { query } from './_generated/server';
import authConfig from './auth.config';

export const authComponent = createClient<DataModel>(components.betterAuth);

export function createAuth(ctx: GenericCtx<DataModel>) {
  const trustedOrigin = process.env.EXPO_PUBLIC_APP_SCHEME ?? 'reed://';

  return betterAuth({
    baseURL: process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
    trustedOrigins: [trustedOrigin],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        prompt: 'select_account',
      },
    },
    plugins: [expo(), convex({ authConfig })],
  } satisfies BetterAuthOptions);
}

export const getCurrentUser = query({
  args: {},
  handler: async ctx => authComponent.getAuthUser(ctx),
});

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { config } from 'dotenv';

// Expo's public values must be present before Metro bundles JS, not only in app.config.ts.
// Vercel/CI always use their injected values; local builds may select a project env file.
if (!process.env.CI && !process.env.VERCEL) {
  // Match Expo's local base config, then the selected development/production override.
  if (existsSync('.env.local')) config({ path: '.env.local', override: false, quiet: true });
  const path = process.env.REED_ENV_FILE;
  if (path && existsSync(path)) config({ path, override: true, quiet: true });
}
const required = ['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', 'EXPO_PUBLIC_CONVEX_URL', 'EXPO_PUBLIC_CONVEX_SITE_URL'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) throw new Error(`Missing web build variables: ${missing.join(', ')}`);
if (process.env.VERCEL_ENV === 'production' && !process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_live_')) {
  throw new Error('Production web deployments require the production Clerk instance.');
}
const result = spawnSync('npx', ['expo', 'export', '--platform', 'web'], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_NO_DOTENV: '1' },
});
process.exit(result.status ?? 1);

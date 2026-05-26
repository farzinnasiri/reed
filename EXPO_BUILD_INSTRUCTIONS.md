# Expo Build Instructions

Use the Makefile targets. They load the correct env file and sync the public Convex URLs to EAS before starting the build.

## Android Build Commands

Development-client APK for testing native/dev-client behavior:

```sh
make android-dev-client
```

Regular arm64 APK against the dev backend:

```sh
make android-arm-dev
```

Regular arm64 APK against the production backend:

```sh
make android-arm-prod
```

Play Store style production bundle:

```sh
npx eas-cli build -p android -e production
```

The Makefile targets load the matching `.env.*` file and sync `EXPO_PUBLIC_CONVEX_URL` plus `EXPO_PUBLIC_CONVEX_SITE_URL` into EAS before submitting the build.

## Testing A Development Build

After installing it on the phone, start Metro with:

```sh
make expo ENV=dev
```

Use this when Metro cache needs clearing:

```sh
make expo-clean ENV=dev
```

## Before Building

Run this if dependencies changed:

```sh
npx -p npm@10.9.3 npm ci --include=dev
```

EAS Android currently uses npm 10. If this fails because the lockfile is stale, fix it with:

```sh
npx -p npm@10.9.3 npm install --package-lock-only
npx -p npm@10.9.3 npm ci --include=dev
```

## Repo-Specific Pitfalls

- Do not use SVG files for Android splash images in `app.config.ts`; use PNG, for example `./assets/images/splash-icon.png`.
- Do not print or commit `.env.*` files.
- If a build fails, inspect the EAS log before changing code:

```sh
npx eas-cli build:view <build-id> --json
```

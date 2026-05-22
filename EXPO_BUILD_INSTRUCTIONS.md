# Expo Build Instructions

Use the Makefile targets. They load the correct env file and sync the public Convex URLs to EAS before starting the build.

## Android Development Build

```sh
make android-dev-client
```

This creates an Android development-client APK from `.env.dev`.

After installing it on the phone, start Metro with:

```sh
make expo ENV=dev
```

Use this when Metro cache needs clearing:

```sh
make expo-clean ENV=dev
```

## Regular Android Builds

Use these when you want an installable APK that does not depend on the development client runtime. The Makefile APK targets are arm64-only for S22 Ultra style devices instead of universal APKs.

```sh
make android-arm-dev
make android-arm-prod
```

`android-arm-dev` builds against `.env.dev`. `android-arm-prod` builds against `.env.prod`.

For a Play Store style production bundle, use the EAS production profile directly:

```sh
npx eas-cli build -p android -e production
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

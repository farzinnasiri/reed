# reed

Greenfield Expo + TypeScript + Expo Router + Convex baseline for the Android app.

## Project layout

- `app/`: minimal Expo Router shell
- `lib/`: app-side Convex and auth client wiring
- `convex/`: backend schema, auth config, and Better Auth plumbing
- `legacy/`: preserved static HTML/CSS/JS prototype

## Local setup

1. Create two local env files:

```bash
cp .env.dev.example .env.dev
cp .env.prod.example .env.prod
```

2. Fill in the public Expo values in each file:
   - `EXPO_PUBLIC_CONVEX_URL`
   - `EXPO_PUBLIC_CONVEX_SITE_URL`
3. Fill in the Better Auth / Google server values in each file:
   - `BETTER_AUTH_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
4. Install dependencies:

```bash
make install
```

5. For development, configure or refresh the dev deployment:

```bash
make convex-dev
```

This uses `.env.dev`. On the first run it logs you into Convex if needed, links the repo to a dev deployment, and generates `convex/_generated`.

6. Push server auth vars into the right Convex deployment:

```bash
make convex-env-push ENV=dev
make convex-env-push ENV=prod
```

7. If you changed backend code or env after that, regenerate types as needed:

```bash
make convex-codegen ENV=dev
```

8. Start the Expo app against the dev backend:

```bash
make expo ENV=dev
```

9. Deploy the Convex backend to production when you are ready:

```bash
make convex-deploy
```

## Notes

- The Expo app shows a clear missing-env state until the required public env vars exist.
- Email/password auth is available in Expo Go.
- Google OAuth requires a development build on device. Expo Go cannot test OAuth redirects that rely on the app scheme.
- Better Auth on Convex uses the deployment site URL callback path for Google: `https://<deployment>.convex.site/api/auth/callback/google`.
- Email verification is intentionally disabled for now to keep local iteration simple.
- `.env.dev` is for local development and Expo Go against the dev Convex deployment.
- `.env.prod` is for production deploys and production app builds.
- `convex dev` always targets the dev deployment. `convex deploy` targets production by default.
- `convex/_generated` is created by Convex and is intentionally gitignored.

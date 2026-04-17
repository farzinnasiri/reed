# reed

Greenfield Expo + TypeScript + Expo Router + Convex baseline for the Android app.

## Project layout

- `app/`: minimal Expo Router shell
- `lib/`: app-side Convex and auth client wiring
- `convex/`: backend schema, auth config, and Better Auth plumbing
- `legacy/`: preserved static HTML/CSS/JS prototype

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in the public Expo values:
   - `EXPO_PUBLIC_CONVEX_URL`
   - `EXPO_PUBLIC_CONVEX_SITE_URL`
   - `EXPO_PUBLIC_APP_SCHEME`
3. Fill in the Better Auth / Google server values:
   - `BETTER_AUTH_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
4. Install dependencies:

```bash
npm install
```

5. Generate Convex code and configure a deployment:

```bash
npm run convex:dev
```

6. Start the Expo app:

```bash
npm run android
```

## Notes

- The Expo app shows a clear missing-env state until the required public env vars exist.
- Auth plumbing is installed, but sign-in UI is intentionally not built yet.
- `convex/_generated` is created by Convex and is intentionally gitignored.

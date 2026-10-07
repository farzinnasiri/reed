# Reed

Expo, Expo Router, Clerk, and Convex app. Clerk manages sign-in; Convex owns app data and verifies Clerk's `convex` JWT. Development and production use separate Clerk instances, Convex deployments, and EAS environments.

The app uses Expo SDK 57 (`expo ~57.0.27`), React Native 0.86.3 and the SDK-matched Reanimated/Worklets packages. Use Expo Go for SDK 57 for native previews; restart Metro after changing SDK versions. Browser development remains `make dev`.

## Development setup

1. Create `.env.dev` from the local example. Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to the development Clerk instance's `pk_test_...` key, and set `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CONVEX_SITE_URL` to the development Convex deployment. Set `CLERK_JWT_ISSUER_DOMAIN` to that Clerk instance's Frontend API URL, including `https://`.
2. In the Clerk development instance, enable email/password, email-code verification, and Apple and Google under Social connections. Set the password minimum to 12 characters. Create a JWT template named `convex` with audience `convex`. Allowlist `reed-dev://sso-callback` and `reed-development://sso-callback` for mobile SSO, and `https://reed.localhost/sso-callback` for browser SSO. These are already configured in the current Reed development instance.
3. Run `npm install`, then `make convex-env-push ENV=dev` and `make convex-dev`. The first command sets the Convex deployment's Clerk issuer; the second deploys the matching auth config and generates `convex/_generated`.
4. Run `make dev` for the browser at `https://reed.localhost`, or `make expo ENV=dev` for native development. Use `make android-arm-dev` for an installable Android app connected to the development backend. Google browser SSO on a device needs a development or installable build with Reed's app scheme; Expo Go is not a reliable OAuth callback test.

Reed's sign-in and sign-up forms use Clerk custom flows. A test email address in Clerk may require a `424242` verification code and, on subsequent sign-ins, an additional client-trust email code. Convex mutations must wait until Clerk's token has authenticated with Convex.

## Production preparation

Production Clerk is not active yet. Before building a production release:

1. Create a Clerk production instance with a production domain. Enable the same sign-in methods and 12-character password minimum, configure Apple and Google with your own production credentials, create its own `convex` JWT template with audience `convex`, and allowlist `reed://sso-callback`. Register the production Android package and iOS bundle identifier in Clerk's Native applications settings as needed.
2. Set `.env.prod` with that instance's `pk_live_...` publishable key, its Frontend API URL as `CLERK_JWT_ISSUER_DOMAIN`, and the production Convex URLs. Keep the Clerk secret key out of the app bundle. This client does not need it.
3. Run `make convex-deploy` only when activating the production deployment. It pushes the production Clerk issuer to Convex before deploying the auth config. `make android-arm-prod` syncs the production public values to the EAS production environment and builds the installable Android app. It rejects a development Clerk key.

Do not point a production build at the development Clerk instance or reuse the development Convex issuer. The `convex` JWT audience and issuer must match in the Clerk instance, Convex deployment, and app build.

`convex/_generated` is deployment-generated and intentionally gitignored. No environment files or credentials belong in git.

The final coach reply uses OpenRouter with live database settings. See [coach models and settings](docs/ai-models.md) for model switching, reasoning, provider routing, and development setup.

## Frontend boundaries

The root Expo app is the sole product client on Android, iOS and web. Run `make dev` for Expo Web at `https://reed.localhost`. `control-panel/` remains a separate local administration tool. All product clients use Clerk sessions and the same Convex APIs; there is no web-specific application backend.

Generate bindings against the configured development deployment before typechecking a fresh checkout. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:convex` at the root. The Convex suite runs ownership and persistence checks in an isolated test database.

## Vercel and PWA

The hosted development app is [reed-web.vercel.app](https://reed-web.vercel.app). Its `/sso-callback` URL and the local browser callback are allowlisted in the development Clerk instance. After publishing a replacement development deployment, point this alias at it with `vercel alias set <deployment-url> reed-web.vercel.app`.

`vercel.json` builds the root Expo app with `npm run web:build` and serves the static `dist/` output with clean URLs. Use the repository root as the Vercel Root Directory and choose the Other framework preset. Every real route, including `/sso-callback`, is exported as HTML; do not add a blanket rewrite that intercepts assets or callbacks.

Configure Vercel Preview/Development with the development values, and Production with their production counterparts:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_CONVEX_URL`
- `EXPO_PUBLIC_CONVEX_SITE_URL`
- `CONVEX_DEPLOY_KEY`: a secret deploy key for the matching existing Convex deployment, used only to generate ignored bindings during cloud installation. Use a deployment key, not a Convex preview-project key. Codegen does not activate backend changes.

For a real production cut, also set `REED_APP_VARIANT=production`. The web build rejects a development Clerk key only then. A normal `main` deploy of this project is still the development host. CI uses injected variables and does not load local env files. There are no `NEXT_PUBLIC_*` values or Clerk server secret in the Expo frontend. Clerk's Convex JWT issuer must match the deployment. Allowlist the hosted `/sso-callback` URL and configure your production Apple/Google credentials in Clerk before switching the live site.

`npm run web:build:dev` creates a local development-backend export. After linking the existing Vercel project, `REED_ENV_FILE=.env.dev npm run web:preview` publishes a development preview from locally generated bindings; it never promotes the live site. `npm run icons` regenerates native icons, the Apple touch icon and 192/512px PWA icons, including a maskable icon. The manifest enables standalone installation via the browser's install action, or Safari's Add to Home Screen. The production-only worker caches a small offline status page and icon; it never caches app code, auth traffic, API responses or personal data. An installed Reed web app still needs an internet connection for training and coaching. Worker updates wait until existing tabs close.

Authentication uses the same custom UI everywhere: Apple/Google full-page redirects on web and browser sessions on native, email/password, verification with resend, password visibility and recovery. Recovery sends an email code, verifies it, collects a new password, revokes older sessions and handles Device Trust before finalizing sign-in. No native authentication module or Android build is needed for these browser SSO flows.

`npm test` quotes its recursive glob so root and nested tests both run. `npm run lint` rejects every error and warning. Ref, effect, purity and memoization rules are errors. Reanimated mutation exceptions are scoped in `eslint.config.js`; one PanResponder registration has a documented ref-rule exception because the callbacks run on pointer events.

Frontend operational errors pass through `lib/client-observability.ts`. The final PostHog capture boundary removes raw exception messages, causes, stacks, and unapproved properties, including automatic exceptions. Stable slugs and technical operation metadata remain available. Product analytics retain their separate wrapper.

# Reed Roadmap

Last updated: 2026-04-23

This roadmap is a product document, not a feature dump. The main goal is to get Reed to a credible public release without diluting the product: a serious workout app built around a fast, trustworthy live training loop.

## Product stance

Reed is a workout product first.

The release roadmap should protect:

- fast logging
- clear session flow
- trust in auth and data integrity
- production readiness
- AI that reduces effort instead of adding novelty

## Before Public Release

These are release blockers or near-blockers.

### 1. Production auth decision and implementation

Status: open decision

Current state:

- The app currently uses Better Auth with Convex.
- Email/password works locally.
- Google OAuth exists, but email verification is intentionally disabled today.

Open product/platform decision:

- Keep Better Auth and finish production auth there, or migrate to Clerk.

Important:

- This is not a cosmetic SDK swap.
- The current app is already wired around Better Auth on both Expo and Convex.
- A Clerk migration should only happen if it clearly improves reliability, verification flows, operational simplicity, or future product needs.

Clerk notes from current official Expo docs:

- Clerk’s Expo Google guide distinguishes native Sign in with Google from plain Google OAuth.
- Even for a native app, Clerk requires a web OAuth client for token verification.
- For Android, Clerk’s setup expects an Android client ID and `EXPO_PUBLIC_CLERK_GOOGLE_ANDROID_CLIENT_ID`.
- Clerk’s Expo quickstart currently states email/password sign-up can use an email verification code flow.

Sources:

- https://clerk.com/docs/expo/guides/configure/auth-strategies/sign-in-with-google
- https://clerk.com/docs/expo/getting-started/quickstart

Roadmap tasks:

- Decide auth platform: Better Auth vs Clerk.
- Support Google sign-up and sign-in in a production development build.
- Support email sign-up with verification code before account activation.
- Define account deletion, sign-out, password reset, and re-auth behavior for production.
- Remove any auth flow ambiguity between Expo Go, dev builds, and production builds.

Recommendation:

- Do not commit to Clerk just because it is familiar or polished.
- First compare migration cost against finishing Better Auth properly in the existing architecture.

### 2. Production environment setup for Convex and auth

Status: required

Goals:

- clean separation of dev and prod
- no auth misconfiguration at launch
- stable callback/redirect setup
- no manual secret drift

Roadmap tasks:

- Finalize dev vs prod environment contract.
- Define required environment variables for Expo, Convex, and auth provider.
- Configure production Convex deployment and auth secrets.
- Verify production callback URLs, allowed origins, and native app identifiers.
- Document secret rotation and emergency rollback steps.
- Add a release checklist for auth + backend environment validation.
- add github actions build 

### 3. Logging

Status: required before public release

Goal:

- when something breaks, we should know what broke, for whom, and in which product step

Priority logging areas:

- auth attempts and auth failures
- session start / resume / finish
- set logging failures
- exercise add/remove/reorder failures
- rest timer failures and background alert issues
- AI request failures once AI ships

Principle:

- log user journeys and failure seams, not random console noise

### 4. Monitoring

Status: required before public release

Goals:

- detect breakage early
- understand severity quickly
- preserve user trust

Priority monitoring areas:

- app crashes
- auth funnel health
- backend function failures
- latency on session-critical actions
- production error rates by surface: auth, home, workout, settings

Desired outcome:

- we should be able to answer "is the product healthy?" without guessing

## Product Decisions Needed Soon

### 1. Signed-in information architecture

The current shell gives primary-nav weight to surfaces that are not equally real yet.

Questions:

- Should `chat` remain a primary tab before the AI layer earns it?
- Should workout become the default dominant destination?
- What is the correct post-workout landing state?

### 2. Home surface job definition

Home is currently useful but thin.

Decision needed:

- Is Home a prep/review hub, or just a minimal launcher?

If it is a hub, it should likely own:

- resume session
- repeat recent routine
- next recommended workout
- weekly momentum
- quick recovery into action

## Session Intelligence (Non-AI)

Goal:

- Reduce logging friction and increase useful feedback in-session without adding coach-like behavior or extra ceremony.

Scope v1:

- Real-time PR detection when a set is committed or edited.
- History-based shadow autofill for likely next values on the active capture card.

Event model:

- Run PR/autofill updates only on session mutations, not on normal reads/renders.
- Primary triggers: set log, set update, set delete, and live-cardio finish update.
- Keep warmups excluded from PR logic.

PR rulebook v1:

- 1RM PR (estimated) for strength-style sets with load + reps.
- Rep PR at a given weight.
- Weight PR at a fixed rep count.
- Volume PR (set volume and session roll-up where applicable).
- Cardio PRs for supported recipes: time, distance, and density.
- Defer technical PR until form-quality signal exists.
- Defer bodyweight-relative PR until reliable bodyweight history exists.

PR UX:

- Show PR feedback immediately after commit in a lightweight, non-blocking way.
- If multiple PRs are hit on one set, collapse into one compact message.
- Never interrupt logging flow with modal steps.

Data/performance approach:

- Maintain a per-user, per-exercise materialized "best values" ledger.
- Update incrementally at mutation time instead of recomputing full history each set.
- Emit PR events only when a new best is created.

Shadow autofill rulebook v1:

- Provide editable suggested values for the active exercise and set context.
- Source priority:
- current session previous working set
- most recent prior session same exercise + same non-warmup set number
- most recent prior session same exercise nearest non-warmup set
- Treat suggestions as defaults only; user can overwrite instantly.
- Never auto-commit suggested values without explicit log action.

Guardrails:

- Logging speed is the primary KPI; intelligence cannot slow set commit.
- Keep behavior deterministic and explainable for v1.
- Keep this feature in workout/session scope, not chat scope.

## AI

We will brainstorm and define the AI direction separately in chat before turning it into roadmap commitments.

Near-term note:

- Explore a narrowly scoped voice logging MVP inside the active exercise card.
- Goal: let the user log the current set by voice and then move directly into the normal rest state.
- Keep this constrained to the current card context for now; do not expand roadmap scope to broad chat or multi-exercise voice parsing yet.

## Near-Term Next Steps

1. Decide whether auth stays on Better Auth or migrates to Clerk.
2. Define the exact pre-release auth/environment/logging/monitoring checklist.
3. Rework the signed-in IA so it matches the actual product center of gravity.
4. Validate the active-card voice logging MVP scope and correction model.
5. Define the PR rulebook and shadow-autofill logic for session logging.

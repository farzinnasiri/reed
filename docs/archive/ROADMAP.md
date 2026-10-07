# Reed Roadmap

> **Archived 2026-10-07.** This April 2026 roadmap is historical. Current product context is `CONTEXT.md`.

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

### 1. Production auth readiness

Status: Clerk selected and wired in development; production rollout remains open.

Current state:

- Expo and web use Clerk. Convex validates Clerk JWTs through `convex/auth.config.ts`.
- Development email/password sign-in and email-code verification have been exercised in the browser.
- Google SSO has an app flow, but production redirect and native-build behavior still need verification.
- Six older Reed profiles in the development database still have legacy auth IDs and no matching Clerk users. Preserve their content until each owner is migrated or explicitly retired.

Roadmap tasks:

- Verify Google sign-up and sign-in in a production development build.
- Verify email sign-up, password reset, account deletion, and re-auth behavior before public release.
- Define how to migrate or retire the remaining legacy profiles without assigning data by unverified email alone.
- Remove any auth flow ambiguity between Expo Go, dev builds, and production builds.

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

1. Finish Clerk production setup and resolve legacy profile ownership.
2. Define the exact pre-release auth/environment/logging/monitoring checklist.
3. Rework the signed-in IA so it matches the actual product center of gravity.
4. Validate the active-card voice logging MVP scope and correction model.
5. Define the PR rulebook and shadow-autofill logic for session logging.

---

legendary quotes from reed -> use mordern wisdome qoutes and online qoutes -> weave them into reed personlity (motivational)

imrpove reeds personality -> to be your pall, friendu, buddy etc (maybe inspiration from open claw?)

gamification based on completing / finishing closed loops (e.g. )
coins or achievements for goal finishes? -> a momentum score? 
an animaiton or something for when a goal is completed


coach notes should have lables -> feedback, notes, goal ?

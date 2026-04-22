# AGENTS.md

The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in the project. If you ever encounter something in the project that surprises you, please alert the developer working with you and indicate that this is the case in the agent MD file to help prevent future agents from having the same issue.

## Surprise Notes

1. The workspace was renamed from `/Users/farzin/MyProjects/wokrout-counter` to `/Users/farzin/MyProjects/reed` on 2026-04-17. Older notes or scripts may still refer to the old directory name.
2. The previous static prototype was intentionally preserved under `legacy/`. Treat it as a reference artifact, not the active app runtime.
3. Convex generated files under `convex/_generated/` do not exist until `npx convex dev` or `npx convex codegen` runs against a configured deployment. Avoid assuming those files are present in a fresh clone.
4. GitHub CLI auth may be invalid in some local sessions even if an account appears configured. Verify `gh auth status` before planning repo creation or push steps.
5. Better Auth's Expo social flow in this project does not use `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` or `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`; server-side Google credentials plus the Convex site callback are the active integration path.

## Keep These Invariants

1. Backend is Convex-only. Do not add Express, Fastify, Next.js API routes, or any separate Node API runtime path.
2. All real app content should remain auth-gated. Unauthenticated users may see auth-shell or config-shell states, but not product pages.
3. Do not bypass Convex auth context in backend functions.
4. Do not create/use `ConvexHttpClient` flows without token wiring.
5. Keep UI/UX responsive and mobile-safe, with Android as the primary target.
6. Do not move legacy prototype code back into the active Expo app by accident.
7. Design philosophy: less is more, always elegant, every element intentional. Avoid repetitive page-chrome formulas such as eyebrow + oversized title + subtitle unless the user explicitly asks for them.
8. Do not wrap every control or list row in pills/cards by default; use minimal chrome and add containers only when they carry clear UX meaning.
9. Do not persist empty workout sessions: if a session is finished with zero exercises, delete it instead of storing it.
10. Glassmorphism tokens are single-source-of-truth in `components/ui/glass-material.ts`. Do not hardcode per-screen RGBA glass values for shells, segmented controls, or the tab pill.
11. Motion tokens and interaction primitives are single-source-of-truth in `design/motion.ts`. Do not add per-screen springs, custom easing curves, raw `LayoutAnimation.configureNext`, or ad hoc press-feedback patterns.
12. Do not hand-roll overlapping full-screen scene transitions in `SignedInShell` or `WorkoutSurface`. Keep one visible scene per level unless a real navigator/scene system replaces it.

## 20/80 Guardrails

1. No orphan code: routes, mutations, and components must be wired to a live call path in the same change.
2. No unbounded scans on growth tables: avoid `collect()` + JS filtering when an index/search-index path exists.
3. Keep ownership local: feature-internal state stays in the feature component (for example, sheet filters/search stay in the sheet).
4. Keep interfaces small: if a component exceeds roughly `12 props`, split/group before adding more.
5. No speculative persisted fields: every new stored field must be read by shipped behavior in the same PR.
6. Validator/runtime parity: validators must be at least as strict as runtime guards.
7. API contract changes need explicit callout and approval (especially default-result behavior).
8. Never commit local scratch/planning artifacts (for example `.kilo/`).

## Operational Rules

1. Prefer `npm` scripts for install, Expo, and Convex workflows.
2. Never commit secrets or env files (`.env`, `.env.local`, `.env.convex.local`), never read them, only ask the user.
3. Keep `convex/_generated/` out of git; it is deployment-generated state.

## Known Confusion Points

1. `app/` is the active runtime. `legacy/` is not part of the Expo Router app.
2. The root TypeScript config excludes `convex/` because Convex auth plumbing references generated types that are only available after codegen. Do not treat this as permission to ignore backend correctness; run Convex codegen before finalizing backend work.
3. The auth shell supports simple email/password in Expo Go without email verification, but Google OAuth still requires a development build.
4. Google auth for Expo uses the Convex site URL callback path, not the Expo app URL, for the OAuth redirect URI on the provider side.
5. For the workout tab, `legacy/2/` is not only a visual reference. Its swipe-card, wheel-picker, and rest-loop interaction model is the intended baseline unless the developer explicitly says otherwise; do not reinterpret it as a conventional tap-to-log form flow.
6. React Native Web in this project warns on deprecated `pointerEvents` props and `shadow*` style props. Use `style.pointerEvents` and `boxShadow` on web-facing style helpers instead of emitting legacy paths.

## Required Validation Before Finalizing

1. `npm install`
2. `npm run typecheck`
3. `npm run doctor`
4. `npm run convex:codegen` after Convex deployment/env is configured

## Development Phase and Collaboration

This project is still greenfield and actively evolving. Default to minimal-diff changes; do broader re-architecture only when explicitly requested or required to remove a blocker.

Strict collaboration rule:
1. If something looks messy, fragile, or suboptimal, tell the developer explicitly.
2. If you see a materially better approach, propose it before or alongside implementation.
3. Do not silently continue with questionable code just to ship quickly; actively ask questions and seek clarification.
4. Treat this as collaborative engineering: surface tradeoffs, risks, and alternatives, then align with the developer.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

<!-- convex-ai-end -->

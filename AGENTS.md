# AGENTS.md

The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in the project. If you ever encounter something in the project that surprises you, please alert the developer working with you and indicate that this is the case in the agent MD file to help prevent future agents from having the same issue.

## Surprise Notes

1. The workspace was renamed from `/Users/farzin/MyProjects/wokrout-counter` to `/Users/farzin/MyProjects/reed` on 2026-04-17. Older notes or scripts may still refer to the old directory name.
2. The previous static prototype was intentionally preserved under `legacy/`. Treat it as a reference artifact, not the active app runtime.
3. Convex generated files under `convex/_generated/` do not exist until `npx convex dev` or `npx convex codegen` runs against a configured deployment. Avoid assuming those files are present in a fresh clone.
4. GitHub CLI auth may be invalid in some local sessions even if an account appears configured. Verify `gh auth status` before planning repo creation or push steps.

## Keep These Invariants

1. Backend is Convex-only. Do not add Express, Fastify, Next.js API routes, or any separate Node API runtime path.
2. All real app content should remain auth-gated. Unauthenticated users may see auth-shell or config-shell states, but not product pages.
3. Do not bypass Convex auth context in backend functions.
4. Do not create/use `ConvexHttpClient` flows without token wiring.
5. Keep UI/UX responsive and mobile-safe, with Android as the primary target.
6. Do not move legacy prototype code back into the active Expo app by accident.

## Operational Rules

1. Prefer `npm` scripts for install, Expo, and Convex workflows.
2. Never commit secrets or env files (`.env`, `.env.local`, `.env.convex.local`), never read them, only ask the user.
3. Keep `convex/_generated/` out of git; it is deployment-generated state.

## Known Confusion Points

1. `app/` is the active runtime. `legacy/` is not part of the Expo Router app.
2. The root TypeScript config excludes `convex/` because Convex auth plumbing references generated types that are only available after codegen. Do not treat this as permission to ignore backend correctness; run Convex codegen before finalizing backend work.
3. The current auth setup is plumbing-only: providers and client wiring exist, but sign-in screens are intentionally not implemented yet.
4. Google auth for Expo uses the Convex site URL callback path, not the Expo app URL, for the OAuth redirect URI on the provider side.

## Required Validation Before Finalizing

1. `npm install`
2. `npm run typecheck`
3. `npm run doctor`
4. `npm run convex:codegen` after Convex deployment/env is configured

## Development Phase and Collaboration

This project is still greenfield and actively evolving. It is acceptable to re-architect, redesign, repurpose, or replace existing patterns when there is a better approach.

Strict collaboration rule:
1. If something looks messy, fragile, or suboptimal, tell the developer explicitly.
2. If you see a materially better approach, propose it before or alongside implementation.
3. Do not silently continue with questionable code just to ship quickly; actively ask questions and seek clarification.
4. Treat this as collaborative engineering: surface tradeoffs, risks, and alternatives, then align with the developer.

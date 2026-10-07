# AGENTS.md

The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in the project. If you ever encounter something in the project that surprises you, please alert the developer working with you and indicate that this is the case in the agent MD file to help prevent future agents from having the same issue.

## Agent skills

### Issue tracker

Issues and PRDs live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: `CONTEXT.md` at the repo root. This repo has no ADRs. See `docs/agents/domain.md`.

### Product docs

- **Design principles:** `DESIGN-PRINCIPLES.md` at the repo root. Read before any product/UX/design discussion.
- **Product context:** `CONTEXT.md`. The April 2026 roadmap is archived at `docs/archive/ROADMAP.md` and is not a current plan.

### When to invoke skills

These skills do not auto-trigger. Use them explicitly when the situation matches.

| Skill | Invoke when... |
|:------|:---------------|
| `/to-issues` | You have a PRD or plan and want it broken into vertical-slice implementation issues under `.scratch/`. |
| `/triage` | A new issue or bug report arrives and you want it moved through the state machine (`needs-triage` → `ready-for-agent` / `ready-for-human`). |
| `/tdd` | You want to build a feature or fix a bug test-first (red-green-refactor). |
| `/diagnose` | Something is broken, throwing, or slow and the cause is not obvious. |

## Surprise Notes

1. Convex generated files under `convex/_generated/` do not exist until `npx convex dev` or `npx convex codegen` runs against a configured deployment. Avoid assuming those files are present in a fresh clone.
2 . GitHub CLI auth may be invalid in some local sessions even if an account appears configured. Verify `gh auth status` before planning repo creation or push steps.
3. Reed now uses Clerk for Expo auth. The older Better Auth server-side Google credentials and Convex site callback are obsolete. Clerk browser SSO uses `expo-auth-session`, the app scheme callback, and a Clerk allowlisted redirect URL.
4. When removing a field from an existing Convex table schema, dev deployment data may still contain legacy documents and block `convex codegen`/deploy with schema validation errors. Use a widen-migrate-narrow cleanup step rather than assuming local dev data is empty.
5. `@gorhom/bottom-sheet` treats any animation config that has a `duration` as timing and ignores springs. `components/ui/reed-sheet.tsx` therefore passes a plain `damping`/`stiffness` config (`SHEET_SPRING`) equivalent to the duration-based `reedSprings.sheet`; never give a gorhom config a `duration`.
6. The approved interaction prototype replaces the static home glow with one field of three radial gradients and a send wave. The mascot keeps its own small halo. Workout has no glow. Do not add glass, blur, background dots, unrelated hero gradients or header aura pulses.
7. Expo is the only product client, including the Vercel web build. Use `EXPO_PUBLIC_*` variables for its Clerk and Convex configuration; retired `NEXT_PUBLIC_*` values do not configure it. Clerk keys and the Convex JWT issuer must refer to the same instance.
8. Clerk sign-in can succeed while Convex remains unauthenticated if the Clerk instance lacks a JWT template named `convex` with audience `convex`, or if the deployment's `CLERK_JWT_ISSUER_DOMAIN` does not match that instance. Wait for `useConvexAuth().isAuthenticated` before calling Convex profile mutations.
9. Reed uses `@clerk/expo` v4's experimental `useSSO`, which finalizes and activates a completed session internally. Older Clerk `useSSO` examples that manually call `setActive` describe a different hook and must not be copied into this flow.
10. The development Convex deployment no longer has Better Auth records or credentials, but six older Reed profiles still hold legacy auth IDs with no matching Clerk user. Preserve their app data; migrate ownership only after confirming the correct Clerk identity.
11. `reed.getPresence` needs a stable five-minute `now` argument because the server cannot push "an hour has passed". Its `wouldStartNewChapter` uses the server-configured chapter gap and session boundaries; home consumes that same result on open and foreground. Do not restore a separate client cold-conversation threshold.
12. On web, `router.setParams({ x: undefined })` leaves the param in the URL and router state. One-shot params (`pulse`, `you`, workout `intent`/`session`) are cleared with `router.replace` there (see `app/(app)/(tabs)/reed.tsx`).
13. `fontVariant: ['tabular-nums']` is set on the `display` and `stat` tokens, but Figtree has no tabular figures on Android. Live numbers (timers, steppers) also need a fixed-width container so they do not jitter; tabular digits were verified on web only.
14. Time-dependent Convex queries (`home.getPulse`, `home.getTodayCards`, consistency) take a `now` argument that the client rounds down to five minutes (`components/home/use-five-minute-now.ts`). A stable value keeps the subscription cached; it refreshes on the bucket boundary and on foreground. Do not pass `Date.now()`, and do not read the clock inside those queries.
15. React Native Web ignores `maintainVisibleContentPosition`. The Reed thread preserves its measured row anchor while older pages and their widgets load. Oversized home SVG glows must also be clipped: otherwise a hidden navigator can scroll sideways when the browser focuses a control, clipping the Pulse and dock.

16. Calling gorhom modal `dismiss()` again after `onDismiss` leaves its internal status as DISMISSING and prevents later `present()` calls from rendering. `ReedSheet` guards repeated dismissals; keep that guard when changing the shared sheet.

17. In the installed Convex CLI, `npm run convex:codegen` bundles and uploads functions for code analysis before generating bindings, but does not make new public functions callable on the app's development deployment. Sync backend changes with `npm run convex:dev -- --once --env-file .env.dev` before browser QA. Do not mistake codegen's upload message for a published backend change.
18. `FlatList.scrollToEnd()` uses the last item and measured footer, rather than content-container bottom padding. Put the chat's mascot/composer clearance in `ListFooterComponent`; otherwise jumping to latest can leave the final reply beneath the presence fade.

Essential thread positioning must not wait for `requestAnimationFrame`: T3 previews can suspend that clock while still reporting the page as visible. On web, the latest row's commit reads the list's live scroll host before ResizeObserver catches up; placement is immediate and row entrances supply motion. Keep the automatic scroll guard until its measured target is reached on native. Only actual drag/wheel/touch/keyboard intent opts out of following: focus, anchoring and layout can emit scroll events too. Use the thread's controlled `scrollToEnd` handle for Latest; RN Web does not emit native drag callbacks.

19. The worklet compiler captures helper functions during module initialization. Put worklet helpers above the worklets that call them: a lower function declaration can become an initialization-order error in the Expo web runtime even when TypeScript passes.

20. `@convex-dev/migrations` dry runs log whole before/after documents, including message content. Capture and summarize migration status rather than copying those diffs into QA reports or handoffs.

21. Personal-record selection uses timestamps to choose evidence for equal values. Record detection must separately require a strict value improvement; timestamp tie-breaking must not turn an equal set into a new PR.

22. Convex allows only one `paginate()` call in each query/mutation invocation. Picker filters can produce short pages; return the cursor and let the client load the next page. Do not refill a filtered page with a server-side pagination loop.

23. The Add exercise sheet's closing animation can finish after it has reopened. Check the current open state before unmounting in that callback; otherwise the sheet can have `isOpen=true` while no modal is mounted.

24. Gorhom's installed list hook spreads style arrays into `StyleSheet.compose`, which crashes on web with more than two entries. Flatten content-container styles before passing them. Its web `BottomSheetView` is absolutely positioned; fixed conversation sheets need an explicit viewport-derived content height. Percentage heights include the animated overflow padding and push the footer below the viewport.

25. A portal drawing stays visible when its source route freezes. Gate the workout mascot portal by the owner's route activity and clear its measured anchor when the workout header unmounts; otherwise a second mascot remains over the home Pulse after leaving a session.

26. T3 browser previews can stop delivering animation frames even while `document.visibilityState` is `visible`. If Reanimated content freezes mid-reveal, measure requestAnimationFrame delivery before changing app code. Starting a preview recording restored frame delivery in the onboarding audit.

27. React Native Web drops `box-none` when passed as a CSS style value. Decorative portal hosts must use `style.pointerEvents: "none"`; an empty full-screen host can otherwise block every control beneath it.

28. Quote the recursive test glob in npm scripts. With nested test directories present, shell expansion of `tests/**/*.test.ts` can select only nested tests and silently omit the root regression suite. `npm test` passes the quoted glob to the test runner.

29. Body GLBs must go through `art/body-3d/export_assets.py`. Blender can export the vertex-alpha highlight material as `MASK`; the script normalizes it to `BLEND`, transfers continuous-body normals to patch borders, and generates the picking map from final exported triangles. Reordering triangles afterward invalidates that map. Hide inactive highlight nodes at runtime, and apply all morph weights to the hidden patches too. Patch correspondence uses exact authored offset positions; exported custom normals can be quantized at borders and must not be used to infer source vertex IDs. The shipped body is `assets/body-3d/v3.4/compressed/`. Older GLBs, previews, and Blender files were removed. Smaller standalone files do not establish APK savings when the package already compresses assets.

30. Reed history uses the existing thread-wide paginated subscription. Chapters are visual moments, not separate lists: keep the thread mounted across chapter changes and load older pages near the top. All loaded pages receive reaction updates; do not restore chapter resets or row-local historical reaction caches.

31. The final coach reply reads `globalSettings` through `aiSettings.load` once per turn; `REED_CHAT_MODEL` does not select it. MiniMax M3 supports native reasoning but does not expose effort/budget controls. See `docs/ai-models.md`; do not copy GLM/DeepSeek effort settings onto MiniMax.

32. The installed gorhom `BottomSheetModalProvider` uses a generated portal host name, so a plain `<Portal>` targeting the default `root` host renders nothing. Message actions use their dedicated `reed-message-actions` host in the authenticated shell; keep it inside the shared portal provider.

33. Reed now targets Expo SDK 57. Keep Expo Go and the project SDK aligned, and use `npx expo install --fix` to align React Native, Reanimated and Worklets together. `expo-localization` needs an explicit plugin entry in the dynamic `app.config.ts`; Expo cannot insert it automatically. Browser QA does not require Android tooling. Do not download SDKs, emulators or Gradle artifacts or run native builds on this machine unless explicitly requested.

34. The workout mascot bridge maps drafting's `focused` expression to `watching`. Keep that mapping gated by `presence.state !== 'thinking'`; the pending-reply loop also uses `focused` as an activity glyph and should pass through unchanged.

35. Node 25 can expose a `localStorage` object without `getItem` when no storage file is configured. Expo notifications then logs an SSR registration error even though browser storage works. `metro.config.cjs` removes only that unusable server object before rendering; do not replace browser storage or add notification registration to server rendering.

36. Body v3.1 adds authored biceps/triceps discomfort patches and triangle runs; the v3.0 map groups upper arms under shoulder. Its female back band is a baked coverage texture, not a cast shadow. Fix these in `art/body-3d/build_bodies.py` and regenerate from `art/body-3d/reed-bodies-v3.4.blend` with the exporter, rather than adding runtime maps, cloned patches or shader overrides. Use an explicit versioned output path. The older GLBs and blends are no longer in the tree.

37. The v3.2 torso/arm region fix separates the authored selection mask from the conservative deformation mask. Using the latter for classification put inner-arm and forearm islands into torso pain/muscle patches. Rebuild and export rather than hiding those islands at runtime. Onboarding files are excluded by the default ESLint config; lint touched files with `--no-ignore` as well.

38. Body v3.3 was a topology-preserving refinement of the v3.2 meshes. `build_bodies.py` does not reproduce that silhouette. Refine actual appearance endpoints and reconstruct the combined corrective, rather than smoothing the corrective's stored coordinates as if they were an independent body. The current source file is `art/body-3d/reed-bodies-v3.4.blend`.

39. Body v3.4 partitions the saved v3.3 source with `partition_regions.py`; it does not rebuild or sculpt the bodies. Broad thigh/calf/hip/wrist catchments previously wrapped unrelated anatomy. Front/back leg, lateral hip/glute/groin and forearm/wrist/hand labels now have independent authored patches. A valid surface raycast must win before anchor snapping; checking nearby anchors first can turn an abdomen hit into a hip or elbow selection.

40. Onboarding is the live signup flow; the You sheet uses focused editors instead of replaying that flow. Profile saves use `onboarding.updateField` to merge only the edited field into current answers and preserve newer measurements; do not resubmit a stale full onboarding snapshot. App readiness requires both `profiles.onboardingVersion === 2` and the completion timestamp. Canonical answers live in `trainingProfiles.onboarding`; the development schema and all 9 profiles now use only the current answers. Do not synthesize old gym goals, an exact birthday, equipment or measured body-fat values from onboarding answers. The owner-confirmed cleanup removed legacy payloads and temporary migration endpoints. Optional coach notes use the existing authenticated speech endpoint with actor `onboarding_notes`; never log their content.

41. gorhom's `BottomSheetTextInput` calls `TextInput.State.currentlyFocusedInput`, which react-native-web lacks, so it throws when it loses focus on web. Inside any sheet use `ReedSheetTextInput` (`components/ui/reed-sheet-input.tsx`); a test rejects the raw input. For a bare input inside a field that draws its own shape, add `bareInputStyle` from `components/ui/focus.ts` (the web-only `outlineStyle: 'none'`; `outlineWidth: 0` does nothing).

42. A sheet must not change height while open. Swapping `snapPoints` (or any fixed fraction) re-lays out its content at once while the sheet is still animating, which is the "buggy resize" the profile sheet had. Keep one height and fade the content (`FadeIn`), or give the sheet several resting heights (`heightFraction` array and `snapIndex`) so content is laid out once at the tallest.

43. Siblings need distinct React keys even when they are different components: the You sheet's header and its content pane both used the section name and React rendered the header twice. Prefix them (`header-…`, `pane-…`).

44. The workout mascot is drawn in a portal above the screen, so it does not inherit the stage recede. `SessionMascotProvider` reads the recede and passes it in; without that the header mascot floats over the scrim whenever any sheet opens.

45. `getForSession` (past session insights) returns `null` for a session that is not ended or not found, and `undefined` while loading. The insights sheet shows both states; do not render it only when the data exists, or the three dots do nothing.

46. The separate Next.js `web/` client is retired. Root Expo is the sole product client and exports static HTML for Vercel. Cloud installation needs a deployment-scoped `CONVEX_DEPLOY_KEY` for ignored bindings; a preview-project key cannot run `convex codegen`. A web export with `REED_APP_VARIANT=production` rejects development Clerk keys. Vercel labels every `main` build as production, and Reed's Clerk app has no production instance yet, so that switch stays off for `reed-web.vercel.app`. Use `signIn.sso` with full-page redirects on web; Expo `useSSO` opens its popup after an API request, which mobile browsers can block. The `.web` callback finalizes or transfers Clerk resources and preserves Device Trust verification. Keep native callbacks intact for the rotating token nonce.

47. Nested Reanimated `layout` transitions on the Today stack and widget disclosure can scale text and icons severely on web during expansion. `ExpandableWidget` measures and clips the panel height instead; keep its ancestor layouts free of scaling transitions. Collapsed panels stay mounted and inert on web to preserve drafts without exposing hidden controls.

## Keep These Invariants

Portal context note: gorhom's portal renders content at its host. Keep the shared Reed conversation/draft provider above `BottomSheetModalProvider`. Pass workout visibility and the mascot controller bridge explicitly into session-sheet content; feature contexts beneath the navigator do not automatically survive that portal.

1. Backend is Convex-only. Do not add Express, Fastify, Next.js API routes, or any separate Node API runtime path.
2. All real app content should remain auth-gated. Unauthenticated users may see auth-shell or config-shell states, but not product pages.
3. Do not bypass Convex auth context in backend functions.
4. Do not create/use `ConvexHttpClient` flows without token wiring.
5. Keep UI/UX responsive and mobile-safe, with Android as the primary target.
6. Do not move legacy prototype code back into the active Expo app by accident.
7. Design philosophy: less is more, always elegant, every element intentional. Avoid repetitive page-chrome formulas such as eyebrow + oversized title + subtitle unless the user explicitly asks for them.
8. Do not wrap every control or list row in pills/cards by default; use minimal chrome and add containers only when they carry clear UX meaning.
9. Do not persist empty workout sessions: if a session is finished with zero exercises, delete it instead of storing it.
10. Colour, type, radius and spacing tokens are single-source-of-truth in `design/system.ts`, documented in `DESIGN.md` (add a token there first). Do not hardcode per-screen colours, radii or font names. Surfaces are solid and dark only: no glass, blur, shadows or light theme.
11. Motion tokens and interaction primitives are single-source-of-truth in `design/motion.ts` (haptics in `design/haptics.ts`). Do not add per-screen springs, custom easing curves, raw `LayoutAnimation.configureNext`, direct `expo-haptics` calls in UI, or ad hoc press-feedback patterns.
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
4. **Frontend / design work:** Read `DESIGN.md` before implementing or modifying any UI component, screen layout, animation, or colour. It is the single source of truth for tokens, shapes, motion, widgets and component contracts; `prototypes/redesign/home.html` is its interactive mockup.
5. Android build variants are intentionally distinct:
   - `make android-arm-dev` builds the installable dev-backend APK. It uses `.env.dev`/EAS `development`, is named `Reed Dev`, and uses package `com.farzinnasiri.reed.dev`.
   - `make android-arm-prod` builds the installable production APK. It uses `.env.prod`/EAS `production`, is named `Reed`, and uses package `com.farzinnasiri.reed`.
   - `make android-dev-client` builds the Expo development-client APK. It uses `.env.dev`/EAS `development`, is named `Reed Development`, and uses package `com.farzinnasiri.reed.development`.
   - If the user asks for an Android build that points to the development backend, use `make android-arm-dev`, not `make android-dev-client`, unless they explicitly ask for an Expo development client.

### Disposable development test account

For local browser QA, use the existing test account at `https://reed.localhost` and choose **Sign in**, not Create account.

- Email: `reed-design+clerk_test@example.com`
- Clerk development test email code: `424242`, when email verification or client-trust verification is requested.

This is a disposable development-only account, not a production or personal account. Onboarding was completed for UI review. Reuse its session when available; do not recreate the account or bypass authentication. Its password is the `design` object in `/Users/farzin/.config/reed/generic-test-account.json` (mode 0600). Passwords are not stored in the repo. If credentials stop working, ask the user rather than changing auth configuration. Never copy credentials into reports, screenshots, logs, or handoff documents.

For data-rich development QA, sign in as `reed-generic+clerk_test@example.com`. Its password is the top-level `password` in that same local file. Use the Clerk test code `424242` if prompted. This account owns the former `farzin2@gmail.com` profile, its completed onboarding and older workout history, plus six explicitly labeled synthetic September 2026 sessions. The legacy Better Auth identity was removed from the development deployment; do not recreate or migrate it again.

### Local development with Portless

- For Reed's browser build, run `make dev` and open `https://reed.localhost`; the Makefile runs Expo Web through Portless.
- Use that named URL as the canonical origin for browser QA; do not select, expose, or hard-code the internal localhost port assigned by Portless.
- Native Expo development remains `make expo` (or the platform-specific Make target). Portless is for the browser-facing local server and does not replace Metro's device connection workflow.
- Keep `make dev` running while testing. Run the web script without Portless only when specifically diagnosing Portless itself.

## Observability

1. Product analytics belong in `lib/analytics.ts`; do not call PostHog directly from feature UI unless extending that wrapper.
2. Frontend operational/debug telemetry belongs in `lib/client-observability.ts` as one safe wide event per user operation, with stable `exception.slug` values and no raw messages, image URIs, tokens, emails, names, prompts, or health text.
3. Backend AI/LLM tracing belongs in `convex/langfuseTracing.ts`; keep Langfuse setup centralized and pass compact model/input/output metadata from Convex actions.
4. For future backend operational monitoring, add a small `convex/observability.ts` wide-event wrapper before instrumenting individual functions; keep product analytics, operational telemetry, and Langfuse traces separate.

## Known Confusion Points

1. The root TypeScript config excludes `convex/` because Convex auth plumbing references generated types that are only available after codegen. Do not treat this as permission to ignore backend correctness; run Convex codegen before finalizing backend work.
2. The auth shell uses Clerk email/password with email-code verification in the current development instance. Test users can also need a client-trust email code after password sign-in.
3. Clerk browser SSO for Google uses the Expo app scheme callback (`reed-dev://sso-callback`, `reed-development://sso-callback`, or `reed://sso-callback` by variant). Google redirects to Clerk first; Convex validates Clerk's resulting JWT and does not host the OAuth callback.
4. React Native Web in this project warns on deprecated `pointerEvents` props and `shadow*` style props. Use `style.pointerEvents` and `boxShadow` on web-facing style helpers instead of emitting legacy paths.
5. "Development backend build" and "Expo development build/client" are not the same thing. The former is a normal installable app pointed at Convex dev (`android-arm-dev`); the latter is a dev-client for local Expo development (`android-dev-client`).

## Required Validation Before Finalizing

1. `npm install`
2. `npm run typecheck`
3. `npm run doctor`
4. `npm run convex:codegen` after Convex deployment/env is configured

Checkout the makefile for common tasks

## Development Phase and Collaboration

This project is still greenfield and actively evolving. Default to minimal-diff changes; do broader re-architecture only when explicitly requested or required to remove a blocker.

Strict collaboration rule:
1. If something looks messy, fragile, or suboptimal, tell the developer explicitly.
2. If you see a materially better approach, propose it before or alongside implementation.
3. Do not silently continue with questionable code just to ship quickly; actively ask questions and seek clarification.
4. Treat this as collaborative engineering: surface tradeoffs, risks, and alternatives, then align with the developer.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# Expo 56 Reinvented Wheel Audit

Date: 2026-05-27

Scope: audit the current Reed Expo app after the SDK 56 dependency upgrade, with a focus on where the app has intentionally built product-specific primitives versus where it is carrying duplicated platform/library work. This is not a proposal to migrate everything to new SDK 56 APIs. The goal is to keep the app working in Expo Go first, then reduce complexity only where the replacement makes the code easier to operate.

## Sources Consulted

- Expo SDK 56 changelog: https://expo.dev/changelog/sdk-56
- Expo UI universal components: https://docs.expo.dev/versions/v56.0.0/sdk/ui/universal/
- Expo UI drop-in replacements: https://docs.expo.dev/versions/v56.0.0/sdk/ui/drop-in-replacements/
- Expo icon guide: https://docs.expo.dev/guides/icons/
- Expo Router native tabs: https://docs.expo.dev/router/advanced/native-tabs/
- Local Expo upgrade skill: `/Users/farzin/.codex/plugins/cache/openai-curated/expo/603a6e80/skills/upgrading-expo/SKILL.md`
- Local Expo native UI skill: `/Users/farzin/.codex/plugins/cache/openai-curated/expo/603a6e80/skills/building-native-ui/SKILL.md`

## Current Baseline

The project is now on the Expo 56 family:

- `expo@56.0.5`
- `react@19.2.3`
- `react-native@0.85.3`
- `expo-router@56.2.7`
- `@expo/vector-icons@15.1.1`
- `expo-audio@56.0.11`
- `expo-notifications@56.0.14`
- `expo-blur@56.0.3`
- `react-native-reanimated@4.3.1`
- `react-native-worklets@0.8.3`

Validation already run after the SDK upgrade:

- `npm run typecheck`
- `npm run doctor`
- `npm run convex:codegen`
- `npx expo install --check`
- `npx expo export --platform web --output-dir /tmp/reed-sdk56-web-export`

There are no checked-in `ios/` or `android/` folders. The app is still in the Expo managed / CNG lane, which is good for the current stage. There are also no local `metro.config.*`, `babel.config.*`, `patches/`, or native module directories, so there is not much hidden native complexity.

## Executive Judgment

Reed has not broadly reinvented the wheel in a harmful way. Most of the custom work is product-specific: the workout interaction model, the glass design system, the custom app dock/shell, and the Reed chat wrapper all encode decisions that generic Expo UI primitives would not automatically preserve.

The actual complexity problem is narrower: repeated custom sheet/modal machinery, globally leaked icon imports, a local third-party type shim, and local persistence that sometimes duplicates server state. Those are the areas where dependency and obscurity are increasing. Fix those with small deep primitives before adopting new SDK 56 APIs broadly.

My recommended posture:

1. Keep the product-specific custom UI.
2. Extract platform mechanics into shared Reed primitives.
3. Use Expo UI selectively for boring native controls or future settings-style surfaces.
4. Avoid migrating critical workout flows to native primitives until manual Expo Go testing proves parity.

## Decision Framework

- Keep: custom code that expresses Reed-specific product behavior.
- Wrap: dependency choices that are reasonable but currently leak across too many files.
- Replace: custom code that reimplements generic platform mechanics with no product advantage.
- Defer: SDK 56 features that are promising but do not solve a current Reed problem.

## Findings

### P1: Repeated Sheet And Modal Machinery

This is the strongest "reinvented wheel" finding.

Current examples:

- `components/workout/workout-add-exercise-sheet.tsx` owns `Modal`, `KeyboardAvoidingView`, `Animated.Value`, open/close timing, and a nested filter modal.
- `components/workout/workout-session-insights-sheet.tsx` owns its own drag thresholds, `PanResponder`, animated height/translate, scrim, and close behavior.
- `components/home/quick-log-sheet.tsx` repeats modal mount state, drag handling, keyboard avoidance, scrim behavior, and preset loading.
- `components/home/profile-surface.tsx` has a bodyweight logger modal embedded in a 2488 line surface.
- `components/home/profile/goals-surface.tsx` has goal creation and exercise picker modals.
- `components/workout/workout-timeline-page.tsx` has another custom confirmation modal.

Why this matters:

- A small sheet behavior change requires edits across many files.
- Accessibility, keyboard, safe-area, reduced-motion, drag threshold, and close semantics can drift between screens.
- It hides product behavior inside platform plumbing.

Recommendation:

Build one app-level `ReedSheet` primitive before migrating individual sheets. It should own `Modal`, scrim, keyboard behavior, safe area, close handling, reduced motion, animation tokens, and optional drag dismissal. Then migrate one sheet at a time.

Do not start by replacing every sheet with Expo UI. Expo UI SDK 56 includes universal `BottomSheet`, and the drop-in replacement docs list a BottomSheet compatible with `@gorhom/bottom-sheet`, but Reed's existing sheets are visually and behaviorally product-specific. A Reed wrapper gives us a stable interface first; we can later swap its implementation to Expo UI if it proves better.

Suggested first targets:

1. `components/home/quick-log-sheet.tsx`
2. `components/workout/workout-add-exercise-sheet.tsx`
3. `components/workout/workout-session-insights-sheet.tsx`

### P1: Icons Leak A Library Choice Everywhere

`@expo/vector-icons` is imported directly across many app surfaces:

- `components/home/app-shell.tsx`
- `components/home/home-surface.tsx`
- `components/home/profile-surface.tsx`
- `components/home/settings-surface.tsx`
- `components/reed/reed-composer.tsx`
- `components/reed/reed-thread.tsx`
- `components/ui/reed-chat.tsx`
- multiple workout files

Expo's icon guide still documents `@expo/vector-icons` as part of the Expo template stack, built on top of `react-native-vector-icons`, so the current dependency is not wrong. The problem is coupling, not correctness.

Recommendation:

Create a tiny `components/ui/reed-icon.tsx` wrapper around the current Ionicons usage. Keep `@expo/vector-icons` internally for now. This gives Reed one place to change icon implementation later, whether that becomes Expo Router native tab icons, Expo UI `Icon`, SF Symbols on iOS, Material Symbols on Android, or a package-specific icon import.

Do not do a broad icon migration now. It is easy to break visual details and adds little SDK 56 value before manual app testing.

### P1: `react-native-keyboard-controller` Looks Unused

`package.json` includes:

- `react-native-keyboard-controller@1.21.6`

Current source search found no imports for:

- `react-native-keyboard-controller`
- `KeyboardProvider`
- `KeyboardAware`
- `useKeyboard`

The active sheet code uses React Native `KeyboardAvoidingView` instead.

Recommendation:

After manual Expo Go smoke testing, remove `react-native-keyboard-controller` if it is still unused and validation stays green. Native dependencies should earn their place, especially in an Expo Go-first project.

### P1: Local Chat Type Shim Is Dependency Debt

The app correctly uses a real chat library instead of hand-rolling a chat UI:

- `components/ui/reed-chat.tsx` wraps `react-native-gifted-chat`.

But the project carries a local module declaration:

- `types/react-native-gifted-chat.d.ts`
- `tsconfig.json` maps `react-native-gifted-chat` to that local shim.

This is acceptable as a temporary compatibility layer, but it is a risk after React 19 / React Native 0.85 because the app's type surface can drift from the actual library runtime.

Recommendation:

Keep the chat wrapper. Do not rewrite chat UI. Later, do one focused dependency pass:

- Check whether `react-native-gifted-chat` has updated types compatible with React Native 0.85.
- If yes, delete the local shim.
- If no, keep the shim but make it intentionally minimal and documented.
- If runtime issues appear in Expo Go, evaluate another maintained chat component before hand-rolling one.

### P1: Local AsyncStorage Caches Need Clear Ownership Rules

AsyncStorage appears in two important places:

- `components/home/quick-log-sheet.tsx` caches quick log presets.
- `components/reed/use-reed-conversation.ts` stores recent Reed messages and coach items.

Some local persistence is fine. The risk is duplicating Convex-backed state without a clear freshness contract. Convex already gives live queries and client-side caching for server-owned data. Local storage should not become a second source of truth unless offline behavior is intentional.

Recommendation:

Define a simple rule:

- Use `AsyncStorage` for UI preferences, local drafts, last-used values, or explicit offline buffers.
- Use Convex for product data and server-owned state.
- If local cached server data remains, store a version/freshness marker and keep the read path obvious.

Do not remove these caches blindly. First identify which ones are required for perceived startup speed or offline UX.

## Keep Custom

### Reed Glass And Design Primitives

Keep:

- `components/ui/glass-surface.tsx`
- `components/ui/glass-material.ts`
- `components/ui/glass-tab-pill.tsx`

These files encode Reed's visual language and platform fallbacks. `glass-material.ts` centralizes blur availability and Android fallback behavior; `glass-surface.tsx` uses `expo-blur` behind a product-specific interface. This is good encapsulation.

Do not replace this with Expo UI globally. If Expo's newer native glass/liquid-glass APIs become useful, they should be evaluated behind the existing Reed glass interface, not spread across screens.

### Custom App Shell

Keep:

- `app/_layout.tsx`
- `app/(app)/(tabs)/_layout.tsx`
- `components/home/app-shell.tsx`

The app hides the default tab bar and renders a custom dock/shell. That is a product decision, not accidental complexity. Expo Router native tabs are now more capable in SDK 56, including native icon APIs, tab hiding, disabled triggers, and Android selected icon support, but Reed's navigation is not a conventional tab bar right now.

Do not migrate to `NativeTabs` just because SDK 56 has them. Revisit only if Reed's primary navigation becomes a standard platform tab model.

### Workout Metric Picker

Keep:

- `components/workout/workout-metric-picker.tsx`

This is domain-specific interaction code for workout logging. Native `Picker` or generic Expo UI controls would likely be worse for the main workout flow. The picker encodes fast editing of reps, load, duration, distance, and effort inside Reed's workout surface.

Possible future cleanup:

- Split the file by knowledge if it grows further: metric value model, wheel interaction, duration timer, and presentation.
- Keep the public interface small.
- Do not replace with Expo UI unless a specific control proves better in manual testing.

### Segmented Control

Keep for now:

- `components/ui/segmented-control.tsx`

Expo UI includes universal controls and drop-in replacements for segmented control, but Reed's current segmented control is a shared branded primitive with animation, compact/icon-only variants, and accessibility roles. It is not obviously worse than a native segmented control for this app.

Possible later experiment:

- Use Expo UI segmented controls only in settings/profile contexts where native platform feel matters more than Reed-specific motion.

### Auth And Secure Storage

Keep:

- `lib/auth-client.ts`
- `design/provider.tsx`

The app uses `@better-auth/expo` with `expo-secure-store` for auth. That is the right kind of dependency use. Theme preference also uses SecureStore; this is slightly heavier than AsyncStorage but not a meaningful complexity problem while SecureStore is already present.

### Audio And Notification Wrappers

Keep:

- `lib/rest-timer-alerts.ts`
- `lib/onboarding-feedback.ts`

These files hide Expo native APIs behind app-specific functions. That is good design. The only concern is that they manually describe imported module shapes; those aliases can drift as Expo modules evolve.

Recommendation:

When touching these files, prefer deriving types from the real modules where possible. Do not broaden this now unless Expo Go testing shows a runtime issue.

## Large File Hotspots

These are not SDK 56 blockers, but they are where future changes are likely to hurt.

| File | Lines | Risk |
| --- | ---: | --- |
| `components/home/profile-surface.tsx` | 2488 | Very high cognitive load; multiple concerns in one surface |
| `components/workout/workout-session-insights-sheet.tsx` | 1151 | Sheet mechanics plus insights presentation plus drag behavior |
| `components/workout/workout-surface.styles.ts` | 1094 | Large style bag; likely to hide dead styles and local exceptions |
| `components/workout/workout-surface.tsx` | 979 | Main workflow surface; understandable but sensitive |
| `components/workout/workout-metric-picker.tsx` | 729 | Product-specific but approaching split point |
| `components/workout/workout-add-exercise-sheet.tsx` | 687 | Duplicated sheet mechanics |
| `components/home/quick-log-sheet.tsx` | 649 | Duplicated sheet mechanics plus local persistence |

Recommendation:

Do not refactor these just because they are large. Split them when a feature change naturally touches a concern. The best first extraction is the shared sheet primitive because it removes repeated platform behavior from several files at once.

## Broader Complexity Audit

This section widens the scope beyond Expo 56. It checks the current app against the project guardrails: avoid change amplification, avoid high cognitive load, use React Native / Expo primitives where they reduce code, and do not let implementation details leak into every feature.

### P1: Feature Files Often Mix Too Many Kinds Of Knowledge

Examples:

- `components/home/profile-surface.tsx` mixes Convex queries, profile editing routing, bodyweight logging, progress aggregation, accordion UI, sheet state, and many local presenter components.
- `components/home/home-surface.tsx` does server query wiring plus chart segment shaping plus sort/share calculations plus rendering in the screen component.
- `components/reed/reed-surface.tsx` owns chat navigation, keyboard tracking, scroll settling, quick action visibility, composer state, voice draft reset, and message dispatch.
- `components/workout/workout-session-insights-sheet.tsx` mixes modal mechanics, drag handling, analytics shaping, and presentation.

This violates the "decompose by knowledge" rule. The problem is not that files are long by itself; the problem is that a reader has to keep server data shape, local UI state, animation timing, and product meaning in their head at the same time.

Better direction:

- Keep screen components as composition boundaries.
- Move pure shaping into presenters/selectors near the feature, like `components/reed/reed.presenter.ts` already does.
- Move native mechanics into UI primitives/hooks: `ReedSheet`, `useKeyboardInset`, `useInitialScrollSettling`, `useDismissableDrag`.
- Move server/domain decisions into Convex or feature services, not into visual components.

Do not split by render order. Split by knowledge ownership.

### P1: Manual Keyboard And Scroll Orchestration Is Fragile

`components/reed/reed-surface.tsx` manually listens to keyboard events, stores `keyboardHeight`, tracks composer height, delays initial scroll with `setTimeout(..., 0)`, uses `requestAnimationFrame`, and then runs another delayed scroll after keyboard/voice changes.

That is a lot of temporal coupling:

- `hasInitialScrollSettledRef`
- `hasInitialComposerAlignmentRef`
- `composerDockHeight`
- `keyboardHeight`
- `isThreadReady`
- delayed scroll calls

This is understandable because chat UIs are hard, but it is a high-risk custom platform implementation. React Native and the ecosystem have existing primitives for this class of problem:

- `KeyboardAvoidingView` for simple screens.
- `FlatList` / inverted list patterns for message threads.
- maintained keyboard-aware/keyboard-controller libraries when the app really needs native keyboard tracking.
- `react-native-gifted-chat` already carries some list/composer assumptions, although Reed currently wraps a custom thread/composer rather than only using Gifted Chat's full UI.

Recommendation:

Do not rewrite chat now. But treat this as a contained debt area. The next time Reed chat is touched, decide explicitly between:

1. Lean harder into `react-native-gifted-chat` for list/composer keyboard behavior.
2. Keep custom Reed chat UI, but extract keyboard/scroll orchestration behind a hook with one public contract.

The current middle state is where complexity accumulates: dependency present, but hard platform behavior still hand-managed in the surface.

### P1: Local Mock Runtime Still Leaks Into Live Reed UI

`components/reed/reed-surface.tsx` creates `createLocalMockReedRuntime()` and passes `runtime` plus `displayName` and `shouldDelayAssistantStart` into `useReedConversation`.

Current `useReedConversation` only destructures `markOnline`; `displayName`, `runtime`, and `shouldDelayAssistantStart` are typed as accepted props but unused. That means a previous local/mock architecture is still visible in the live app surface even though the real path is Convex-backed.

Why this matters:

- It creates false concepts for future maintainers.
- It suggests the UI can switch runtimes locally, but the hook now sends through `api.reed.sendMessage`.
- It is exactly the kind of "vibed" residue that increases cognitive load without delivering behavior.

Recommendation:

Remove the unused mock runtime path in a focused cleanup after Expo Go manual testing:

- Delete `components/reed/reed.runtime.ts` if no longer used.
- Remove `displayName`, `runtime`, and `shouldDelayAssistantStart` from `useReedConversation` inputs unless they become real behavior again.
- Keep mock/demo behavior only behind an explicit fixture or story-like path, not in the production surface.

### P1: Convex Growth Guardrails Are Partially Violated

The project guardrail says no unbounded scans on growth tables. Convex's own generated guidance says to prefer bounded `.take(n)` or pagination over `.collect()` unless all results are explicitly required.

Current `.collect()` usage appears in several places:

- `convex/quickLogs.ts` collects enabled presets. This is probably fine because presets are bounded product config.
- `convex/homeStats.ts` collects weekly activity logs. This is time-windowed and probably acceptable early.
- `convex/trainingKnowledge.ts` collects activity/bodyweight windows for summaries and comparisons.
- `convex/trainingTargets.ts` collects active and historical target-related activity logs.
- `convex/workout/sessions.ts` collects live session exercises and set logs in many mutations/queries.
- `convex/reedJourney.ts` collects several time-windowed datasets for AI context.
- `convex/exerciseCatalog.ts` collects all supported live-session exercises in one path.

This is not all equally bad. Some collections are naturally small: current session exercises, sets for one exercise, quick log presets. The riskier pattern is collecting time-windowed activity logs or catalog rows without an explicit upper bound.

Recommendation:

- Leave small ownership-scoped collections alone for now: one active session, one session's exercises, one exercise's sets.
- Add explicit `.take(n)` bounds where windows could grow: training summaries, Reed journey context, exercise catalog option lists.
- For user-facing lists, prefer pagination or search indexes.
- For aggregates shown often, consider materialized summaries only when the current query shape becomes slow or starts complicating UI code.

### P1: Coach Items Are Local UI State But Look Like Product Data

`components/reed/use-reed-conversation.ts` seeds `INITIAL_COACH_ITEMS`, persists coach items to AsyncStorage, and lets users resolve/save them locally.

This may be fine as an early prototype, but the UI presents coach items as if they are durable product objects. They are not Convex-backed, not tied to the authenticated profile, and not available across devices.

This violates the source-of-truth boundary more clearly than the recent-message cache. A recent-message cache is a UI optimization; coach items are product data.

Recommendation:

- If coach items are a real Reed feature, move them to Convex with profile ownership.
- If they are a prototype/demo concept, label them internally as local draft/demo state and keep them out of core product flows.
- Do not keep growing local product data in AsyncStorage.

### P2: Pressable Interaction Styling Is Repeated Everywhere

The app already has useful primitives:

- `components/ui/reed-button.tsx`
- `components/ui/reed-icon-button.tsx`
- `design/motion.ts` with `getTapScaleStyle`

But many screens still wire `Pressable` directly and repeat inline pressed style arrays. Some direct `Pressable` use is correct for rows/cards, but repeated button-like controls should use Reed primitives.

Recommendation:

- Keep direct `Pressable` for custom rows, cards, swipe surfaces, and compound controls.
- Use `ReedButton` / `ReedIconButton` for actual buttons.
- Add variants only when repeated controls prove they need them.
- Do not create a huge universal button abstraction; keep the primitive small.

### P2: ScrollView Is Used Where Lists May Grow

Many screens use `ScrollView`, which is fine for bounded profile/settings/onboarding content. Potential risk areas:

- exercise search results in add-exercise flows,
- chat/message thread behavior,
- historical workout timelines,
- coach items if they become durable/product-scale.

React Native primitives already exist for growing lists:

- `FlatList`
- `SectionList`
- `VirtualizedList`

Recommendation:

- Keep `ScrollView` for fixed/short screens.
- Use `FlatList` or paginated list primitives for unbounded or search-backed collections.
- Pair this with Convex pagination so the UI and backend scale together.

### P2: Animation Is Centralized In Tokens But Not In Behavior

`design/motion.ts` centralizes durations, easing, native-driver choice, and tap scale. That is good.

The leak is behavior-level animation:

- sheet open/close progress,
- drag offset and dismissal,
- onboarding timed reveals,
- chat scroll/readiness delays,
- per-feature `Animated.Value` lifecycles.

Recommendation:

- Keep `design/motion.ts` as the token source.
- Add behavior hooks only for repeated behavior, starting with sheets.
- Do not migrate everything to Reanimated just because it is installed. Use Reanimated where gesture/performance requirements justify it, especially if replacing PanResponder-driven drag surfaces later.

### P2: Expo UI Should Be A Targeted Tool, Not A Rewrite Strategy

Good Expo UI candidates:

- settings controls,
- profile preference controls,
- simple pickers,
- checkboxes/switches/sliders,
- native-looking form rows,
- future boring modal/sheet primitives behind Reed wrappers.

Bad Expo UI candidates right now:

- workout metric picker,
- workout swipe card,
- custom app dock,
- Reed glass surface,
- main chat experience,
- workout session flow.

The principle: use Expo UI when the control is generic and native expectations matter. Keep custom UI where the interaction is Reed's product.

### P2: Web Compatibility Is Being Handled, But It Needs A Policy

There are good signs:

- `design/system.ts` uses `boxShadow` on web instead of deprecated React Native Web shadow props.
- `glass-material.ts` centralizes platform blur support.
- `app/+html.tsx` applies Expo Router's `ScrollViewStyleReset`.

But platform checks are scattered in feature files too. That is not wrong, but it should stay rare.

Recommendation:

- Keep platform-specific visual behavior in design/ui primitives where possible.
- Let features ask for intent: "glass surface", "keyboard-safe sheet", "icon button".
- Avoid feature files making repeated platform decisions unless the platform difference is genuinely product-specific.

### P2: Admin/Seed Operations Are Exposed As Public Mutations

`convex/reed.ts` has public mutations for prompt/attitude administration protected by `adminSecret`:

- `upsertAttitude`
- `deleteAttitude`
- `seedDefaultAttitudes`
- `upsertActivePrompt`

The secret check is better than nothing, but this still exposes admin mechanics through the public API surface. In Convex, internal functions and deployment/admin scripts are usually a cleaner boundary for maintenance operations.

Recommendation:

- Keep this as-is if it is actively useful during greenfield development.
- Before any broader release, move admin/seed operations behind internal functions or an explicit admin-only workflow.
- Do not let product UI depend on raw secret-taking mutations.

## Pattern Violations Summary

| Pattern | Current evidence | Better shape |
| --- | --- | --- |
| Change amplification | Sheet behavior duplicated across several files | `ReedSheet` primitive |
| High cognitive load | `profile-surface.tsx`, `reed-surface.tsx`, insights sheet mix many concerns | Split by knowledge ownership |
| Unknown unknowns | Mock runtime props still visible but unused in live Reed chat | Remove stale concepts |
| Source-of-truth drift | Coach items stored in AsyncStorage while presented as product data | Convex-backed coach items or explicit local draft |
| Dependency leakage | `@expo/vector-icons` imported everywhere | `ReedIcon` wrapper |
| Growth risk | `.collect()` on time-windowed/growth tables | bounds, pagination, materialized summaries when needed |
| Platform mechanics in features | keyboard/scroll/sheet/drag code in surfaces | hooks and UI primitives |
| Overusing custom code | modals/sheets, simple native controls | targeted Expo UI / RN primitives |
| Underusing custom code | direct third-party chat type shim leaks | stronger local wrapper boundary |

## Expo 56 Features To Use Now Or Later

### Use Now

- Keep running `npm run doctor` after dependency changes.
- Keep using managed Expo/CNG unless a real native requirement appears.
- Keep benefiting from SDK 56 platform upgrades automatically: React Native 0.85, React 19.2, Expo Go support, faster native build improvements, Hermes bytecode diffing, and Expo module improvements do not require app-level rewrites.

### Consider Soon

- `@expo/ui` BottomSheet behind a `ReedSheet` implementation, after `ReedSheet` exists.
- `@expo/ui` Picker, Slider, Switch, Checkbox, or FieldGroup in settings-style UI where native behavior is more valuable than custom styling.
- Expo Router native tabs only if the product moves back toward a conventional native tab bar.
- Type-safe config plugin patterns if app config grows more native concerns.

### Defer

- Broad Expo UI migration. Reed's current UI is intentionally branded and interaction-heavy.
- Replacing the workout metric picker with native picker controls.
- Native tabs migration for the current hidden-tab/custom-dock shell.
- iOS widgets until there is a clear product reason.
- Inline native modules until a clear native capability is missing.
- New file-system APIs unless Reed needs export/import of logs, media, or local artifacts.

## Recommended Work Order

1. Manual Expo Go smoke pass on Android first.
2. Remove `react-native-keyboard-controller` if still unused after smoke testing.
3. Add `ReedIcon` wrapper and migrate imports opportunistically, not in one huge visual churn PR.
4. Add `ReedSheet` and migrate `quick-log`, `add-exercise`, and `session-insights` one at a time.
5. Remove the stale Reed mock runtime props if the live Convex-backed chat path is the only supported path.
6. Move coach items to Convex if they are real product data; otherwise mark them as local prototype state.
7. Revisit `react-native-gifted-chat` types and remove the local shim if upstream supports the current Expo 56 stack.
8. Define the AsyncStorage ownership rule and clean up only caches that duplicate Convex without a clear offline/cold-start reason.
9. Add explicit bounds/pagination to growth-table `.collect()` paths that are not naturally small.
10. Prototype Expo UI in a low-risk settings/profile control before using it in workout-critical flows.

## Bottom Line

The app should not become an Expo UI showcase. Reed's strongest parts are the custom, product-specific interaction surfaces. The engineering problem is not "too much custom UI"; it is repeated low-level platform mechanics mixed into feature files.

The right simplification path is to pull generic mechanics downward into a small number of Reed primitives. After that, Expo UI can be adopted behind those primitives where it actually reduces code and runtime risk.

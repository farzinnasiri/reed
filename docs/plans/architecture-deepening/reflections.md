# Architecture Deepening Reflections

## Step 1 — Set Logging module

Changed:

- Added `convex/workout/setLogging.ts`.
- Moved Live Session Activity insert/patch shape into the Set Logging module.
- Moved Quick Log Activity insert shape into the Set Logging module.
- Centralized bodyweight/effective-load lookup for Live Session Sets and Quick Logs.
- Preserved existing public Convex function names and response shapes.

Validation:

- `npm run typecheck` passed.

Reflection:

- Locality improved: Activity Log write invariants now live behind one backend module instead of being embedded in `sessions.ts` and `quickLogs.ts`.
- Leverage improved: PR/autofill/logging hooks now have a natural Set Logging seam.
- Remaining risk: `deleteSet` still owns renumbering directly; that is okay for this slice because it deletes Activities rather than committing/patching them, but future Session Intelligence will likely want deletion events at this same seam.

## Step 2 — Live Session State projection

Changed:

- Added `convex/workout/sessionState.ts`.
- Moved `getCurrent` projection behavior out of the public query handler.
- Centralized active exercise resolution, timeline row state, capture card shape, rest card shape, live-cardio card shape, and card mode selection.
- Preserved the existing `api.liveSessions.getCurrent` return shape.

Validation:

- `npm run typecheck` passed.

Reflection:

- Locality improved: `sessions.ts` now owns loading and mutations; `sessionState.ts` owns read-model interpretation.
- Leverage improved: PR feedback, shadow autofill, or Planned Session state can now attach to one projection seam.
- Remaining risk: the projection is still Convex-shaped because it uses `Doc` and `Id` types directly. That is acceptable now, but if tests become awkward, the next deepening pass should add plain fixture-friendly input types behind the same interface.

## Step 3 — Recipe semantics

Changed:

- Added concept-level Recipe functions in `domains/workout/recipes.ts`:
  - `prepareRecipeCaptureInput`
  - `prepareLiveCardioInput`
- Replaced capture-card field/default choreography in `convex/workout/sessionState.ts`.
- Replaced live-cardio tracked-metric setup choreography in `convex/workout/sessions.ts`.

Validation:

- `npm run typecheck` passed.

Reflection:

- Locality improved: callers now ask Recipe for prepared input semantics rather than assembling fields/defaults/process shape themselves.
- Leverage improved: future Exercise classes can change recipe preparation in one module.
- Remaining risk: some callers still use lower-level Recipe helpers directly for summary, validation, comparison, and field exposure. This is acceptable because the public behavior is now preserved; the next Recipe pass should continue replacing choreography only where a caller currently knows too much.

## Step 4 — Training History weekly summary

Changed:

- Added `buildWeeklyMuscleStats` to `domains/workout/weekly-muscle-stats.ts`.
- Moved Home weekly-load aggregation out of `convex/homeStats.ts` and behind a pure Training History summary interface.
- Kept `convex/homeStats.ts` focused on auth, loading Activity Logs, loading Exercise metadata, and adapting database rows into the domain input.

Validation:

- `npm run typecheck` passed.

Reflection:

- Locality improved: weekly load math, muscle-group classification, totals, ordering, and labels are now behind one domain module.
- Leverage improved: Home, Reed, and future trend surfaces can reuse the same Training History summary interface instead of reimplementing Activity Log aggregation.
- Remaining risk: Live Session Insights still has its own enriched-set pipeline. Some duplication remains intentionally because Session Insights has richer in-session concepts; a later pass can share lower-level Set facts once we know the stable shape.

## Step 5 — Quick Log Intake

Changed:

- Added `domains/workout/quick-log-intake.ts`.
- Moved Quick Log input validation and metric construction behind `buildQuickLogMetrics` / `getQuickLogInputError`.
- Kept Convex-specific error wrapping in `convex/quickLogs.ts`.

Validation:

- `npm run typecheck` passed.

Reflection:

- Locality improved: Quick Log input semantics now live in a product-domain module instead of inside the Convex mutation file.
- Leverage improved: a future voice Quick Log or Reed Actor write can use the same intake semantics.
- Remaining risk: preset seed definitions still live in `convex/quickLogs.ts`, and the UI still has separate quick-value presets. A later pass can move preset definitions behind the same Quick Log Intake seam if we want full client/server validation parity.

## Step 6 — Add Exercise Search Session

Changed:

- Added `components/workout/use-add-exercise-search-session.ts`.
- Moved exercise search text, selected filters, selected exercise ids, query args, stable-data behavior, filter section options, and reset behavior behind a Search Session hook.
- Kept modal presentation, animation, and visual structure in `workout-add-exercise-sheet.tsx`.

Validation:

- `npm run typecheck` passed.

Reflection:

- Locality improved: the Add Exercise sheet now has a clearer seam between search/selection state and sheet rendering.
- Leverage improved: Routine or Planned Session exercise picking can reuse this Search Session module later.
- Remaining risk: the hook still directly calls the Convex query, so it is a React/Convex adapter rather than a pure domain module. That is acceptable for this frontend seam; if we need isolated tests, query-arg and selection reducers can be pulled inward without changing the sheet interface.


Design invariant cleanup during Step 6:

- Replaced hardcoded sheet glass `rgba(...)` values in `workout-add-exercise-sheet.tsx` with `getGlassPaneTokens(theme)`.
- This was an opportunistic correction while touching the file, aligned with the existing glass token invariant.

Validation:

- `npm run typecheck` passed after the cleanup.

## Follow-up — Training Knowledge direction and test surface

Changed:

- Added Training Knowledge to `CONTEXT.md` as the shared interpretation layer for dashboards, Session Insights, and Reed.
- Added `docs/plans/2026-05-04-training-knowledge-interface-plan.md`.
- Moved Live Session Set deletion/renumbering behind the Set Logging module.

Validation:

- `npm run typecheck` passed.
- `npm run doctor` passed.

Reflection:

- Locality improved: Set create/update/delete lifecycle now crosses the Set Logging seam.
- Leverage improved: future PR ledger and Reed tool adapters have one Activity lifecycle seam to observe.
- Remaining risk: Training Knowledge is documented and partially expressed in weekly summary, but not yet a dedicated `domains/training-knowledge` module. Next slice should move shared meaning there deliberately instead of letting Workout naming leak into Reed-facing concepts.


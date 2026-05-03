# Architecture Deepening Plan

Date: 2026-05-04

Goal: deepen Reed's Workout, Set, Activity, Recipe, Quick Log, and Training History modules so correctness and future Session Intelligence work concentrate behind small interfaces.

## Priorities

1. **Set Logging module**
   - Centralize Activity creation/update invariants for Live Session Sets, live cardio finishes, and Quick Logs.
   - Preserve public Convex function names initially.
   - Correctness center: `activityLogs` shape, recipe metric normalization, derived bodyweight/effective load, source-specific invariants.

2. **Live Session State projection**
   - Extract `getCurrent` state shaping behind a Session State module without changing the query response shape initially.
   - Own active exercise resolution, timeline row states, capture/rest/live-cardio card projection, and card mode selection.

3. **Recipe semantics**
   - Deepen Recipe from registry helpers into concept-level exercise input semantics: prepare, normalize, summarize, classify process, compare.

4. **Training History summaries**
   - Consolidate weekly load and Session Insights calculations around Activity Logs and Exercise metadata.

5. **Quick Log Intake**
   - Centralize preset/input semantics and validation parity around “one Quick Log is one Activity.”

6. **Add Exercise Search Session**
   - Extract search/filter/selection state from the modal presentation.

## Working protocol

For each step:

1. Make a minimal vertical refactor that preserves external behavior unless explicitly approved.
2. Validate with TypeScript and any focused checks available.
3. Reflect on locality, leverage, remaining risk, and whether the next step should change.
4. Continue only after the codebase is in a coherent state.

## Known concurrent processes

At plan creation, `make convex-dev` and `make expo-clean` are running in other terminals. Avoid starting duplicate long-running dev servers from this agent session.

# Training Knowledge Interface Plan

Date: 2026-05-04

## Problem

Reed needs one product meaning layer for dashboards, Session Insights, and Reed AI. Today, activity and status calculations can drift because callers can compute their own versions of weekly load, modality, muscle distribution, body status, or performance bests.

Raw tables are facts. Training Knowledge is the calculated meaning over those facts.

## Constraints

- Backend remains Convex-only.
- No unbounded scans on growth tables.
- All real content remains auth-gated.
- Training Knowledge must be testable through its Interface.
- Reed AI must use constrained programmatic Interfaces, not raw table access.
- Dashboards and Reed must share algorithms and language.

## Dependency categories

- Pure calculation: in-process.
- Convex reads/writes: adapter around indexed or materialized data loading.
- Future LLM tool calling: adapter over Training Knowledge, not the owner of meaning.

## Recommended shape

### Training Knowledge module

A deep module with a small Interface. Callers ask product questions; implementation hides Activity Log shape, Recipe math, body status logic, and future materialized ledgers.

Primary areas:

1. Training History
   - time-window work summaries
   - per-exercise history
   - muscle/modality/load distribution
   - recent activity digest

2. Body Status
   - bodyweight trend
   - latest measurements
   - baseline vs current
   - goals and constraints summary

3. Performance
   - current PRs
   - PR at time
   - PR comparison across dates
   - best sets by exercise and Recipe comparison kind

4. Reed Tool adapter
   - constrained AI-facing tool calls over Training Knowledge
   - no raw arbitrary table query access

## Interface design alternatives

### Design A — Minimal question Interface

A few coarse entry points:

- `answerTrainingQuestion(questionSpec)`
- `summarizeTrainingWindow(window)`
- `comparePerformance(args)`

High Depth, low caller burden. Risk: question specs become a mini-language too early.

### Design B — Capability families

Separate product-question families:

- Training History Interface
- Body Status Interface
- Performance Interface
- Reed Tool adapter

Balanced Depth and clarity. Best fit for Reed because concepts match CONTEXT.md and roadmap.

### Design C — Data cube Interface

Expose dimensions and measures:

- dimensions: time, exercise, muscle group, modality
- measures: sets, reps, volume, duration, distance, PR scalar

Flexible for dashboards. Risk: callers rebuild product language and drift returns.

## Recommendation

Use Design B now, with a tiny shared vocabulary underneath.

Reason:

- Training History, Body Status, and Performance are distinct product concepts.
- Dashboards get stable specific calls.
- Reed tools can compose constrained calls.
- Tests stay readable: each test names a product question.
- Avoids premature generic query language.

## First implementation slice

1. Add test runner.
2. Add tests for existing pure Training History summary behavior.
3. Extend `domains/workout/weekly-muscle-stats.ts` toward a `domains/training-knowledge/training-history.ts` module.
4. Keep Convex functions as adapters.
5. Do not add Reed AI tools until PR and body-status questions have stable module Interfaces.

## Future Convex indexes / ledgers likely needed

- Activity Log by profile + exercise + loggedAt.
- Materialized PR ledger by profile + exercise + comparison kind + effectiveAt.
- Body measurement trend already has profile + metric + observedAt.


# Reed actions on a Live Session

Status: draft for Farzin's approval. No implementation is authorised by this document.

## Problem and permission boundary

The mockup's swap card should let the user ask Reed for a concrete session change, inspect it, and apply it once. Reed can explain and propose today. Writing session structure is Actor capability under `CONTEXT.md`, beyond the current Observer/Commenter rollout.

Proposed v1: explicit user requests can produce an owned, expiring session-action proposal. The proposal changes nothing until the user taps its specific confirmation button. A widget or conversational reply never grants write permission. Actor capability must be enabled server-side, scoped to the viewer and approved operation kinds; normal Convex auth and session ownership apply on proposal and confirmation.

**Decision A1:** Approve Actor capability for session structure only. Recommendation: no Activity Log writes, profile updates, finishing a session, or destructive history changes in v1.

## Actions and confirmation UX

Start with swapping one unlogged Session Exercise for a supported catalog Exercise. The card shows "Swap bench press for dumbbell press", the affected Live Session and the proposed target defaults, with "Apply swap" and "Keep current exercise". The model supplies references and intent; the client queries the proposal and displays authoritative data. A generic "yes" reply chip is not confirmation.

Proposed follow-ups, only if approved: add an Exercise, remove an unlogged Exercise, and reorder Exercises. Each proposal contains one bounded change. After confirmation the card shows the applied result and the Workout module refreshes through its subscription. Until then the user can continue logging normally. If the proposal is stale, show why it cannot apply and offer to request a fresh proposal; do not regenerate or mutate silently.

**Decision A2:** Choose the initial operations. Recommendation: swap only. Do not expose the existing `removeExercise` mutation directly to Reed because it can delete Activity Logs.

**Decision A3:** Approve explicit button confirmation and a five-minute proposal lifetime. Recommendation: every proposal needs confirmation; reject or expiry makes no session change. If undo is offered later, it must revalidate current state rather than overwrite subsequent user edits.

## Proposed contract and persistence

Widget: `{ kind: 'session_change', actionId: Id<'reedSessionActions'> }`. Store references only in the message. The action record holds owner, exact Live Session id, source Reed message, typed operation, affected Session Exercise ids/catalog ids, expected session revision, proposed target defaults, rationale, status `pending | applied | rejected | expired`, expiry and created/resolved UTC timestamps. Lists are indexed and bounded. Keep proposal data separate from chat prose.

Use an authenticated confirmation mutation such as `confirmSessionAction({ actionId })`, plus rejection and owned-read operations. Confirmation derives the viewer from auth and resolves the saved typed intent. It never accepts arbitrary model arguments from the client. In one transaction it checks Actor permission, owner, pending state, expiry, exact active session, expected revision, catalog support and affected Exercise safety, then applies the structure change and records the result. Repeating confirmation on an applied action returns its existing result.

Existing `workout/sessions` operations cover add, remove, reorder and select, but there is no safe swap operation today. Proposed implementation: extract or reuse mutation-local structure logic and add a guarded swap operation under the same Workout boundary. A swap preserves position, selects the replacement when appropriate, and refuses any Exercise with Activity Logs, active live cardio or an associated rest process. No delete-and-recreate shortcut through public mutations.

**Decision A4:** Approve a session structure revision incremented by every relevant user and Reed write, including activity/timer changes that affect proposal safety. Recommendation: reject stale proposals instead of merging concurrent edits. This requires a separate implementation audit of all write paths.

## Audit and failure handling

An applied action records user confirmation time, proposer Reed message/model-contract version, applying viewer, operation, expected/actual revision, and compact before/after structure and target values. Record only the action evidence needed to explain the change. A user-confirmed Reed action is labelled distinctly from a direct Workout edit. Audit creation and the session change commit atomically; tracing failure must not roll back or repeat an applied action.

Failure paths: unauthenticated/foreign ids or disabled Actor capability reject; ended/replaced sessions, new Sets, timer changes, missing catalog entries and expiry invalidate; network timeout is resolved by reading action status before retry. The model cannot repair these by invoking another write. Invalid proposals degrade to normal coaching text. Background coach notes cannot trigger actions.

**Decision A5:** Approve audit retention and visibility. Recommendation: expose a compact "Changed by Reed, confirmed by you" record on the action card; defer a general Activity Log edit-history system.

## Acceptance

Verify that proposals alone change nothing; an explicit confirmation applies one allowed change once; foreign ownership and disabled capability fail; concurrent user logging causes a safe rejection; performed Activity Logs and live timers remain intact; retries after lost responses are idempotent; rejected/expired proposals cannot apply; audit and session state agree. Browser and Android QA must confirm clear, reachable confirmation controls without interrupting the existing Set logging loop.

## Decisions (2026-10-02, orchestrator under Farzin's delegation)
- **A1:** approved: Actor capability for session structure only; no Activity Log writes, profile updates, finishing sessions or destructive history changes.
- **A2:** approved: swap only, and only for an exercise with no logged sets. Reed never calls `removeExercise`.
- **A3:** approved: explicit confirmation on every proposal; five-minute lifetime; rejection or expiry changes nothing; no undo in v1.
- **A4:** approved: a session structure revision bumped by every relevant write; stale proposals are rejected, never merged. Audit every write path first.
- **A5:** approved: "Changed by Reed, confirmed by you" on the action card; no general edit-history system.
- **Order:** implement after Planned Sessions.

# Planned Sessions

Status: draft for Farzin's approval. No implementation is authorised by this document.

## Problem and proposed scope

The mockup's "Upper body today" card should represent a real Planned Session: a pre-authored Workout Session with exercise targets. "Start upper body" should prepare a Live Session that the user can log through the existing Workout module. A Routine is a reusable template and remains deferred.

Proposed v1: Reed creates one Planned Session when the user asks for a workout. It uses the Training Profile, equipment, constraints, recent Training Knowledge and supported Exercise catalog entries. Each planned Exercise contains ordered Set targets appropriate to its class: load/reps for strength, duration for holds, and distance/duration for cardio. Reed may explain a choice, but cannot record performed work or silently change the plan after the user starts it.

**Decision P1:** Approve request-driven planning only for v1, or also allow unsolicited plans? Recommendation: request-driven. A daily opener and automatic scheduling are separate gated work.

## User flow

1. The user asks Reed for a session. Reed returns coaching text and a `plan` widget referencing a saved Planned Session. The widget queries its current title, exercises, targets and availability.
2. The user can inspect and edit the plan before starting. Proposed editable fields: title, intended date, exercise selection/order, Set count, target load/reps/duration/distance and rest guidance. Dismissal removes it from current suggestions without deleting history.
3. "Start upper body" creates the Live Session and its Session Exercises atomically, with target defaults copied from the approved plan revision. Planned Sets are guidance; no Activity Logs are created until the user logs performed work.
4. The existing capture, rest and live-cardio UX remains the logging path. Actual values may differ from targets. The user can add, remove and reorder exercises as today.

If a Live Session already exists, show "Continue current session" and leave both sessions unchanged. Repeated taps return the same resulting Live Session. Offline or failed starts keep the plan available and show a retry. After starting, edits affect the Live Session only; the source plan is frozen for that start.

**Decision P2:** Approve these edit controls and the active-session rule. Recommendation: no merge, replacement or second simultaneous Live Session in v1.

## Proposed data and API

One `plannedSessions` table, owned by `profileId`, indexed by owner/status/intended time. Proposed fields: title, optional `scheduledForAt`, status `ready | started | dismissed`, revision, ordered exercises, optional resulting `liveSessionId`, creator `reed | user`, and created/updated UTC timestamps. Store bounded arrays, proposed maximum 12 exercises and 8 target Sets per exercise. Each entry references an `exerciseCatalogId`; its targets use the existing class/recipe validators. All timestamps are UTC. Day labels and scheduling boundaries use the viewer's stored IANA timezone at read time.

Add source Planned Session id/revision to the resulting Live Session and bounded target defaults to its Session Exercises. Targets are separate from performed Activity Logs, so Training Knowledge, PRs and weekly activity do not count planned work. Exercise names/availability resolve from the catalog. Revalidate ownership, supported class, constraints and numeric ranges at save and start; never trust model output directly.

Proposed authenticated operations: owned read/list, create/update/dismiss, and `startPlannedSession({ plannedSessionId, expectedRevision })`. The start mutation checks ownership, revision, current active session and catalog validity in one transaction, then writes the Live Session, children and started link. No separate API runtime.

Widget contract: `{ kind: 'plan', plannedSessionId: Id<'plannedSessions'> }`. The payload contains one reference, no copied targets or presentation. Unknown/deleted/foreign plans render nothing. Started plans offer the resulting session instead of another start. Creation requires the Planner phase to be approved; the widget itself grants no permission.

**Decision P3:** Approve the data limits and single-use plan model. Recommendation: reuse belongs to a later Routine design.

**Decision P4:** What should happen when travel moves the intended day, or a catalog entry becomes unavailable? Recommendation: display the scheduled UTC instant in the current timezone, require repair before start, and never silently substitute an Exercise.

## Acceptance and remaining decisions

Acceptance: an owned plan starts exactly one correctly prefilled Live Session; logging remains unchanged; no performed work exists before capture; concurrent starts/edits cannot apply a stale revision; existing ad-hoc sessions remain supported; errors preserve the plan. Verify mixed Exercise classes, active-session conflicts, empty/deleted catalog entries, retries and ownership rejection.

**Decision P5:** Choose how v1 target values are derived and what the user must review. Recommendation: grounded recent-performance defaults with visible targets before start, no automatic load progression or medical interpretation.

**Decision P6:** Approve adding Planner capability. Planned Sessions and Routines are explicitly deferred in `CONTEXT.md`; approval of this PRD should authorise a separately scoped implementation brief, not imply that either feature is shipped.

## Decisions (2026-10-02, orchestrator under Farzin's delegation)
- **P1:** request-driven only. Reed creates a plan when the user asks (or accepts an offer in chat); no unsolicited plans or scheduling in v1.
- **P2:** no merge, replacement or second Live Session; "Continue current session" when one is open. **Simplification:** v1 has no manual plan editor. Plans are edited by talking to Reed ("Make it shorter", "Swap bench"), which writes a new revision of the same plan. The user can dismiss a plan. A manual editor is a later decision driven by usage.
- **P3:** approved: single-use plans, 12 exercises × 8 target sets max. Reuse belongs to Routines (deferred).
- **P4:** approved as recommended: show the scheduled instant in the current timezone; unavailable catalog entries block start until Reed repairs the plan; never silently substitute.
- **P5:** approved: targets come from recent performance, are visible on the card before start, with no automatic load progression and no medical interpretation.
- **P6:** Planner capability approved for Planned Sessions only (not routines, goals or profile writes).

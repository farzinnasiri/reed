# Reed — Context

A fitness operating system. End-to-end simplicity. The user logs; the system handles the rest.

---

## Reed (Product)

The brand and product. An adaptive instrument panel — not a tracker, not a community app, not a dashboard. The brand persona is **Reed**, an AI coach with access to the user's complete training data.

> **Product / UX work:** Read `DESIGN-PRINCIPLES.md` before any product discussion, UX critique, or design decision. It defines how Reed should feel, sound, and behave.

---

## Surfaces

Workout and Reed are modules: deep, stateful, and domain-heavy. Home is the Pulse, the thread, and the dock. The You sheet holds identity, body, goals, and preferences. Layout chrome (the Pulse, the You button, the dock) is the floating edge of Home, documented in `DESIGN.md` as `chrome-gutter`.

| Surface | Kind | What it is |
|:--------|:-----|:-----------|
| Workout | Module | Session logging, rest timers, live cardio, insights |
| Reed | Module | The coaching thread. Today opens with Reed as the hero; chat is that same thread once you talk. |
| Home | Module | The Pulse and the thread, with the dock. Tapping the Pulse opens Progress. |
| You | Sheet | Account identity, body, goals, Training Profile, and preferences. |

> **Rule:** A surface with internal pages, sheets, or complex local state is a module.

---

## User Subdomain

A shared subdomain, not just auth. Read by Workout, Reed, and analytics.

| Layer | Data | Stored In |
|:------|:-----|:----------|
| Identity | Email, name, avatar, onboarding state | `profiles` |
| Fitness status | Baseline, constraints, recovery | `trainingProfiles`, `bodyMeasurements` |
| Performance anchors | Strength/cardio benchmarks | `strengthAssessments`, `cardioAssessments` |
| Goals | Training-day and exercise targets | `trainingTargets` |
| Training history | All logged activities, PRs, trends | `activityLogs` |

---

## Profile

The user's identity and user-related state. The surface is the You sheet. It includes account identity, body, goals, Training Profile, high-level Training Knowledge, and preferences.

> One `profile` has exactly one `trainingProfile`.
>
> Settings are a utility inside You, not a primary surface.

---

## Training Profile

The structured fitness persona — past, current, and future. Created from onboarding and other sources.

Onboarding now stores its actual answers in `trainingProfiles.onboarding`: practices with experience level, ordered motivations, consent, body basics and visual shape, discomfort region IDs and severity, recovery, week availability, coaching rhythm and optional typed or transcribed coach notes. It does not collect equipment, exact birthday, measured body-fat percentage, concrete goals or event dates. All development profiles now contain only this onboarding object and metadata; legacy onboarding fields, estimates and temporary migration endpoints have been removed. App access requires `profiles.onboardingVersion === 2` and a completion timestamp (`onboardingCompletedAt`). See `docs/onboarding.md` for the completed development migration.

---

## Workout Module

The module where training happens. Contains session types and supporting surfaces.

### Session Types

| Term | Definition |
|:-----|:-----------|
| **Workout Session** | Any instance of training. Umbrella term. |
| **Live Session** | The active training execution, either started empty or populated from a plan. It owns logged sets and running rest/cardio processes. |
| **Planned Session** | A proposed workout with exercises and targets. Starting a plan creates a Live Session. |
| **Plan Revision** | The version of a planned session. Starting requires the reviewed revision; the live session records its source plan and revision. |
| **Routine** (future) | Reusable template. |

> **Code debt:** "Workout" and "live session" are used inconsistently in file names and schema.

---

## Session → Exercise → Set → Activity

The canonical performance hierarchy:

| Level | User Term | Data Model |
|:------|:----------|:-----------|
| Session | "session" / "workout" | `liveSessions` |
| Exercise | "exercise" | `liveSessionExercises` |
| Set | "set" | `activityLogs` |
| Activity | — | `activityLogs` (table) |

> A **Set** is what the user performs. An **Activity** is the system record.

---

## Quick Log

A one-off activity logged outside a session. Creates an `activityLog` with `source: 'quick_log'`.

> **Every quick log is implicitly one set of one exercise.**

---

## Exercise

Any movement in the catalog. Universal schema with class-specific characteristics:

| Class | Behavior |
|:------|:---------|
| `strength` | Load + reps + RPE, rest timer |
| `hold` | Duration + RPE, rest timer |
| `cardio-manual` | Distance + duration, no timer |
| `cardio-live` | Live-tracked, real-time tracker |

> All exercises have metadata (muscle groups, patterns, equipment) where applicable.

---

## Recipe

Implementation detail. Defines input fields for an exercise. Not user-facing.

---

## Set Editing

Current: in-place mutation. **Open decision:** whether to preserve edit history.

---

## Activity Log Ownership

| Concern | Owner |
|:--------|:------|
| Training history (immutable facts) | User subdomain |
| Session structure (order, rest, context) | Workout module |
| Quick logs (no session) | User subdomain |

---

## Training Knowledge

The product meaning derived from User subdomain facts. Training Knowledge is the shared interpretation layer for dashboards, Session Insights, and Reed.

Sources:

- `activityLogs` for performed work
- `bodyMeasurements` for body status trends
- `trainingProfiles` for constraints and baseline
- `trainingTargets` for goals
- `strengthAssessments` / `cardioAssessments` for anchors
- future PR ledgers for materialized performance bests

Rules:

- Dashboards and Reed should not reimplement training math independently.
- Activity Logs are facts; Training Knowledge is the calculated meaning.
- Reed should ask constrained Training Knowledge questions, not inspect raw tables directly.
- Time-window and exercise-specific queries must use indexed or materialized paths.

Example questions:

- “What did the user do in the past week?”
- “How has bodyweight changed in the past 3 months?”
- “What was the Squat PR two weeks ago, and what is it now?”

---

## Personal Record (PR)

Computed at read time from activity logs. A stored PR ledger is a later decision, not current behavior.

---

## Reed (AI Coach)

Cross-cutting service and persona. Read access to the user's training data, plus the writes below.

| Capability | Where it stands |
|:-----------|:----------------|
| Observer | Shipped. Reed reads Training Knowledge, the thread, and the journey snapshot. |
| Commenter | Shipped. Session feedback and outreach write coaching notes. |
| Planner | Planned sessions and revisions are shipped. Routines are not. |
| Actor | An exercise swap inside the live session exists behind `REED_SESSION_ACTOR_PROFILE_IDS`. Chat does not write activity logs or profile fields. |

### Voice Input

First-class modality. User speaks natural language from any surface.

### Private Coaching Memory

Reed should move from reactive answer generation to session-based coaching. It should maintain private coaching memory that helps it understand the user as an athlete/client, not just as a set of workout logs.

Core private memory concepts:

| Concept | Definition |
|:--------|:-----------|
| **Coach Mental Model** | Reed's compact working model of who the user is as an athlete/client: identity, preferences, friction points, coaching relationship, and broad priorities. |
| **Coaching Journey** | A durable coaching vector where the user is trying, explicitly or repeatedly, to become different over time. |
| **Session Agenda** | Reed's own short turn-to-turn coaching checklist for the active conversation: questions to ask, checks to complete, decisions to make, or actions to drop once done. |

Private coaching journeys are not UI chat threads. They are internal vectors such as wakeboarding skill, calisthenics body control, strength base, endurance for hiking/snow sports, nutrition/body composition, or other durable directions of change. The table is `reedCoachingJourneys`.

**Journey snapshot** (`reedJourneySnapshots`) is a different object: a factual read of onboarding, recent training, watchouts, and anchors. Reed, session feedback, outreach, and coaching memory read its `renderedContext`. New snapshots omit scores. Older snapshots may still store an optional `signals` object; that field stays in the schema. The baseline still records `equipment: []` because onboarding does not collect equipment. Body-fat percentage appears only when a `bodyMeasurements` row has it. Record highlights inside the snapshot are still computed at read time.

Rules:

- Broad working model first, relevance second. Reed should keep the whole athlete in view, not only the current keyword.
- Coaching journeys are private for now, but should be product-grade enough to expose later if needed.
- Strong and recent coaching journeys can influence a session even when not directly named, because training vectors affect each other.
- Weak or stale coaching journeys should decay out of prompt retrieval and archive rather than keep leaking into unrelated chats.
- A temporary injury, one-off emotion, or passing curiosity is not automatically a coaching journey. It can be an event inside one.
- Session agenda items are not durable facts. Reed revises them every turn, deletes completed items, and can leave the list empty.
- Coach state is posture: warmth, pressure, trust repair, directness, certainty, and depth. It should not carry all durable memory responsibilities.

---

## Notifications

Rest alerts belong to the active session and remain scheduled across screen navigation. Remote Reed updates use authenticated, installation-specific Expo push registrations and profile notification preferences. Sign-out revokes the installation before ending authentication; delivery is still subject to the backend's notification intent and preference rules.

---

## Goals

Living and user-editable. They are separate from the onboarding snapshot. Some have timelines.

A training-day goal counts distinct local days. New goals use metric kind `trainingDays` and the unit `days`. `sessionCount` is the legacy alias for the same count, and both display as days. An exercise goal names an exercise. A training-day goal does not.

---

## Ended Live Session Lifecycle

Persisted in database. **De-emphasized in UI.** User sees insights, not raw session replays.

---

## Plans, Routines, and Templates

Planned sessions and their revisions are implemented. Statuses are `ready`, `started`, and `dismissed`. Plan authoring and starting are owned by `convex/plannedSessions.ts`; execution is owned by the live-session functions. If a live session already exists, starting a plan offers continuation of that session instead of creating another.

Finishing a planned session that logged nothing puts the plan back to `ready` and clears `liveSessionId`. Dismissal is a separate action. An empty ad-hoc session, with no source plan, is deleted.

A logged finish leaves the plan `started`, with `liveSessionId` still pointing at the ended session. Starting that plan again returns that session id. A finished session remains historical evidence, independent of later plan edits.

Reusable routines and templates remain future concepts. Do not treat a mutable plan as a reusable template without defining that behavior.

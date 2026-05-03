# Reed — Context

A fitness operating system. End-to-end simplicity. The user logs; the system handles the rest.

---

## Reed (Product)

The brand and product. An adaptive instrument panel — not a tracker, not a community app, not a dashboard. The brand persona is **Reed**, an AI coach with access to the user's complete training data.

> **Product / UX work:** Read `DESIGN-PRINCIPLES.md` before any product discussion, UX critique, or design decision. It defines how Reed should feel, sound, and behave.

---

## Modules vs Chrome

Reed surfaces are either **modules** (deep, stateful, domain-heavy) or **chrome** (shallow, navigational, configurational).

| Surface | Kind | Rationale |
|:--------|:-----|:----------|
| Workout | Module | Deep session logging, rest timers, live cardio, insights |
| Chat / Reed | Module | AI coaching interface |
| Home | Chrome | Launcher/dashboard |
| Settings | Chrome | Preferences, user account |

> **Rule:** A surface with internal pages, sheets, or complex local state is a module.

---

## User Subdomain

A shared subdomain, not just auth. Read by Workout, Reed, and analytics.

| Layer | Data | Stored In |
|:------|:-----|:----------|
| Identity | Email, name, avatar, onboarding state | `profiles` |
| Fitness status | Baseline, constraints, recovery | `trainingProfiles`, `bodyMeasurements` |
| Performance anchors | Strength/cardio benchmarks | `strengthAssessments`, `cardioAssessments` |
| Goals | Primary goal, details, priorities | `trainingProfiles` |
| Training history | All logged activities, PRs, trends | `activityLogs` |

---

## Profile

The user's identity and account. Equivalent to a `users` table.

> One `profile` has exactly one `trainingProfile`.

---

## Training Profile

The structured fitness persona — past, current, and future. Created from onboarding and other sources.

---

## Workout Module

The module where training happens. Contains session types and supporting surfaces.

### Session Types

| Term | Definition |
|:-----|:-----------|
| **Workout Session** | Any instance of training. Umbrella term. |
| **Live Session** | Ad-hoc session started empty, built exercise-by-exercise. Only type implemented. |
| **Planned Session** (future) | Pre-authored workout with targets. |
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

## Personal Record (PR)

Current: computed at read time. **Future:** computed on write/update and stored.

---

## Reed (AI Coach)

Cross-cutting service and persona. Read/write access to user data. Phased rollout:

| Phase | Capability |
|:------|:-----------|
| Observer | Read all data, surface insights |
| Commenter | Write coaching notes, feedback |
| Planner | Write training plans, routines, goals |
| Actor | Write activity logs, profile updates, sessions |

### Voice Input

First-class modality. User speaks natural language from any surface.

---

## Notifications

**Open decision.** Rest timer alerts exist. Reed coaching nudges undefined.

---

## Goals

Living, user-editable. Not locked to onboarding snapshot. Some have timelines.

---

## Ended Live Session Lifecycle

Persisted in database. **De-emphasized in UI.** User sees insights, not raw session replays.

---

## Routines, Templates, Planned Sessions

**Deferred.** Not yet defined. Will be designed when built.

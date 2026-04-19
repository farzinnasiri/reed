# Reed PRD: Live Session Workout Logging

## Status

- Date: 2026-04-19
- Scope: current product definition for the **live session** workout flow
- Out of scope for now: planned workouts, programming engine, PR detection logic, analytics, coaching adaptation logic

## 1. Product Intent

Reed should make workout logging feel fast, low-friction, and structurally simple while still handling real training behaviour:

- bodybuilding
- calisthenics
- holds
- cardio
- unilateral work
- mixed sessions that jump between all of the above

The core promise is simple:

**The user performs the work first, then records it quickly.**

Reed must not force a rigid workout model onto a chaotic real-world session. The user may know the whole workout up front, may add exercises as they go, may bounce between exercises, and may return to the same exercise multiple times across the same session.

## 2. Scope Boundary

### Current scope: live session

This PRD defines the experience where the user starts an empty live session and builds it as they train.

Key assumptions:

- the session starts empty
- the user can add exercises before or during the session
- exercises stay in intended order in the timeline
- the user can open any exercise at any time
- sets are logged after being performed
- there is no concept of "exercise complete"
- only the session itself eventually ends

### Future scope: planned session

Planned sessions will be added later.

They should feel closely related to live sessions, but they are a different domain mode:

- exercise order may already exist
- planned sets and targets may already exist
- the system is comparing actual execution against a pre-authored structure
- logging is less ad hoc and more confirm/edit/complete

This PRD should therefore be read as the foundation for the **live session** case, not the final design for the planned-session case.

## 3. Domain-Driven Design View

### Ubiquitous language

- **Session**: one live workout container with a start time, elapsed time, timeline, and one active context
- **Timeline**: the intended-order list of exercises in the current session
- **Exercise**: a movement instance added to the session timeline
- **Card**: the active capture surface for the currently selected exercise
- **Set log**: one recorded effort entry for an exercise
- **Metric recipe**: the schema that defines which fields a card/set uses for a given exercise
- **Active context**: the single thing Reed considers current right now
- **Active process**: a running timer/tracker attached to the active context
- **Rest timer**: the optional post-set timer
- **Live tracker**: the optional in-card tracking mode for cardio
- **Warm-up**: explicit user-marked set metadata
- **PR**: a system-detected insight, not user-entered logging data

### Bounded contexts

#### 1. Session Runtime

Owns:

- session lifecycle
- elapsed time
- active context
- background continuation while app remains open

#### 2. Exercise Catalog

Owns:

- exercise library
- exercise search
- tags, muscle groups, equipment, categories
- default metric recipe selection

#### 3. Logging Engine

Owns:

- set creation
- card schemas
- field values
- warm-up marking
- unilateral left/right handling
- timer handoff after logging

#### 4. Insights Layer

Owns later:

- PR detection
- suggested values
- progression hints
- comparisons to prior performance

This separation matters because the logging engine must remain simple even if the insight layer becomes sophisticated later.

## 4. Core Product Rules

1. A session has exactly **one active context at a time**.
2. A session may contain many exercises, but there is never more than one active process at once.
3. Intended timeline order is fixed unless explicitly reordered by the user.
4. The user may log exercises in any real-world order regardless of timeline order.
5. There is no "exercise done" state.
6. Sets are logged after performance, not before.
7. The active card shell stays consistent across exercise types.
8. The internal card fields are dynamic and come from the exercise's metric recipe.
9. If the app remains open, running timers/trackers/session time continue in the background.
10. PR is inferred by the system later and should not create logging friction now.

## 5. Primary Interaction Model

### Workout tab structure

The workout tab has two primary surfaces:

1. **Timeline**
2. **Active card**

### Timeline

The timeline is a compact vertical list of exercises.

Each row should show:

- exercise name
- last logged set as the main secondary line
- set count
- lightweight state badge if relevant, such as `active` or `resting`
- optional type hint if useful

Examples of the secondary line:

- barbell: `60 kg × 8 · RPE 8`
- bodyweight reps: `8 reps · RPE 8.5`
- hold: `35s · RPE 8`
- weighted hold: `35s + 5kg · RPE 8`

The row is tappable and opens that exercise's active card.

The timeline also contains the session-level add action for inserting more exercises.

### Active card

The active card is the main logging surface.

The card header should contain:

- exercise name
- warm-up chip
- subtle previous-set reference

The card body contains dynamic fields from the metric recipe.

The card footer contains the main logging action:

- **swipe right = log set**

After logging:

- the set is saved
- the rest timer opens automatically

## 6. Rest Timer Behaviour

The rest timer is part of the main loop, but it must not trap the user.

Rules:

- after logging a set, rest timer opens automatically
- when the timer ends, it stays on screen and waits for the user
- it should ring/vibrate/notify, but it should not navigate automatically
- the user can return to the current card or go back to the timeline
- the rest timer can keep running in the background while the app remains open

The timer is a workflow convenience, not a workflow prison.

## 7. Exercise Addition Flow

Adding an exercise should be fast and flexible.

The add flow should be a sheet or equivalent quick-add surface with:

- recent exercises
- favourites
- search by name
- search/filter by muscle group
- search/filter by equipment
- search/filter by tags such as cardio, dumbbell, cable, bodyweight

Exercise type should be determined automatically from the library entry.

Longer term, the system can support editing/correcting the inferred recipe, but the default live-session flow should be zero-friction.

## 8. Metric Recipe Model

The correct abstraction is not rigid exercise categories. It is a **composable metric recipe**.

Each exercise is associated with a recipe that determines which fields exist in the card and in the logged set.

### Current recipe examples

#### Standard bilateral load

- load
- reps
- RPE

Examples:

- bench press
- squat
- machine chest press

#### Dumbbell pair

- load per hand or paired dumbbell load
- reps
- RPE

#### Bodyweight reps

- reps
- RPE

The user's stored bodyweight may exist in settings and support later insights, but it should not clutter the fast logging flow by default.

#### Assisted or weighted bodyweight

- added load or assist load
- reps
- RPE

Examples:

- weighted pull-up
- assisted dip

#### Hold

- duration
- RPE

Examples:

- plank
- handstand hold
- dead hang

#### Weighted hold

- duration
- load
- RPE

Examples:

- weighted plank
- loaded carry hold

#### Unilateral pair set

- left-side values
- right-side values
- optional shared reps depending on exercise
- RPE

Examples:

- single-arm cable row
- single-arm dumbbell press
- split work where both sides are completed before logging

Important rule:

- one Reed set = both sides completed
- L/R switching happens inside the card
- log happens once after both sides are entered
- rest begins only after the bilateral pair is complete

#### Cardio manual

- time
- distance
- pace, speed, calories, or subtype-specific field when relevant

#### Cardio live tracking

- same card shell
- live internals
- tap controls only while tracking is running
- no swipe logging while actively tracking

## 9. Dynamic Card Principles

The card shell stays stable. The internals change.

Stable parts:

- same overall layout
- same visual identity
- same card selection model
- same set logging mental model

Dynamic parts:

- which fields exist
- whether there is an L/R switch
- whether the card is in live tracker mode
- which previous-set hint is shown
- how the last-set summary is expressed

This is important because Reed must feel coherent even though the exercise space is messy.

## 10. Guidance and Suggestions

The system should eventually reduce cognitive load by suggesting values based on:

- previous performance
- current set number
- current exercise
- likely progression

Suggested values should appear as dim/default inputs, not as modal interruptions.

This guidance layer is important, but it is secondary to getting the core live-session interaction right.

## 11. Metadata Rules

### Explicit now

- warm-up marker
- RPE

### Inferred later

- PR detection
- progression flags
- comparison against previous sessions
- fatigue/performance insights

The logging flow should collect only what creates strong value with low friction.

## 12. Background Runtime Rules

If the app has not been closed:

- session elapsed time continues
- rest timers continue
- live cardio tracking continues

If the user leaves the active card and returns to the timeline:

- the running process keeps going
- the relevant timeline row must reflect that live state

The product should treat the session as a living runtime, not as a static form.

## 13. States

### Session

- not started
- live
- ended

### Exercise row

- idle
- active
- resting
- has logged work
- live tracking

### Card

- capture mode
- rest timer mode
- live cardio mode

These are runtime states, not lifecycle promises about the exercise being finished.

## 14. Non-Goals for the First Version

- planned workouts
- advanced PR detection logic
- adaptive coaching intelligence
- deep analytics
- multi-process active runtime
- complex reordering automation
- excessive detail/history on the active card

## 15. Long-Term Flexibility

The data model and card system should assume more recipe types will arrive later.

Examples of future extension:

- tempo work
- interval cardio structures
- AMRAP / EMOM / circuit formats
- distance-based carries
- assisted stretches or mobility holds
- machine-specific fields
- sport-specific drills

The right long-term design is therefore:

- one session model
- one timeline model
- one card shell
- many metric recipes

## 16. Prioritised Delivery Plan

### P0: core live-session foundation

1. Define domain model for session, exercise, set log, active context, and active process.
2. Build workout tab shell with timeline + active card.
3. Add empty live session start flow.
4. Add exercise insertion flow with recent/favourites/search/filter.
5. Implement fixed intended-order timeline.
6. Implement opening any exercise from the timeline.
7. Implement standard logging card shell.
8. Implement swipe-right set logging.
9. Implement previous-set hint on card.
10. Implement warm-up chip.
11. Implement RPE as a first-class card field.

### P1: flexible metric recipes

12. Implement recipe system for:
    - bilateral load + reps + RPE
    - bodyweight reps + RPE
    - assisted/weighted bodyweight
    - hold
    - weighted hold
13. Implement timeline row summary formatting per recipe.
14. Implement dynamic card internals while preserving one shell.
15. Implement session row states: active, resting, has logged work.

### P1.5: unilateral support

16. Implement L/R switching within the card.
17. Make one logged set represent both sides completed.
18. Support unilateral summary formatting and previous-set guidance.

### P2: rest/runtime behaviour

19. Implement auto-opening rest timer after set logging.
20. Keep timer passive when complete; do not auto-navigate.
21. Support timer continuation while app stays open and user navigates back to timeline.
22. Reflect active timer state in the timeline.
23. Ensure only one active process exists at a time.

### P3: cardio foundation

24. Implement manual cardio logging recipe.
25. Implement live cardio mode inside the same card shell.
26. Use tap controls only while live cardio tracking runs.
27. Allow live cardio tracking to continue in background while app stays open.
28. Reflect live cardio state in the timeline.

### P4: guidance and intelligence

29. Add dim suggested values based on recent performance and likely next set.
30. Add system-detected PR logic.
31. Add richer comparisons and session insights.

### P5: planned-session extension

32. Define planned-session domain additions.
33. Reuse live-session shell where possible.
34. Add pre-authored set targets and comparison logic.
35. Separate ad hoc logging from planned completion semantics without splitting the product into two unrelated experiences.

## 17. Engineering Notes

- Model exercise behaviour through recipe/schema composition, not UI branching spaghetti.
- Keep the logging engine separate from the insights layer.
- Treat timers/trackers as runtime processes owned by the session runtime.
- Maintain one active context only.
- Preserve room for future planned-session semantics without polluting the first live-session version.

## 18. Success Criteria

The first version is successful if a user can:

1. start an empty session quickly
2. add exercises quickly
3. jump between exercises freely
4. log sets faster than in mainstream workout trackers
5. use the same product for bodybuilding, calisthenics, holds, unilateral work, and simple cardio
6. understand what is active right now without confusion
7. never feel trapped by rigid structure

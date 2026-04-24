# Reed PM / Product Design Onboarding Report

Date: 2026-04-23

Purpose: establish a working product model for future design and PM decisions so each new task does not start from zero.

## Current product read

Reed is not a generic fitness app. The codebase is already pointing toward a serious workout logger whose main advantage should be fast, low-friction session execution under fatigue.

The current live app structure is:

- Auth-gated entry with email/password as the practical default and Google as a dev-build path.
- Signed-in shell with four modes: `home`, `workout`, `chat`, `settings`.
- `workout` is clearly the primary product surface.
- `home` is a light staging area: greeting, start/continue session, weekly load board.
- `chat` is currently a placeholder concept, not a real product surface.
- `settings` is mostly account/theme management.

## Product model

The strongest product idea in the codebase is the live workout loop:

1. Start or resume a session.
2. See the current exercise and current set immediately.
3. Log by swipe, not by form-submit ceremony.
4. Enter a real rest state with timer controls.
5. Move between exercises through a timeline that reflects actual work done.
6. Finish cleanly and review useful session insight.

That is the product. Everything else is support.

This is reinforced by the implementation:

- The workout surface owns the active session state and hides the bottom dock during live training.
- Capture, rest, and live-cardio are treated as distinct modes of the same workout experience.
- Add-exercise is biased toward recents, favorites, and filtered search, which is the right direction for speed.
- Mixed training is a first-class concept in the data model: barbell, dumbbell, unilateral, timed holds, bodyweight, and live cardio all exist in the workout recipe system.

## What is already strong

### 1. The team has chosen the right center of gravity

The app is not pretending the dashboard is the product. The workout surface is the product.

### 2. Rest is treated as part of training, not dead space

The rest card, ring, presets, and swipe affordances are the right mental model. Rest is an active state between work, not a modal nuisance.

### 3. The session architecture respects real training diversity

The schema and recipe layer suggest the product can support mixed workouts without forcing everything into one strength-template shape. That matters.

### 4. The app is already opinionated in useful ways

Swipe to log, active session continuity, exercise ordering, and favorites/recents all reduce decision cost in the gym.

## Main product/design risks

### 1. Navigation currently overstates the importance of surfaces that are not real yet

The shell gives equal navigational weight to `home`, `workout`, `chat`, and `settings`, but only one of those surfaces is truly core right now. `chat` is explicitly placeholder copy, yet it occupies primary-nav real estate. That weakens the product story.

Evidence:

- `SignedInShell` renders a primary tab for `chat`.
- The placeholder copy says coaching is where it "will live" and that the conversation surface is only local for now.

Implication: the IA currently communicates "multi-feature app" when the actual product is "serious workout logger with some support surfaces."

### 2. Exiting a workout currently routes to chat

This is the clearest product smell in the app today.

Evidence:

- `SignedInShell` passes `onExitWorkout={() => onChangeMode('chat')}` into `WorkoutSurface`.

Why it matters:

- Leaving the sacred workout surface should resolve to a stable home state, session summary, or prior context, not to a placeholder coaching tab.
- This breaks user expectation and makes the app feel structurally arbitrary.

### 3. Home is directionally right but too thin to feel essential

Home currently offers:

- greeting
- start/continue session
- weekly load summary

That is clean, but not yet strong enough to justify itself as a primary destination. Right now it feels like a lightweight launcher with a decent weekly stat, not a decisive pre-workout or between-workouts control center.

### 4. Settings uses a generic app pattern that does not feel specific to Reed

The settings surface is functional, but it reads like standard account/settings scaffolding rather than something edited to Reed's product tone. The `Account` eyebrow plus `Settings` display heading is also close to the page-chrome pattern the repo explicitly warns against.

### 5. Auth is clear enough, but emotionally generic

The auth surface is usable, but it currently behaves more like competent scaffolding than a serious product threshold. It does not yet communicate what Reed is for beyond the name and form fields.

## Surface-by-surface notes

### Auth

Good:

- obvious sign-in / sign-up toggle
- simple field model
- honest Google-dev-build messaging

Weak:

- little product framing
- no strong reason-to-believe for a serious trainee
- feels like setup, not product entry

### Home

Good:

- one obvious primary action
- session continuity is clear
- weekly load board is relevant, not vanity fluff

Weak:

- not enough "what should I do next?" intelligence
- weekly load is informative but not yet coaching-grade
- no plan recovery, recent routine recovery, or session intent framing

### Workout

Good:

- best-aligned surface with product principles
- strong state model
- timeline plus exercise card is a credible training interaction model
- mixed workout support is a real advantage if preserved

Weak:

- the surrounding IA still does not fully honor its importance
- likely complexity risk over time if secondary actions continue to accumulate inside this surface without editorial pressure

### Chat

Current truth:

- placeholder, not product

PM stance:

- treat as incubation, not as a core navigation peer, until it can reduce effort inside real workout or recovery flows

### Settings

Current truth:

- serviceable account/settings page

PM stance:

- keep minimal
- do not let it become a dumping ground for edge-case controls

## Strategic interpretation

Reed should be designed as:

- a training cockpit during sessions
- a focused prep/review surface outside sessions
- a quiet system everywhere else

Not as:

- a broad fitness lifestyle app
- a social/coaching app with workout logging attached
- a dashboard product that happens to include workouts

## Default priorities for future work

### P0

- Protect and sharpen the workout loop.
- Remove navigation/product contradictions around workout exit and chat prominence.
- Keep logging speed as the first decision criterion.

### P1

- Make Home earn its place by helping users restart momentum faster.
- Upgrade progress surfaces from "stats shown" to "decision help."
- Define a clearer post-session landing moment.

### P2

- Reintroduce chat/coaching only when it clearly reduces friction, improves adherence, or helps planning/review in a concrete way.

## Working design heuristics for future decisions

When reviewing a feature request, ask:

- Does this reduce taps or thought during a session?
- Does this help the user know the next move faster?
- Does this improve trust, pace, or progress visibility?
- Is this for a real training moment, or for a speculative product story?
- If removed, would the workout get worse? If not, it is probably secondary.

## Product hypotheses worth testing

- A stronger Home surface should behave like "resume, repeat, or start with intent," not like a dashboard.
- The best coaching layer may be contextual and embedded, not a separate primary tab.
- Users will value recent-routine recovery and exercise recall more than broad analytics density.
- Post-session reflection will matter more if it is compact, comparative-to-self, and immediately actionable for the next workout.

## Immediate recommendations

1. Rework the signed-in IA so the product story matches reality. Workout should be the dominant surface; chat should not be a first-class tab until it earns it.
2. Change the workout exit destination. Exiting active training should land somewhere coherent.
3. Define the job of Home more precisely. It should either become the prep/review hub or stay intentionally minimal, but not sit in between.
4. Keep settings aggressively boring and small.
5. Treat every addition to the workout surface as guilty until proven useful.

## References inspected

- `product/design-principles.md`
- `components/home/signed-in-shell.tsx`
- `components/home/home-surface.tsx`
- `components/home/workout-surface.tsx`
- `components/home/workout-exercise-page.tsx`
- `components/home/workout-exercise-capture-view.tsx`
- `components/home/workout-exercise-rest-view.tsx`
- `components/home/workout-timeline-page.tsx`
- `components/home/workout-add-exercise-sheet.tsx`
- `components/home/settings-surface.tsx`
- `components/home/auth-entry.tsx`
- `convex/schema.ts`
- `convex/liveSessions.ts`
- `convex/homeStats.ts`
- `legacy/2/index.html`
- `legacy/2/app.js`

## Short version

Reed already has the beginnings of a real training product because the workout loop is opinionated in the right way. The main risk is not lack of features. The main risk is letting secondary surfaces, placeholder ideas, and generic app structure dilute the clarity of what the product actually is.

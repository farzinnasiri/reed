# Reed PRD: Onboarding Profile

## Status

- Date: 2026-04-28
- Scope: first-run onboarding that creates the user's initial training profile
- Primary platform: Android mobile, with iOS parity
- Out of scope for now: nutrition coaching, medical diagnosis, wearable sync, macro tracking, body-scan import, full program generation internals

## 1. Product Intent

Reed should learn the few signals that materially change a user's first training plan, then get out of the way.

The core promise:

**Give Reed one honest setup and it will stop asking generic fitness-app questions.**

The onboarding flow is not a personality quiz, medical intake, or bodybuilding spreadsheet. It is a short adaptive interview that turns the user's real constraints into a practical training profile.

## 2. Experience Target

The flow should feel:

- calm, serious, and precise
- private, because the user is sharing body and training details
- fast enough to finish in one sitting
- useful before the user sees the final app
- opinionated enough to reduce decision fatigue

The user should leave onboarding thinking:

**"Reed understands what I am optimizing for, what I can actually do, and what it should not push."**

## 3. Primary User

The first target user is an intermediate self-directed trainee who trains consistently but has competing goals:

- aesthetic maintenance or improvement
- skill progression such as calisthenics
- sport support such as snowboarding, hiking, dance, or boarding sports
- real constraints from work, study, sleep, gym crowding, and occasional injury history

This PRD optimizes for the user who can provide rich context but should not be forced to provide all of it before Reed is useful.

## 4. Design Position

Reed's onboarding should be an instrument calibration, not a sign-up funnel.

The product should refuse:

- long health-app intake forms
- macro and meal-plan questions in first-run onboarding
- asking for every body-composition metric just because the user has it
- presenting all goals as equally compatible
- hiding tradeoffs to make the product feel magical
- using playful coaching copy around pain, consent, or personal data

The product should embrace:

- progressive disclosure
- clear defaults
- editable assumptions
- a visible "what Reed inferred" summary
- a tight 20/80 required data model

## 5. Core Product Rules

1. Onboarding must be completable without optional biometric or scan data.
2. Every required question must directly affect plan generation, recovery logic, exercise selection, or session frequency.
3. The user can go back without losing input.
4. The user can skip optional questions without guilt copy.
5. Consent must be explicit before Reed builds a profile from answers.
6. Pain and injury answers constrain recommendations; they do not produce diagnosis.
7. The final step must show Reed's assumptions before creating the profile.
8. The user must be able to edit the profile later from settings or profile.
9. All real app content remains auth-gated.
10. Onboarding should use existing design tokens, `ReedText`, `ReedButton`, `GlassSurface`, and motion primitives from the design system.

## 6. Required Data Model

These fields are required in the first-run flow.

| Field | Input pattern | Why Reed needs it |
|:------|:--------------|:------------------|
| `profilingConsent` | binary consent | Permission to use answers for personalization |
| `ageRange` or `birthYear` | picker | Load tolerance, recovery expectations, rough progression rate |
| `heightCm` | numeric input | Body-size context for movement and bodyweight work |
| `weightKg` | numeric input | Bodyweight skill context and load estimates |
| `trainingAge` | single select | Beginner/intermediate assumptions and progression speed |
| `weeklySessions` | stepper or segmented range | Program frequency |
| `sessionDuration` | segmented range | Volume budget |
| `trainingStyle` | multi select, max 2 primary | Exercise mix and language |
| `equipmentAccess` | multi select | Exercise selection and substitutions |
| `primaryGoal` | single select | Top programming priority |
| `secondaryGoal` | optional single select | Tie-breaker, not equal priority |
| `recoveryQuality` | 3-level select | Volume and intensity conservatism |
| `painConstraints` | none or area chips | Exercise exclusions and caution flags |
| `cardioWillingness` | 0/1/2+ sessions | Conditioning dosage and modality placement |

Optional later fields:

- resting heart rate
- body fat percentage
- skeletal muscle mass
- fat-free mass
- scan source and scan date
- nutrition style
- protein target
- sport schedule by season
- exact strength numbers beyond simple anchors
- detailed exercise preferences

## 7. Recommended Flow

The flow has five visible steps:

1. Consent
2. Baseline
3. Training Reality
4. Priorities
5. Profile Review

This replaces a generic multi-page form with a short adaptive interview. The user sees progress, but Reed can branch inside each step based on answers.

## 8. Shared Screen Structure

Every screen uses the same high-level structure:

- top safe-area spacer
- small Reed wordmark
- compact progress indicator, `01 / 05`
- one strong screen title
- one short explanatory paragraph only when needed
- primary input area
- bottom action row pinned above safe area

Layout rules:

- Use a single main surface only when grouping improves comprehension.
- Avoid card-wrapping every option row.
- Keep primary action at bottom right on wide layouts and full-width or paired bottom row on mobile.
- Use `Back` as secondary, `Continue` as primary.
- Disable `Continue` only when a required input is missing.
- Show inline field feedback close to the field, not as a global error.

Motion rules:

- Step entry uses the design system `mode` duration.
- Button and option press use the existing tap scale.
- Progress indicator updates with `standard` duration.
- No custom springs or per-screen easing.

## 9. Step 1: Consent

### User intent

The user wants to know why Reed is asking personal questions and whether the answers will be used responsibly.

### Screen title

`Reed learns once, then gets out of your way.`

### Body copy

`Answer a few questions about your body, training, and constraints. Reed uses them to build your working profile instead of asking you to explain yourself later.`

### Primary content

A single `GlassSurface` titled `Profiling consent`.

Consent statement:

`Use my answers to build a training profile.`

Supporting copy:

`Reed will use this to shape training recommendations, priorities, substitutions, and recovery logic.`

Below the surface:

`Required now: consent, body size, weekly rhythm, training reality, primary goal, constraints, and recovery quality. Everything else can wait.`

### Actions

- `Maybe later`: exits onboarding into an unprofiled shell state with limited personalization.
- `I consent`: sets `profilingConsent = true` and advances.

### Interaction details

- Tapping the consent surface toggles consent on if the user has not tapped the primary button.
- `I consent` is visually primary and also acts as the affirmative toggle.
- `Maybe later` must not shame the user. The next state should explain that Reed can still track workouts but will not personalize deeply yet.

### Edge states

- If the user declines consent, do not collect the rest of the onboarding profile.
- If a profile already exists and the user re-enters onboarding, show `Review consent` instead of first-run consent copy.

## 10. Step 2: Baseline

### User intent

The user wants to provide only the body signals that affect training, without feeling measured or judged.

### Screen title

`Capture the few body signals that change the plan.`

### Body copy

`Reed mostly needs sizing, daily baseline, and whether recovery is normal or fragile.`

### Required inputs

Use a compact form surface titled `Required now`.

Fields:

- `Age`: numeric or birth-year picker
- `Height`: numeric input with `cm`
- `Weight`: numeric input with `kg`

Recovery block:

- `Sleep and recovery`: segmented control
- Options: `Solid`, `Mixed`, `Fragile`

Option meanings:

- `Solid`: usually rested, stable energy
- `Mixed`: some poor sleep or inconsistent energy
- `Fragile`: poor sleep, high stress, or often un-restored

### Optional reveal

Link-style row:

`I already track body composition`

When opened, reveal optional fields:

- body fat percentage
- skeletal muscle mass
- resting heart rate

These fields should be collapsible and clearly optional.

### Interaction details

- Numeric fields use metric units by default.
- Height and weight should accept ranges only if the UI has a clear pattern for ranges. Otherwise store the user's best current value and let notes capture variance later.
- If weight is entered as `69-70`, normalize to `69.5 kg` and display `about 69.5 kg` in the review step.
- Recovery selection is required because it changes training conservatism.

### Inline feedback

- Age below 13 or above 90: block with plain validation copy.
- Height/weight outside plausible ranges: ask the user to check the value.
- Optional body metrics can be incomplete; do not block progression.

## 11. Step 3: Training Reality

### User intent

The user wants Reed to understand what they actually do now, not force a dream schedule.

### Screen title

`Describe how you already train, not your dream routine.`

### Body copy

`This lets Reed choose a realistic starting load, preserve your strengths, and identify what can actually shift in the next block.`

### Required inputs

Current training surface:

- `Consistency`: segmented options `Just starting`, `Under 6 months`, `6-18 months`, `18+ months`
- `Weekly rhythm`: segmented options `1-2`, `2-4`, `4+`
- `Session length`: segmented options `Under 45m`, `45-75m`, `75m+`
- `Effort`: segmented options `Easy`, `Moderate`, `Hard`

Training style surface:

- Multi-select chips, max 2 primary:
- `Classic gym`
- `Calisthenics`
- `Sport support`
- `Cardio`
- `Mobility / rehab`

Environment surface:

- Multi-select chips:
- `Full gym`
- `Calisthenics park`
- `Home equipment`
- `Crowded gym`
- `No fixed equipment`

### Interaction details

- If the user selects more than 2 training styles, ask them to choose the top 2 Reed should optimize for.
- `Crowded gym` is not equipment; it is an environment constraint. It affects substitutions and plan flexibility.
- If `Just starting` is selected, Reed should avoid asking for detailed strength anchors later.
- If `18+ months` and `Hard` are selected, Reed can ask for a small capability anchor on the next step.

### Copy note

Avoid moralizing around consistency. The goal is calibration.

## 12. Step 4: Priorities

### User intent

The user wants to tell Reed what matters now, but also needs Reed to make tradeoffs explicit.

### Screen title

`Pick the priority Reed should protect first.`

### Body copy

`You can care about several outcomes. Reed needs to know which one wins when time, recovery, or equipment gets tight.`

### Primary goal options

Use large selectable rows, not dense chips.

- `Build muscle`
- `Get stronger`
- `Master a skill`
- `Support a sport`
- `Improve conditioning`
- `Move without pain`

### Goal-specific follow-up

After primary goal selection, reveal one compact follow-up.

If `Master a skill`:

- `Skill focus`: `Muscle-up`, `Handstand`, `Pull-up strength`, `Dip strength`, `Other`
- `Timeline`: `4-8 weeks`, `2-3 months`, `No deadline`

If `Support a sport`:

- `Sport`: searchable or chip list with `Snowboarding`, `Hiking`, `Running`, `Dance`, `Board sports`, `Other`
- `Season timing`: `Now`, `Soon`, `Later`

If `Improve conditioning`:

- `Preferred modality`: `Bike`, `Incline walk`, `Row`, `Run`, `Stairs`, `Other`
- `Willingness`: `1x/week`, `2x/week`, `3x+/week`

If `Build muscle`:

- `Focus areas`: max 3 chips such as `Chest`, `Shoulders`, `Back`, `Arms`, `Legs`, `Abs`

If `Get stronger`:

- `Main lifts`: chips such as `Squat`, `Bench`, `Deadlift`, `Overhead press`, `Weighted pull-up`

If `Move without pain`:

- Skip performance follow-up and move directly to constraints.

### Secondary goal

Optional row:

`Add a secondary goal`

Secondary goal can be selected from the same top-level goal list, but it is visually subordinate. Copy should say:

`Secondary goals influence choices. They do not override the main priority.`

### Constraints and pain

Pain question:

`Any pain Reed should respect?`

Options:

- `No current pain`
- `Lower back`
- `Neck`
- `Shoulder`
- `Knee`
- `Hip`
- `Wrist / elbow`
- `Other`

If any area is selected:

- Severity: `Mild`, `Moderate`, `High`
- Timing: `Only under load`, `During daily life`, `Recent injury`
- Copy: `Reed can adapt exercise choices, but this is not medical advice.`

### Cardio willingness

Always ask, because conditioning materially affects plan design.

Question:

`How much conditioning will you actually do?`

Options:

- `None for now`
- `1 short session / week`
- `2 short sessions / week`
- `3+ sessions / week`

If the user selects `None for now` while primary or secondary goal includes sport or conditioning, show a gentle conflict note:

`Reed can still bias training toward stamina, but conditioning will improve slower without dedicated work.`

### Interaction details

- Selecting primary goal should visually update a small `Reed will protect` statement.
- Example: `Reed will protect fresh upper-body skill work before aesthetic volume.`
- This statement becomes part of the review step.

## 13. Step 5: Profile Review

### User intent

The user wants confirmation that Reed understood them correctly before the app starts adapting recommendations.

### Screen title

`Review the profile Reed will use.`

### Body copy

`These assumptions shape your first block. You can edit them now or later.`

### Primary content

Show a generated `Reed Profile v1` summary with five sections.

1. `Priority`

Example:

`Muscle-up mastery for the next 6-8 weeks, with snowboarding support and aesthetic maintenance behind it.`

2. `Training budget`

Example:

`2-4 sessions per week, usually 60-90 minutes, with hard effort already normal.`

3. `Recovery stance`

Example:

`Mixed to fragile recovery. Reed should be conservative with failure work and avoid stacking high-fatigue days.`

4. `Constraints`

Example:

`Lower back and hips need respect under long loaded hikes. Gym crowding requires substitutions.`

5. `What Reed will do`

Example:

`Keep skill work fresh, reduce chest/arm volume when needed, add 2 short bike conditioning sessions after lifting, and preserve recovery.`

### Tradeoff strip

Show one explicit tradeoff statement:

`For this block, Reed will trade some aesthetic volume for faster muscle-up progress and snowboarding stamina.`

This is important. Reed should not pretend all goals can progress equally.

### Actions

- `Edit`: opens a step picker or returns to the relevant step.
- `Create profile`: saves the onboarding profile and enters the app.

### Loading state

After `Create profile`, show a short profile-building state:

- Title: `Building your starting point`
- Status lines rotate through concrete actions:
- `Setting your training budget`
- `Checking recovery constraints`
- `Prioritizing your first block`

Do not over-animate. This state should be brief and honest. If no model call is needed, keep it under 800ms or skip it.

### Failure state

If profile save fails:

- Keep the user's answers in local state.
- Show `Could not save profile. Try again.`
- Provide `Try again` and `Back` actions.
- Do not send the user back to step 1.

## 14. Branching Logic

The flow should remain five visible steps, but questions branch inside steps.

Branch rules:

- If `trainingAge` is `Just starting`, skip strength anchors and reduce jargon.
- If `trainingAge` is `18+ months`, ask optional capability anchors after priorities.
- If `primaryGoal` is `Master a skill`, ask one skill target and timeline.
- If `primaryGoal` is `Support a sport`, ask sport and timing.
- If pain severity is `High` or `Recent injury`, mark the profile as needing conservative recommendations.
- If `recoveryQuality` is `Fragile`, lower default volume and show the tradeoff in review.
- If `cardioWillingness` is `None` and sport/conditioning is important, show the conflict note but allow progression.

Optional capability anchors for intermediate users:

- Push-ups: `0-10`, `10-25`, `25+`
- Pull-ups: `0`, `1-5`, `6-10`, `10+`
- Squat strength: `I do not squat`, `Bodyweight-ish`, `Above bodyweight`, `Not sure`

These are optional because they improve calibration but should not block first-run completion.

## 15. Information Architecture

Core object:

- `TrainingProfile`

Related objects:

- `OnboardingAnswerDraft`
- `GoalPriority`
- `TrainingConstraint`
- `RecoveryBaseline`
- `EquipmentEnvironment`

Recommended profile shape:

```ts
type TrainingProfile = {
  profilingConsent: true;
  baseline: {
    ageRange?: string;
    birthYear?: number;
    heightCm: number;
    weightKg: number;
    recoveryQuality: "solid" | "mixed" | "fragile";
  };
  trainingReality: {
    trainingAge: "starting" | "under_6_months" | "six_to_18_months" | "over_18_months";
    weeklySessions: "one_to_two" | "two_to_four" | "four_plus";
    sessionDuration: "under_45" | "fortyfive_to_75" | "over_75";
    effort: "easy" | "moderate" | "hard";
    trainingStyles: string[];
    equipmentAccess: string[];
  };
  priorities: {
    primaryGoal: string;
    primaryGoalDetail?: string;
    secondaryGoal?: string;
    cardioWillingness: "none" | "one_short" | "two_short" | "three_plus";
  };
  constraints: {
    painAreas: string[];
    painSeverity?: "mild" | "moderate" | "high";
    painTiming?: "under_load" | "daily_life" | "recent_injury";
  };
  optionalMetrics?: {
    bodyFatPercent?: number;
    skeletalMuscleMassKg?: number;
    restingHeartRate?: number;
  };
};
```

Implementation can refine names later, but the product boundary should stay stable: onboarding creates a compact profile, not an exhaustive human dossier.

## 16. Interaction Patterns

Use:

- segmented controls for small mutually exclusive sets
- chips for multi-select constraints and environments
- steppers only when the user is choosing counts, not numeric body data
- numeric inputs for height and weight
- progressive disclosure for optional metrics
- review summaries instead of asking users to interpret raw form data

Avoid:

- sliders for age, height, or weight
- free-text questions in required onboarding
- conversational chat UI for the whole flow
- hidden auto-advance after selection
- dense dropdowns where chips are clearer

## 17. Accessibility Requirements

- All touch targets minimum `44px`; primary buttons use the design system `54px` minimum.
- Screen reader labels must include units for numeric fields.
- Color cannot be the only selected-state signal; use checkmark, border, fill, or text weight.
- Progress indicator must have accessible text such as `Step 2 of 5`.
- Reduced motion should remove non-essential transitions.
- Validation messages should be placed near the relevant input and announced politely.
- The bottom action row must remain reachable with large text enabled.

## 18. Privacy And Trust

Required consent copy must be plain language.

Reed should say:

- what data is used for
- that optional metrics can be skipped
- that pain handling is training adaptation, not diagnosis
- that the profile can be edited later

Reed should not say:

- vague claims like `AI-powered health optimization`
- medical claims
- guaranteed outcomes
- guilt-driven copy for skipped fields

.

## 20. Success Metrics

Primary:

- onboarding completion rate
- median time to profile created
- first workout started after onboarding

Secondary:

- percentage of users editing profile in first 14 days
- first-week session adherence
- week-2 retention
- percentage of users who skip optional metrics
- percentage of users who decline consent

Qualitative signals:

- users can explain why Reed asked each required question
- users understand the primary tradeoff Reed is making
- users do not describe onboarding as a health questionnaire

## 21. Open Product Questions

1. Should age be stored as birth year or age range? -> only ask and storey birth date (year, month, day) 
2. Should `Maybe later` allow workout logging immediately, or should it lead to a minimal profile prompt before the first plan? -> minimal
3. Should profile creation require a deterministic local rules engine first, with AI summarization later, or should the first version include model-generated profile text? -> no ai here, all algorithmic
4. Should capability anchors live in onboarding or appear during the first relevant workout? -> onboarding
5. Should cardio willingness be framed as conditioning, stamina, or sport support in the UI? -> stamina

## 22. Recommended V1 Decision

Use deterministic rules for the first saved profile and generate any human-readable summary from those structured fields.

This keeps onboarding explainable, testable, and safe. AI can later improve summaries, substitutions, and planning, but the initial profile should not depend on an opaque model response to decide the user's core training constraints.

## 23. Example Profile Compression

Given a rich user profile like:

- 26 years old, 170 cm, about 69.5 kg
- 1.5 years consistent training
- 2-4 sessions per week, 60-90 minutes
- hard effort, gym and calisthenics hybrid
- poor sleep and often un-restored
- muscle-up priority, snowboarding support, aesthetic maintenance
- cardio weakness but willing to do 2 short cycling sessions
- lower back and hips can become uneasy under long loaded hikes
- university gym, calisthenics park, some home equipment, crowded gym reality

Reed should compress it into:

### Required profile fields

- `baseline`: 26, 170 cm, 69.5 kg, `fragile` or `mixed` recovery
- `trainingReality`: `six_to_18_months`, `two_to_four`, `over_75` or `fortyfive_to_75`, `hard`
- `trainingStyles`: `Classic gym`, `Calisthenics`
- `equipmentAccess`: `Full gym`, `Calisthenics park`, `Home equipment`, `Crowded gym`
- `primaryGoal`: `Master a skill`
- `primaryGoalDetail`: `Muscle-up`, `4-8 weeks`
- `secondaryGoal`: `Support a sport`
- `cardioWillingness`: `two_short`
- `painAreas`: `Lower back`, `Hip`
- `painSeverity`: `Mild` or `Moderate`, depending on user selection

### Review copy

`Muscle-up mastery is the first priority for this block. Reed should keep skill work fresh at the start of upper-body sessions, support snowboarding stamina, and maintain aesthetics without letting chest and arm volume crowd out the skill goal.`

`Recovery is a limiter. Reed should avoid stacking too many high-fatigue days and treat sleep quality as a reason to adjust volume before adding more work.`

`Conditioning is disliked but accepted. Reed should use two short cycling sessions after lifting instead of asking for separate cardio days.`

### Explicit tradeoff

`For the next 6-8 weeks, Reed will protect muscle-up progress and snowboarding readiness over maximal bodybuilding volume.`

This is the expected compression pattern: many personal details become a few stable programming constraints.

## 24. Acceptance Criteria

The onboarding feature is ready when:

1. A new authenticated user without a profile is routed into onboarding before product pages. also a already existing in user that has not completed the onboarding will be routed on first loading of the app. this will be a precondition to check on each time the user has logged in the app (so if the user is already logged in, he is not routed)
2. Consent is required before collecting profile answers.
3. The user can decline consent and land in a limited unprofiled state. in that case there will be a prompt/banner on top of the screen to route him to profile completion if he wants
4. The user can complete onboarding with only required fields.
5. Optional body-composition fields are hidden by default and never block progression.
6. Each step preserves local draft state when navigating back and forward.
7. The review step shows inferred assumptions, not just raw answers.
8. The review step includes one explicit tradeoff statement.
9. Profile save failure preserves answers and offers retry.
10. The saved profile contains no speculative fields that are not read by shipped behavior. 
11. Analytics avoid raw sensitive body values.
12. The UI uses design-system tokens and components, with no hardcoded glass values or custom motion curves.
13. the profile is only saved on the server at the last step when user has reviewd

## 25. Implementation Slices

Recommended build order:

1. Static onboarding shell, progress, navigation, and local draft state.
2. Required input screens with validation.
3. Review summary generated from deterministic mapping rules.
4. Profile persistence through Convex auth context.
5. Unprofiled consent-declined state.
6. Optional body metrics disclosure.


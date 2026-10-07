---
name: Reed (Companion)
description: A coach in the room. One home screen (the Pulse, the thread, the dock), Reed as a living presence, warm dark surfaces, no glass. Serious, calm, physical. Never cute.
colors:
  canvas: "#121110"
  surface: "#1c1a18"
  surface-raised: "#26231f"
  surface-high: "#302c27"
  sheet: "#1a1816"
  ink: "#f4efe8"
  ink-secondary: "#b8afa4"
  ink-muted: "#938a7f"
  accent: "#3d66f2"
  accent-text: "#ffffff"
  accent-ink: "#aec2ff"
  accent-soft: "rgba(61, 102, 242, 0.16)"
  data-warm: "#e5a36f"
  danger-ink: "#f0a3a3"
  danger-fill: "rgba(240, 100, 100, 0.14)"
  success-ink: "#9ad7a8"
  success-fill: "rgba(120, 200, 140, 0.14)"
  line: "rgba(255, 240, 220, 0.07)"
  line-strong: "rgba(255, 240, 220, 0.14)"
  scrim: "rgba(6, 5, 4, 0.5)"
typography:
  display:
    fontFamily: Figtree
    fontSize: 26px
    lineHeight: 32px
    letterSpacing: -0.5px
    fontWeight: 600
  title:
    fontFamily: Figtree
    fontSize: 24px
    lineHeight: 30px
    letterSpacing: -0.5px
    fontWeight: 600
  headline:
    fontFamily: Figtree
    fontSize: 17.5px
    lineHeight: 24px
    letterSpacing: -0.2px
    fontWeight: 600
  voice:
    fontFamily: Figtree
    fontSize: 16.5px
    lineHeight: 26px
    fontWeight: 400
  body:
    fontFamily: Figtree
    fontSize: 15.5px
    lineHeight: 22px
    fontWeight: 400
  body-strong:
    fontFamily: Figtree
    fontSize: 15.5px
    lineHeight: 22px
    fontWeight: 600
  caption:
    fontFamily: Figtree
    fontSize: 13px
    lineHeight: 18px
    fontWeight: 500
  micro:
    fontFamily: Figtree
    fontSize: 12px
    lineHeight: 16px
    fontWeight: 500
  stat:
    fontFamily: Figtree
    fontSize: 26px
    lineHeight: 32px
    letterSpacing: -0.8px
    fontWeight: 600
rounded:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 22px
  card: 26px
  sheet: 36px
  pill: 999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 28px
  xxl: 36px
  xxxl: 48px
  gutter: 18px
  chrome-gutter: 14px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.pill}"
    height: 52px
  button-soft:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    height: 38px
  button-quiet:
    backgroundColor: transparent
    textColor: "{colors.ink-muted}"
    height: 38px
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    height: 36px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: 16px 18px 18px
  user-bubble:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "22px 22px 8px 22px"
  composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    height: 56px
  session-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.pill}"
    size: 56px
  pulse:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: 52px
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
  segmented-control:
    backgroundColor: "{colors.canvas}"
    activeColor: "{colors.surface-high}"
    rounded: "{rounded.md}"
    height: 40px
---

# Reed: Companion

> **Status:** The single source of truth for Reed's UI: tokens, rules and component contracts. Read it before implementing or modifying any component, screen layout, animation or colour. The code mirrors it in `design/system.ts` (tokens) and `design/motion.ts` (motion); add a token here before using a new value there. It replaced the v1 design system when the UI v2 migration finished (2026-10).
>
> **Sources of truth, in order:**
> 1. This file, for tokens, rules and component contracts.
> 2. `prototypes/redesign/home.html`, the interactive mockup, for layout, hierarchy and choreography. Open it in a browser; frame 01 is live.
>
> `DESIGN-PRINCIPLES.md` and `CONTEXT.md` still apply. For visual layout and choreography, the mockup is the target; keep this file aligned with it. The UI v2 migration plan is archived at `docs/archive/2026-10-01-ui-v2-migration.md`.

## Overview

Reed is a coach that is in the room with you. The interface is one home screen with three layers, and everything else is either a sheet over it or the workout module behind it.

- **The Pulse** (top): a glanceable strip for how you are doing (week, bodyweight, nearest goal). Tapping it grows the strip into the full Progress view. During a session it becomes the live activity.
- **The thread** (middle): Reed. It has two modes. *Today* opens the app with Reed as the hero and brings you what matters now. *Chat* begins the moment you talk: Reed glides to the bottom-left corner and the screen becomes one endless conversation.
- **The dock** (bottom): always the same. The session button and the composer.

**What changed from v1:**
- **No glassmorphism.** Surfaces are solid and warm. Blur, glass fills, highlights and backdrop diffusion are retired.
- **Dark only.** There is no light theme and no appearance setting.
- **Figtree replaces Outfit.** Weights stay between 400 and 600; v1's 800 and 900 weights are gone.
- **Uppercase tracked labels are gone.** Hierarchy comes from size, weight and space.
- **Reed's replies have no avatar.** The mascot is a presence in the corner, not an avatar on messages.
- **No pages for Progress, You or Settings.** Progress lives in the Pulse; profile and settings are one sheet.

**Personality:** calm, warm, adult. The companion feel comes from warmth and presence, not from playfulness. Reed is never cute, never cheerleading and never guilt-tripping (see `DESIGN-PRINCIPLES.md` §13).

**Platform:** Android first, iOS parity, web for QA. Every rule here must work on all three without blur.

## Colors

Dark surfaces remain fixed. Personal accents are local to the device. Never use raw colour values in components; always reference a theme token.

### Surfaces (back to front)

| Token | Value | Use |
|:--|:--|:--|
| `canvas` | `#121110` | Screen background. Warm near-black, never pure black. |
| `surface` | `#1c1a18` | Cards, chips, composer, Pulse strip, past-session rows. |
| `surface-raised` | `#26231f` | Things on a card (step buttons, index dots, quick-log tiles), user bubbles. |
| `surface-high` | `#302c27` | Active segment thumb, chart tracks, grabber, empty bars. |
| `sheet` | `#1a1816` | Expanded Pulse and bottom sheets. |

### Ink

| Token | Value | Contrast (canvas / surface / raised) | Use |
|:--|:--|:--|:--|
| `ink` | `#f4efe8` | 16.5 / 15.2 / 13.7 | Primary text, numbers, greetings. |
| `ink-secondary` | `#b8afa4` | 8.7 / 8.0 / 7.2 | Reed's voice, chip labels, secondary text. |
| `ink-muted` | `#938a7f` | 5.6 / 5.1 / 4.6 | Meta, units, timestamps, placeholders. |

All three pass WCAG AA for body text on every surface. Do not introduce a dimmer text colour.

### Accent

| Token | Value | Use |
|:--|:--|:--|
| `accent` | `#3d66f2` | The one action colour: primary buttons, the session button, toggles, progress fills, "done" day bars, the live state. White text on it is 4.8:1. |
| `accent-ink` | `#aec2ff` | Accent-coloured **text** (soft buttons, badges, live Pulse). Use this instead of `accent` for text on dark surfaces. |
| `accent-soft` | `rgba(61, 102, 242, 0.16)` | Fill behind `accent-ink` text: soft buttons, PR badges, the live Pulse. |

**Rule:** at most one `accent`-filled element per view. On the home screen that is the session button, unless a widget's primary CTA is the thing Reed wants you to do right now (then both may show; the widget CTA is the hero).

### Status and data

- `danger-ink` / `danger-fill`: destructive text (delete account), errors. Pair with a fill or icon, never colour alone.
- `success-ink` / `success-fill`: confirmations (saved, logged).
- `data-warm` `#e5a36f`: the second series colour in two-series charts (for example the muscle split ring next to `accent`).
- `workoutSemanticPalette` in `design/system.ts` (muscle groups, modalities, PR types, warm-up) is domain colour, not UI colour, and stays separate from the tokens above. Its warm-up values are the former dark-mode ones. Check new uses for legibility on `surface`.

### Lines and scrim

- `line` `rgba(255,240,220,0.07)`: hairline dividers inside cards and sheets.
- `line-strong` `rgba(255,240,220,0.14)`: dividers that must read (Pulse separators, outlined "More" tiles).
- `scrim` `rgba(6,5,4,0.5)`: behind the expanded Pulse and sheets.

## Typography

**Figtree** for everything, loaded at boot via `@expo-google-fonts/figtree` (400 Regular, 500 Medium, 600 SemiBold). No other families in designed UI.

| Role | Size / line | Weight | Tracking | Use |
|:--|:--|:--|:--|:--|
| `display` | 26 / 32 | 600 | −0.5 | Today greeting ("Upper body today."). One per screen. |
| `title` | 24 / 30 | 600 | −0.5 | Sheet titles ("This week", the user's name). |
| `headline` | 17.5 / 24 | 600 | −0.2 | Card and widget titles, exercise names in sheets. |
| `voice` | 16.5 / 26 | 400 | 0 | **Reed's messages.** `ink-secondary`, with `ink` 500 for emphasis. |
| `body` | 15.5 / 22 | 400 | 0 | Rows, user bubbles, settings rows. |
| `body-strong` | 15.5 / 22 | 600 | 0 | Button labels, emphasised rows. |
| `caption` | 13 / 18 | 500 | 0 | Meta, timestamps, units, section hints. |
| `micro` | 12 / 16 | 500 | 0 | Chart axes, badges, origin tags. |
| `stat` | 26 / 32 | 600 | −0.8 | Numbers in summary and Pulse readouts. |

- **Numbers** use `fontVariant: ['tabular-nums']` everywhere they can change (timers, weights, reps, stats). Verify Figtree renders tabular figures on Android; if it does not, fall back to fixed-width containers for live-changing numbers. Do not swap fonts for numbers.
- **Units are smaller and muted:** `73.1` in `stat`, then `kg` in `caption`/`ink-muted` with a 3–4px gap.
- **No uppercase labels** with letter-spacing. Section labels are `caption` in `ink-muted`, sentence case.
- The workout capture page keeps its current numeric sizes. Only the family and colours change there.

## Layout & Spacing

The spacing scale is unchanged (`4 → 8 → 12 → 16 → 20 → 28 → 36 → 48`).

- **`gutter` (18px):** the horizontal edge for thread content, cards and sheet content.
- **`chrome-gutter` (14px):** the edge for floating chrome (the Pulse, the "You" button, the dock). Chrome sits slightly wider than content on purpose.
- **Tap targets:** 44px minimum. The dock's controls are 56px because they are used mid-workout.
- Phone web previews use the browser's real top inset, without an empty simulated status bar. At widths up to 600px they reserve a 22px bottom inset when the browser reports zero. Native uses the device insets. The dock adds its usual 8px, leaving 30px below the composer in the preview.
- On wide screens (web) the home column is centred with a max width of 720px. The Pulse and dock follow that column.

### Home anatomy (390 × 844 reference)

| Layer | Placement |
|:--|:--|
| Status bar | System. |
| Pulse | `top: safeTop + lg` (20px breathing room after the real safe area), `left: 14`, `right: 68` (leaves room for the "You" button), height 52. |
| "You" button | `top: safeTop + lg` (20px), `right: 14`, 48 × 52 pill, avatar or person-outline icon. |
| Thread | Scrolls beneath floating chrome. Content starts below Pulse + 46px; a matching background fades over that 46px without cutting off the glow. At the bottom, text gradually dissolves across the 104px presence row plus 16px, rather than ending at a separate black section. Latest content has equivalent bottom padding to stay readable. |
| Presence row (chat mode only) | Height 104. Mascot (96) at `left: 8`; up to two stacked suggestions or the status hint to its right. No row background. |
| Dock | Padding: top 6, horizontal 14, bottom = safe-area inset + 8. Session button (56) + composer (flex, 56) with an 8px gap. |

## Elevation & Depth

v2 has **no glass and no shadows on surfaces**. Depth comes from the surface ladder (`canvas → surface → surface-raised → surface-high`) and from the scrim.

- A thing is raised only if you can act on it or it is a distinct object (a widget, a chip, the composer). Do not box plain text.
- No card inside a card. Inside a card, use `surface-raised` for small controls and `line` dividers for rows.
- **Scrim and recede:** when the Pulse expands or a sheet opens, the home stage scales to `0.955` and fades to `0.55`, and `scrim` covers it.
- **The glow:** the interaction field described in checkpoint 6 below, on home only. Clip it to the viewport so focus cannot move the navigator sideways. The mascot keeps its own small halo.
- **Jump to latest:** Latest sits beside the mascot in the presence row while reading history, replacing suggestions. Surfaces have no shadows.

## Shapes

| Token | Value | Use |
|:--|:--|:--|
| `xs` | 8 | Badges, origin dots' containers. |
| `sm` | 12 | Small inline controls. |
| `md` | 16 | Quick-log tiles, segmented thumbs. |
| `lg` | 22 | User bubbles (with an 8px corner toward the user). Settings groups use 24 (see Settings row). |
| `card` | 26 | Widgets, sheet sections. |
| `sheet` | 36 | Expanded Pulse, bottom sheets (top corners only). |
| `pill` | 999 | Chips, buttons, the Pulse strip, composer, past-session rows. |

Rounder than v1 on purpose: soft shapes are part of the companion feel. Keep corners consistent; do not invent in-between radii.

## The home screen

### The Pulse

**Collapsed strip** (52px pill, `surface`): one horizontal row. The current profile-local date replaces bodyweight beside the consistency bars and count. Refresh it with the shared five-minute clock and on foreground. Items run left to right, separated by 1 × 18 `line-strong` rules:

1. **Week:** seven 6 × 14 bars, one per day Mon–Sun. Trained = `accent`, today = 1.5px `accent` outline, otherwise `surface-high`. Then the count: `1` (`ink`, 14/600) + `of 3` (`caption`, muted). The target is `trainingReality.weeklySessions`; if it is unknown, show the count only.
2. **Date:** Wed, Oct 7 in secondary `caption` text, on the same baseline as the count. Bodyweight stays in its Today widget and expanded Progress.
3. **Nearest goal:** an 18px ring (track `surface-high`, fill `accent`) + `8` + `/10` (muted). If there are no active goals, omit the item and its separator. `reedPulseStripMetrics` preserves the week and date on narrow pills: below 270px use 4px day bars with 2px gaps; show the goal ring from 300px width, and its values from 400px. The full goal remains in expanded Progress.
4. A chevron-down (16px, muted) at the end.

An unread "From Reed" note adds a 6px `accent` dot at the strip's top-right edge. It replaces v1's Progress-pill indicator.

**Expanded** (tap or pull down): the strip morphs into a sheet. The top edge stays anchored, `left/right` go to 8, height grows to the screen minus the dock, the radius goes to `sheet`, and the colour goes to `sheet`. The content, in order, is the **existing Progress view**, restyled:

1. Header: `This week` (`title`) + date range (`caption`), close button (chevron-up, 40px circle `surface-raised`).
2. From Reed: compact idle mascot (40) + the current profile insight in `body`, `ink-secondary`, clamped to three lines with More / Less.
3. **Sessions** row: opens the existing Sessions page (history, summaries).
4. Training: period control (Week / 30D / 90D), sets · reps · load, the muscle split ring with legend, top exercises.
5. Consistency: weekly bars plus "N of last 8 weeks on target".
6. Bodyweight: value, delta, trend line, `Log weight` (soft button), which opens the existing log-weight flow.
7. Goals: active goals with progress bars; "Open full goals list" goes to the existing goals view.

Nothing in today's Progress view is dropped. Sections are `card` radius on `surface`, 10px apart.

**Live state** (a workout session is open): the strip turns `accent-soft` with a 1px `accent` 35% ring and shows a live dot, the session name, elapsed time, date and current exercise ("Bench · set 3") in one horizontal row. Tapping it returns to the session. The expanded Progress view is not reachable in this state.

### Thread: two modes

**Today mode** (Reed is the hero):

The hero enters at .9 scale with a gentle spring and a short nod. Title, body, widgets and chips begin at 80, 140, 200 and 260ms. Today chips wrap to at most two rows.

- Give the hero, greeting and supporting line their own flexible area, centred in the space above the cards. Keep widgets and centred chips anchored just above the dock. This moves the greeting into the upper-middle space on quiet days instead of crowding the composer. The hero area has at least `xl` vertical padding; taller content scrolls under the Pulse rather than overlapping. Use a coach note's first sentence as the headline only when it is at most 40 characters; otherwise use the time-of-day greeting and keep the whole note in the body.
- Centred hero mascot (112 on training days and app open, 100 for other moments) with its own small halo.
- `display` greeting: Reed's one-line decision or headline.
- Show one or two centred lines of `voice` only for an actual coach note. The default greeting has no weekly-progress sentence or empty body placeholder; counts already live in the Pulse. The date also lives in the Pulse, without a Today prefix. Dates on previous measurements explicitly describe those measurements.
- Then the moment's widgets (see Widgets) and four contextual starter chips in a balanced 2×2 grid. Each has a leading Ionicon and a short label; allow two lines on small screens. Use `reedTodaySuggestionMetrics` for their 44px targets and compact typography. Actual coach-note answers retain priority over generic starters.
- The starter catalog covers planning, recovery, reflection, check-ins and technique. A small seeded weighted selector uses time of day, week activity, an open session and an active goal. Ineligible choices never enter the draw; four distinct choices span at least three intents. Keep the random seed stable for the Today visit, so background refreshes do not shuffle buttons. Selection uses already-loaded facts and needs no model call or persisted preference.
- **History** is a quiet, right-aligned text action with a time-outline icon directly beneath the Pulse, outside the widgets. `reedHomeUtilityMetrics` defines its 44px target and 18px icon. It opens the same mounted conversation without sending a message or starting a chapter. Past messages remain hidden until that action or sending enters Chat.

**Chat mode** (Reed is in the corner):
- Enter by sending anything (typed, voice, a chip) or tapping Chat history. Wait for the existing thread to be positioned, fade Today away and reveal the conversation with the existing mode timing as Reed glides to the corner. Historical messages do not replay entrance animations. A quiet Today action below the Pulse reverses the transition; preserve the mounted thread and its reading position.
- Messages are bottom-anchored. Reed's replies are plain `voice` text at full width with **no avatar, name or bubble**. User messages are `user-bubble`, right-aligned, max 80% width.
- Day dividers carry time. A quiet, always-visible action row under a sent reply groups React and an icon-only Copy control, each with a 44px minimum target. Copy never overlays text or depends on hover. A thinking prelude exists only while its turn is pending. Thread items are 14px apart, with 12px within a turn.
- Open at the latest message. Keep the visible row anchored while older pages and their live widgets load, and keep chat mode while reading history. Text scrolls through a gradual fade above the composer and behind the presence row, with no hard viewport edge there.
- Past sessions and collapsed widgets are **past rows**: a 46px pill with a 32px icon disc, label, muted meta and chevron. Tapping one opens the thing it represents.
- Scrolling up loads older pages. A day divider (`caption`, muted, centred) separates days; a small spinner + "Loading earlier" sits at the top while a page loads. When scrolled away from the bottom, a centred down-arrow button jumps to the latest message.

**Which mode on open:** Today appears for an unseen coach note or when the server reports a new chapter using the configured gap and session boundaries. Otherwise, return to chat at the latest message. Re-check the shared server result on foreground and navigation return using the five-minute clock. Loading an older page is not re-entry and must not switch modes.

### The presence corner

Chat mode only. One 96px mascot sits above the dock. The derived presence state and delayed hint describe progress. The newest assistant reply supplies at most three horizontal suggestions, with no fallback. Draft text sets them aside; history replaces them with Latest. See interaction checkpoints 1 and 5.

### The dock

- **Session button** (56px circle, `accent`, barbell icon): opens a sheet with “Start a workout” and “Sessions.” The first opens an empty session (`intent: start`); the second opens the session list. While a session is open the button becomes a pill with a live dot and “Resume,” and the first sheet option becomes “Resume workout.” Navigate after the sheet dismisses.
- **Composer** (56px pill, `surface`): `+` on the left, placeholder "Talk to Reed", mic in a 40px `surface-raised` circle on the right. The `+` menu holds **Quick log** (opens the existing quick-log sheet) and the existing attachment actions (camera, library, files).
- While the keyboard is open, the dock rides the keyboard and the presence row stays above it.

### The "You" sheet

The "You" button opens one bottom sheet (`sheet`, radius 36, grabber 38 × 5 `surface-high`) that merges v1's You/Profile page and Settings page. Nothing they show today is dropped; it is regrouped:

1. Identity: avatar (56), name (`title`), email (`caption`), close button.
2. A compact menu opens Body, Practices & priorities, Coaching & week, Preferences and Account. One short summary per row. No expanded report or color picker in the first view.
3. Each section replaces the menu inside the same sheet. Body has individually editable age, height and weight, then gender, body reference and discomfort. Practices use the existing level tiles; priorities retain their numbered icons. Coaching separates week, rhythm, push, recovery, day load and notes. Preferences holds color and coach updates. Account holds name and the existing sign-out/delete confirmation flows.
4. A focused editor reuses the onboarding controls without its mascot, introduction, progress or step navigation. Its header names the field, Cancel returns to the section, and a pinned Save button commits only that field. A failed save keeps the draft. Discomfort loads the existing rotatable body map only while its editor is open; severity and pending selections retain the same rules.

`reedProfileMetrics` owns the 640px content width, the one .88 height the sheet keeps for the menu, every section and every editor (changing sections fades the content; the sheet never resizes), 56px identity avatar, 44px controls and 68px metric targets. Sheet sections and editors use the existing spacing, type, radius and motion tokens. Wide-screen content stays centered. Only content scrolls; the header and Save action stay reachable. Reduced motion removes editor travel. Closing or Cancel discards the draft and restores automatic accent preview.

## Reed's voice in the UI

- Lead with the decision, then the reason. "Upper body today." then "Monday was all legs, so today evens it out."
- One or two sentences per turn on the home screen. Longer answers are fine in chat when asked.
- Ask at most one question per turn, and offer reply chips for it when the answers are predictable.
- Coach energy, not nag energy: no guilt, no hype, no exclamation marks in greetings.
- UI copy is sentence case. Units are always shown (kg, min, sets).

## Widgets

Widgets are the only things Reed puts in the thread besides text. They come from a **fixed catalog**: Reed chooses which widget to show and fills it with references; it never invents layout. See the migration plan for the data contract.

Common anatomy: `card` on `surface`, radius 26, padding 16/18/18. Optional **origin line** at the top: a 6px `accent` dot + `micro` muted text explaining why Reed brought it ("Weigh-ins are best before breakfast"). Then a header row (`headline` title, `caption` muted meta on the right), then content, then actions.

| Widget | Content | Actions |
|:--|:--|:--|
| Session summary | Title + date/duration; 3 stats (sets, reps, kg moved) in `stat`; best set per exercise; PRs marked with an `accent-soft` badge (`+2.5 kg`). | Tap opens the existing session summary/insights. |
| Weigh-in | Last value + date in meta; −/+ steppers (44px circles `surface-raised`), value in 36/600, Save (soft). | Save writes today's bodyweight via the existing mutation. |
| Quick log | Title + "Logs straight to today"; a 3-column grid of the existing quick-log presets Reed picked (44px tiles, `surface-raised`, radius 16) + an outlined "More". | A tile opens the existing quick-log flow preselected; "More" opens the full sheet. |
| Plan | Title + duration; numbered exercises with targets (index discs 26px `surface-raised`); primary CTA "Start …". | Needs Planned Sessions (deferred domain). Do not build before the backend exists. |
| Session change | Strikethrough old exercise → new one, the affected sets, "Swap and go back" (soft) + "Keep …" (quiet). | Applies only through an owned, unexpired confirmation card. |

**Rules:**
- Today widgets use `ExpandableWidget`: one continuous surface that grows from a full-width summary row at least 72px tall into its controls. The row has a 32px icon, a `bodyStrong` label, `caption` detail and a trailing 20px chevron. Keep the icon and label anchored; crossfade contextual detail and rotate the same chevron as it opens. Expanded children inherit the surface through `WidgetCardEmbeddedContext`, with no second card or gap. Use `md` horizontal padding/gaps and `sm` vertical padding on `surface` with `lg` radius. Direct actions can sit beside it. `WidgetDisclosure` controls expansion; only one Today widget opens at a time. Use built-in Reanimated transitions with `reedMotion.widgets.easing` (ease-out) to reveal the measured content height with clipping and opacity over `reedMotion.widgets.revealMs` (220ms), with `contentY` (8px) travel and `chevronDegrees` (−90°); text and icons retain their natural dimensions. Never apply scaling layout transitions to its ancestors. Reduce Motion settles immediately. Collapsed content remains mounted but hidden from touch and accessibility (inert on web), preserving unsaved drafts. Summaries toggle expansion; they do not silently save or dismiss a widget for the day. Chat-attached widgets keep their existing presentation.
- Weigh-in remains available all day in Today, independent of proactive reminder timing or dismissal. It starts collapsed as Log weight, with the previous value and measurement date underneath, or Add your first weigh-in when there is no measurement. Expanded, the same header shows today's date and the controls show a separate Previous value + measurement date. Successful Save collapses to Weight logged, with the logged value + Today underneath and a checkmark; retain this compact confirmation for today's measurement. Quick log follows the same disclosure anatomy. `reedWidgetMetrics` defines the summary target and icon sizes.
- At most two widgets per today moment, and one per chat reply.
- A widget shows live data from queries, not snapshots. It must render correctly if opened a week later.
- Proactive prompts leave when their condition is satisfied (you logged something). Today's saved weight retains a compact confirmation. Existing explicit daily-dismiss markers remain local to the device; collapsing a widget never creates one.
- Unknown widget kinds render nothing (forward compatibility).

## Components

- **ReedText:** variants `display | title | headline | voice | body | bodyStrong | caption | micro | stat`; tones `default | secondary | muted | accent | danger | success`. There are no uppercase or tracked variants.
- **Button:** `primary` (accent fill, pill, 52), `soft` (accent-soft, pill, 38), `quiet` (text only, 38). Press scale 0.97. Disabled opacity 0.45. Auth and onboarding also use 52px `secondary` (outlined) and `ghost` (text only) so their layout stays put. A destructive action is quiet text in `danger-ink` plus a confirmation step.
- **Chip:** 36px pill, `surface`, `ink-secondary` 14px. Selected state: `accent-soft` with `accent-ink`.
- **Card:** see Widgets. No borders.
- **Past row:** see Thread. 46px pill.
- **Segmented control:** track `canvas` (inside a card) radius 18, padding 4, thumb `surface-high`, 32px segments, `caption` labels; active is `ink` 600, inactive `ink-muted`.
- **Toggle:** 46 × 28, `accent` on, `surface-high` off, white thumb.
- **Settings row:** 52px min, `body`, value in `ink-muted` on the right, chevron 15px muted. Group them in `surface` blocks with radius 24 and `line` dividers.
- **Sheet:** `sheet` colour, radius 36 top corners, grabber, content padded by `gutter`. Every bottom sheet is `ReedSheet` (`components/ui/reed-sheet.tsx`); a test fails on a hand-built `Modal`. Drive it with `open`, or present it from a ref when opening is an event. Rules:
  - **One height per sheet.** A sheet that swaps its content (menu → section, list → form, browse → filters, preset → entry) keeps one height and fades the content in; it never resizes while open. A sheet with several resting heights (session insights) lays its content out at the tallest and slides over it (`heightFraction` array + `snapIndex`).
  - **Motion** is `reedSprings.sheet` as plain critically damped physics (stiffness (2π/0.45)², no bounce); never give gorhom a `duration`. The stage recedes behind it, and so does the workout header mascot.
  - **Text inputs** inside a sheet are `ReedSheetTextInput`: gorhom's own input throws on web when it loses focus.
  - **Back** is Android's back button and Escape on web: it steps back through a sheet's views (`onBack`) before it closes.
  - Rows and tiles inside a sheet are `surface-raised`, not `surface` (the sheet is nearly `surface`); chips are 36–40px pills, selected `accent-soft` with `accent-ink`; no borders.
- **Icons:** Ionicons outline at 1.7 visual weight, 20px by default, `ink-secondary` or `ink-muted`. Filled icons only on `accent` fills.

## The mascot

`ReedMascot` (27 expressions, `components/reed/mascot`) is unchanged as an asset. v2 changes where it lives and how big it is. Browse every face with `npm run mascot:sheet`; faces carry no decoration (no sparkles or stars), only a sweat drop (straining, weary) and sleepy "z" marks. Drive a mascot with `useMascot`: `react`, `play` (with per-step `speed` and `transition`, and `loop`), `lookAt`.

| Context | Size | Notes |
|:--|:--|:--|
| Today hero (app open, training day) | 150, up to 195 on wide phones | Centred, with its own halo. The hero is drawn once at its largest size and only scaled down, never up. The greeting chooses its face (`greeting-copy.ts`). |
| Today hero (other moments) | 112 | After a session, rest day. |
| Presence corner (chat mode) | 96 | Bottom-left above the dock. Big enough to read the face. |
| Pulse "From Reed" line | 40 | Compact `idle` face. Note clamps to three lines with More / Less in place. |
| Workout header | 40 | Watching mascot with a 44px Talk to Reed hit area; no glow. |

- **One living mascot per screen.** The hero and the corner are the same instance, moving between two anchors.
- It reacts to real signals only (see `presence/use-reed-presence.ts`). Never infer moods, never shame inactivity.
- Add named sizes `hero: 150`, `heroSmall: 112`, `corner: 96` to `mascotSizes` rather than passing raw numbers.
- Press and hold it on home for a small scene (`presence/hold-eggs.ts`); five quick taps still make it dizzy.

## Motion

### Interaction presence, checkpoint 1

`prototypes/interaction/index.html` specifies the next interaction layer. Its behavior is implemented in checkpoints while retaining the existing surfaces and illustration.

One derived presence state drives the home mascot and status hint: `resting`, `listening`, `following`, `received`, `thinking`, `speaking`, `waitingOnYou`, `concerned`, `watching`, `celebrating`. Recording wins over focus; a pending reply wins over typing and temporary acknowledgements. A deliberate send gets a 300ms `received` beat before `thinking`. Only a reply arriving after the initial history has loaded gets a speaking reaction. Reading or loading history never replays it.

Gaze targets are semantic (`center`, `composer`, `message`, `suggestions`), bounded to six illustration units and settled with `smooth`. Typing acknowledges newly completed words with a 2.5px tick lasting 200ms, at most once per 450ms. A send hops 12px over 420ms. These reactions use shared values and never request a React render per frame. The SVG paths and transforms update on the UI thread, at 30fps at rest and 60fps while reacting. Hidden routes, hidden browser tabs and background apps pause the frame callback.

The pending hint appears after 400ms. It starts with "Thinking", then changes every 4.8 seconds through the 20 authored lines in `components/reed/presence/use-pending-presence.ts`. Each reply chooses a random starting point in the remaining lines; none repeat before that list loops. These lines express Reed's tone while waiting, not chain of thought, tool activity, progress stages or completion estimates. There is no elapsed-time line. Transcription keeps its own "Transcribing" label.

When the backend reports a failed model attempt, the same hint immediately switches to the six authored recovery lines in `REED_RECOVERY_LINES`, such as "Give me a second, mate." and "Let me give that another go." Each recovery run chooses a random starting point, then rotates without repeating until the list loops. The mascot stays in its thinking glyph cycle while the backend retries the primary once, then tries the backup model for that turn. Completion or final failure hides the status immediately. Recovery copy creates no chat rows and never claims a research step or estimated completion time. After three failed attempts, the existing failed assistant row and Retry action appear.

During a pending reply, the existing ring, focus mark, ring and typing dots cycle with the copy using the mascot engine's interrupted-pose morph. All mascot glyph changes use a shared fade-out/fade-in handoff: only one glyph family is visible at a time, so the line, ring and other shapes never overlap during a transition or blink. Paired eyes and the parts of each glyph stay together. The presence state stays `thinking`; this cycle never signals a completed step or an emotion. Label changes fade and rise 4px over 180ms. Hidden surfaces stop scheduling and completion immediately hides the waiting status. Reduced motion and low power keep one thinking glyph; reduced motion uses opacity-only label changes. Screen readers hear a stable wait label rather than every rotating phrase. Reduced motion suppresses body reactions, breathing and spinner movement; idle blinking remains. Voice recording continues to produce an editable transcript before sending.

Research basis: [NN/G's progress-indicator guidance](https://www.nngroup.com/articles/progress-indicators/) explains why a spinner alone becomes less useful during a long wait. Reed varies its authored copy and activity glyph without implying a completion estimate or intermediate steps: the backend reports pending and completion.

Presence timing and distance values live in `reedMotion.presence`. The new `pop` spring is `{ duration: 380, dampingRatio: 0.62 }`.

### Send and receive

Only messages arriving while this surface is visible reveal. The entire reply, including its action controls, fades and rises 14px over 260ms using the shared ease-out curve. History and recycled rows stay settled. A fresh widget follows its introducing text, rising 12px from scale .96 with `smooth`; one light haptic marks its landing. Reduced motion fades the reply and widget together in 200ms. The mascot supplies progress; internal thinking preludes and pending reply rows never render.

An accepted draft or suggestion becomes the real message row once. It enters from 44px below and 8px to the right, scaling from .97 and fading over 260ms with the shared ease-out curve, so it flows from the composer into the thread. The outgoing entrance has an 80ms layout-settle delay so the cleared composer and new row can settle before the bubble becomes visible; incoming replies enter above the presence row and composer. Web positions the thread directly after the latest row commits, using live scroll-host dimensions before ResizeObserver catches up; the row entrance supplies the motion. Native retains platform smooth scrolling. Essential positioning never waits for an animation frame. Sending from history returns to the latest turn. The server acknowledgement keeps that bubble's client identity. Failed transport sends dim the user bubble to 60% with `Not sent · Retry`; retry reuses the original nonce and attachments. Offline transport waits for reconnect. Failed attempts trigger `warning` once. Drafts entered during a pending reply remain editable and never queue.

### Chapters and history

Chapters are visual segments of the same AI thread. The server starts one after a gap strictly greater than `REED_CHAPTER_GAP_MINUTES` (default 60), or a session start/end. Replies remain in their originating user turn's chapter. `getPresence({now})` uses the shared five-minute clock and decides cold home re-entry using this same rule. Existing messages are backfilled through the migrations component; chapter references stay optional during rollout.

Opening chat fetches the newest 30 rows across the same thread, including earlier chapters. Starting another chapter keeps the loaded conversation and scroll owner mounted. Approaching the first loaded row automatically requests another bounded page; no chapter-opening tap or pull gesture is required. Preserve the row being read while older pages enter, including web's measured anchor. Loaded pages remain reactive, including reactions. Day separators use the profile timezone and never guess a chapter for an optimistic row. History never replays message or widget entrances. Latest lives beside the mascot while reading history and replaces suggestions. Sending or choosing Latest resumes following; automatic scrolling stays active until the measured bottom is reached, including later reply, action-bar and widget layout. A native drag or web wheel, touch movement or scrolling key interrupts following so history remains under the user's control. The footer leaves the newest reply above the presence fade and composer. `reedThreadMetrics.historyPrefetch` owns the 160px prefetch distance; `reedMotion.messageEntry` owns the 80ms outgoing layout-settle delay, 260ms ease-out, 44px/8px/.97 outgoing entrance and 14px reply entrance. Reduced motion uses only opacity.

### Composer, checkpoint 2

The field remains editable during a pending reply and keeps the placeholder "Talk to Reed". Its one 40px action circle morphs between microphone and send. Draft text or ready attachments arm Send; a pending turn dims it and refuses another send without queueing. A refused tap uses a 3px, 200ms shake and selection haptic. Focus feedback is a 1.03 pop over 110ms followed by `pop`, with an accent rim at 55% opacity, increasing to 75% while drafting. Reduced motion keeps the color and opacity feedback without scaling or shaking.

The input is 16px / 22px and grows to five lines, then scrolls inside. `reedComposerMetrics` owns the input, control and dock sizes: 40px control, 56px resting session button, 44px focused session button, 112px resting live-session pill, 28px single-line radius and 24px multiline radius. Focus shrinks the session button, retaining its accessible action. Keyboard movement comes from keyboard-controller shared values and carries the dock, thread inset and corner mascot together.

The + menu is anchored above its button, with the existing Quick log, camera, library and file actions. It retains keyboard focus until a chosen action needs another surface. Menu width is 220px and rows have a 52px minimum height. Surfaces remain solid. Focus adds a 22px accent halo behind the composer at 28% opacity, increasing to 36% while drafting. This blurs only the emitted light, never the background or surface.

All motion goes through `design/motion.ts`. v2 adds two spring tokens and a choreography catalog. Every animation must work with Reduce Motion: springs become a 180ms crossfade, glides become a crossfade, and loops stop.

### Tokens

| Token | Config | Use |
|:--|:--|:--|
| `reedSprings.snappy` | existing | Press feedback, toggles. |
| `reedSprings.smooth` | existing | Segment thumbs, small reveals. |
| `reedSprings.gentle` | existing | Existing non-conversation entrances. |
| `reedSprings.morph` (new) | `{ duration: 550, dampingRatio: 0.92 }` | Pulse expand/collapse, mascot glide, stage recede. |
| `reedSprings.sheet` (new) | `{ duration: 450, dampingRatio: 1 }` | Bottom sheets. |

Timings: `micro` 100, `standard` 180, `mode` 240 are unchanged. The ambient tokens are retired.

### Choreography

1. **Mascot glide (today → chat).** On the user's first send: the persistent mascot animates `translateX/Y` and `scale` from the hero anchor to the corner anchor with `morph`. Today rises 24px and fades over 240ms; the thread starts its 220ms fade after 120ms. The new user bubble enters with the shared message entrance. The expression switches to `thinking` at the start of the glide. Anchors are measured with `onLayout`; the mascot lives in an absolutely positioned layer in the home surface, not inside the list. There is no reverse glide: today mode only appears on a fresh open or a new moment, where it renders already settled.
2. **Pulse expand/collapse.** One animated container. On open: the strip's mini content fades out (120ms); the container animates `top/left/right/height/borderRadius/backgroundColor` with `morph`; the full content fades in and moves `-14 → 0` after a 120ms delay; the stage recedes (scale 0.955, opacity 0.55) and the scrim fades in. Close reverses it. Pulling down on the strip drives the same progress value with the finger (Gesture Handler `Pan`), with rubber-banding past the end; release snaps by velocity and position.
3. **Sheet open/close.** The sheet primitive with `sheet`; the stage recedes as above.
4. **Messages and widgets.** Whole-message entrances and widget entrances follow Send and receive above. History never animates. Reply chips stagger by 60ms in chat and 40ms in Today after the reply lands.
5. **Live indicators.** The live dot pulses opacity 1 ↔ 0.35 over 1.6s. The home interaction field and mascot are the other ambient loops; all honor pause rules.
6. **Press.** `getTapScaleStyle` / scale 0.97, `micro`.

**Not allowed:** auroras, confetti, number-roll animations on stats, or ambient effects beyond the approved home interaction field. Its bounded tilt and send wave are specified below.

### Haptics (`expo-haptics`)

| Moment | Haptic |
|:--|:--|
| Chip tap, stepper tap, segment change | `selectionAsync` |
| Pulse opens, message sent | `impactAsync(Light)` |
| Weigh-in saved, quick log saved | `notificationAsync(Success)` |
| Workout haptics | unchanged |

## Workout surfaces

### Interaction workout conversation, checkpoints 8 and 9

The interaction prototype adds a 40px header mascot and deterministic set whispers to the existing workout. One persistent mascot glides into the 56px sheet header with `morph` and back on dismissal. The fixed 88% Reed sheet uses the shared conversation, draft, attachments and voice recorder. It opens without keyboard focus, with exercise/set context and three session starters. No workout glow is added.

Messages accept optional owned live-workout context `{sessionId, exerciseId?, setIndex?}`; indices are zero-based. This identifies the question without authorizing mutations. Whispers are stored at set commitment, at most one information message per exercise plus verified PRs and cautions. They fade after six seconds and retire when interrupted or edited. No model call runs during a set.

Only an explicit, unexpired confirmation card applies a swap. Applied feedback holds for 700ms before dismissal. On return, the confirmed exercise title and target values roll 14px with `smooth`; ordinary edits and logging stay settled. Reduced motion crossfades without travel. Stopping voice leaves its transcript editable before send.

The workout module (Sessions page, timeline, capture view, swipe card, metric pickers, rest view, live cardio, add-exercise sheet, insights and notes sheets) **keeps its structure, gestures and flows**. The interaction work adds the header mascot, whispers, conversation sheet and confirmed-swap feedback described above. It follows the same tokens as home:

- **Session strip** (the top chrome of a session): the Pulse's shape and place, a 52px `surface` pill at `top: safeTop + lg`, `chrome-gutter` on both sides, so moving between home and a session keeps it where it was. Back, the mascot slot and the three dots are each a 44px target.
- **Pages** share the `gutter` edge: the Sessions page, the timeline and the exercise card. Content starts below the strip; the bottom clears the safe inset.
- **Dock** (timeline): the home dock's shape, `chrome-gutter` sides on `canvas`, one 52px row. The primary action is the next sensible step: *Add exercise* until a set is logged, then *Finish workout*; the other is secondary. Notes is a 52px circle (a full-width pill on a finished session). Finishing, or closing an empty draft, asks in a sheet.
- **Cards** (exercise cards, the swipe card, live cardio): `surface`, radius 26, no border, padding 18. Controls on them are `surface-raised`; chips are 36px pills. Row actions are 36px visible with a 44px target. Buttons are `ReedButton`.
- **Sessions page rows**: a 52px date mark (`surface-raised`), what was done as the title (`body-strong`), duration and sets as one `caption` line, chevron. Past quick-log days use the same row. No chips and no per-row cards; section titles are `headline`.
- **Finished sessions** are read-only: no delete controls, set text at full ink, and every exercise with sets shows a check on the rail.

## Do's and Don'ts

**Do:**
- Read this file and open the mockup before touching UI.
- Use theme tokens only. Add a token here before using a new value.
- Keep business rules and data as they are. A UI change that needs a backend change goes through the migration plan's backend track.
- Keep one primary action per view and one living mascot per screen.
- Show live data in widgets; derive "today" cards from facts.
- Test on Android first, then iOS, then web.

**Don't:**
- Don't use blur, glass, translucent fills or shadows on surfaces.
- Don't put avatars on Reed's messages.
- Don't add pages or tabs. New things are sheets, widgets or Pulse sections.
- Don't remove an existing capability (stats, quick actions, settings, editors) while restyling it. Move it; don't drop it.
- Don't let the LLM produce layout. It picks from the widget catalog.
- Don't animate for decoration.
- Don't use uppercase tracked labels or weights above 600.

### Interaction suggestions, checkpoint 5

Chat suggestions come only from the newest completed assistant reply, at most three. Labels use sentence case, at most 24 characters, no emoji, and no trailing punctuation except a question mark. The server filters this envelope without changing the response. There are no fallback chips in chat.

The presence row scrolls horizontally without wrapping. A 28px canvas fade disappears at the end. Draft text sets the mounted row aside over 160ms with a 6px sink, so clearing restores the same scroll position with `pop`. Focus alone keeps it available. Voice, pending delivery and reply reveal also set it aside. While reading history, Latest occupies this same space beside Reed.

`reedSuggestionMetrics` owns chip dimensions and type. `reedMotion.suggestions` owns the 90ms press, .97 scale, .94/8px entrance and 60ms chat or 40ms today stagger. Selection fires on press-in; the existing send commitment uses light. Reduced motion removes scale/translation and fades together.

### Interaction glow, checkpoint 6

The interaction prototype replaces the static home glow with one field. Native renders three additive Skia radial gradients and one transient elliptical send wave. Web uses the same palette and state targets as static SVG gradients, without sensors or a CanvasKit dependency. Workout screens have no field. A thread mask fades text under the Pulse while preserving the single field behind solid message bubbles. Native uses the existing masked-view module; web uses CSS masking.

`reedGlowPalette` and `reedGlowMetrics` in `design/system.ts` own colours, radii, opacity and geometry. `reedMotion.glow` owns the 350ms low-pass response, 2.4s breath at ±32%, word pulse .06/400ms, 900ms wave and 30Hz tilt. Resting energy .35/cy40, listening .5/cy110, thinking .5/warmth.15/breath1/speed2.5, speaking .45, concerned .22. Today places the field behind the measured hero. Tilt is bounded to 6/12/8px depth offsets.

Ambient frames and sensor subscriptions stop when the route is unfocused, the app is inactive, power saving is on or reduced motion is enabled. Reduced motion keeps state changes immediate and the field static. The mascot also pauses ambient work in power saving, while expressions still update. Native frame cost and device keyboard behavior require physical-device verification.

### Touching Reed, checkpoint 7

Tap means Talk to Reed: the composer focuses and keeps its draft. The mascot presses to .92 over 90ms and releases with `pop`; thinking keeps its expression and wobbles. Selection marks the tap. The entire hero/corner is the button.

Optional toys never start voice. Five taps within 1.6s trigger shake, two spinning-ring eyes, then a happy hop, at most once per minute. Holding 500ms gives a happy 1.1/.84 squish and soft haptic; release stretches into a 22px jump with medium. Native dragging resists to 22px, follows the finger with bounded gaze, then springs to its anchor. `reedMotion.touch` owns these values. Reduced motion keeps focus and expressions but removes transforms.

After 45s without input, visible home occasionally glances at 20–40s intervals. After three minutes it rests and the field drops to .18 energy at half speed. Input wakes it. Focus, draft, pending replies, recording, background and power saving suspend these idle timers.


### Onboarding v2 interaction refinement

The preview keeps its dark palette and centered questions. Short answer groups sit toward the bottom of the available scroll area, above the fixed Continue dock. Long steps scroll naturally. Reed's question presence shrinks on compact heights; it must not reserve the same hero space as the welcome. Optional Skip actions sit beside the primary action in the dock.

Sex, birth year, height, weight and body shape are required body basics. They never show Skip. Continue accepts the visible default on the four numeric/shape controls; sex requires a choice. Discomfort, sleep, day load, week, rhythm, practice detail, directions and values remain optional. The dock expands Continue on required steps and makes room for Skip on optional steps using `reedLayoutTransitions.smooth`, with a short opacity/translation reveal for Skip. `reedOnboardingMetrics` owns Skip width 64, letter Skip width 116 and dock gap 8. Reduce Motion applies the new dock layout immediately. The top bar has no hidden Skip button.

The overview starts with collapsed rows, each showing a title and one-line summary. Tapping a row reveals its details and Edit action. The starting plan, support work, priorities and week are revealed only when their sections open. Rows reuse shared layout motion and Reveal; the overview does not shrink text or show every collected answer at once.

`reedOnboardingMetrics` owns the 48px minimum touch target, 20px gutter, 24px answer gap, 104/72px question presence, 180/120px welcome presence, responsive body canvas and 48px day cells. The male/female figure uses the reusable 3D viewer below; neutral retains the transparent generated atlas. Front/back views share anatomical area IDs. Selecting a region shifts the figure left and reveals a vertical five-stop severity rail on the right. The thumb follows the drag continuously and snaps to a labeled severity on release. None removes the region. No injury-history state is inferred from intensity. A text area picker offers the same answers.

Sleep quality appears below duration, with five labeled stops from Restless to Rested; it remains optional. Week pills select a day; three explicit choices below set Available, Already training or Unavailable. Sex choices use Ionicons and accent-ink/data-warm/success-ink/ink-secondary accents, always with labels and selected marks.

`painHigh` is #ed7070, reserved for the strongest self-reported discomfort stop, paired with a text label. The letter choreography and age copy are specified in the following section.

### Onboarding directions, values and delivered letter

After the name, Why do you work out asks for motivation before the activity selection. The first progress chapter contains name and motivation; the second contains activities, practice levels and directions. Activity level tiles use the same label/level layout, without an extra Calisthenics hint. After practice levels, Where do you want to go shows non-Pro practices in the same two-column grid. It is omitted for a single practice or all-Pro selection. Current level remains the base fill. Taps cycle Keep, Grow, All in, Keep; Grow adds a faint ghost fill above the base and All in lights it. Labels carry the meaning alongside fill. Keep is the default and is accepted by Continue. Skip clears directions.

Why do you work out offers eight icon tiles with "Pick up to 3." The former explanation about the first pick winning when time is tight is removed. A short "3 picked. Remove one to choose another." appears only at the limit. Tap order is priority, displayed with numbered badges. Removing a value closes the ranks; reselecting appends it. At three choices, unselected tiles are disabled while selected tiles remain removable. Skip clears values. `reedOnboardingMetrics` owns intention tile height 116, padding 14, and priority badge size 24. Tiles reuse the existing medium radius and press feedback.

The in-memory draft stores aim by practice and an ordered values list. Goal text, seasons, dates and dreams are absent. The preview uses starting rotation weights Keep=1, Grow=2, All in=4; depth breaks otherwise equal practice weights. Values order the coaching priorities when time is tight. Long-run health caps the initial support schedule at two sessions; other values supply their corresponding coaching guidance. These are preview rules, not a deployed planner. Later date and goal prompts belong in the app.

Birth year retains the supplied age-band coaching copy. Names capitalize their first character for the letter. The letter keeps the name greeting but has no practice/value paragraph; those answers still inform the starting plan.

The letter hides chapter progress and uses separate SVG envelope/body/flap layers. `reedMotion.onboarding` owns delivery 280ms, flap 240ms, paper 300ms with 48px travel, initial drop 64px, writing delay 760ms, and overlapping 420ms fades of whole words. `reedMotion.onboarding.letterPace` sets word stagger/pause after each passage: introduction 48/180ms, explanation 60/260ms, promise 75/380ms, reflection 90/420ms, closing 125/600ms, and question 180/650ms. Commas add 70ms, sentence endings 180ms, and authored line breaks 260ms. Introduction, coaching promise and closing use line breaks; promise and closing sections add 12px above the usual 16px paragraph gap. Words only change opacity, with no cursor, translation or scale. The row-follow schedule uses the same word timings as the reveal. The signature retains its 1500ms draw and 500ms hold. It overlays the note's upper-right edge with “With love, 🤍”. `reedOnboardingMetrics` owns its responsive width (up to 190px, 54% of the note), 32px top overlap, 8px right overlap, 48px paper clearance and 64px header clearance; `reedMotion.onboarding.signatureDegrees` gives it an 8° clockwise tilt. The body scrolls independently so the signature stays visible. Measured text rows advance the reading window with a 550ms smooth follow and 32px breathing room; touching or dragging the body pauses following. Showing the full letter cancels follow without jumping. The letter sizes to the measured stage height and reserves the 48px reveal action even after completion, so signing does not resize the note. Reduce Motion leaves scrolling manual; there is no separate recipient label above the paper. YOUR retains accent colour and weight; mascot retreat scale remains .95. Delivery, writing and signature are interruptible with Show full letter or a tap on the note. Skip letter remains available throughout. The ready button appears after the signature and rises using reply widget motion. Reduce Motion shows the finished note and button without staged delivery, writing, pulses or haptics. Large text and small viewports retain scrolling rather than shrinking the copy.

### Accessible workout capture and shared motion

Set capture exposes a quiet Log set or Save set button alongside the swipe. Both invoke the same commit handler and in-flight guard. Shared inputs default their accessibility label to their visible label. Decorative portal hosts never intercept gestures.

The design provider synchronizes the OS reduced-motion preference with shared legacy timing, layout, and press helpers. Reduced motion removes their transforms and layout animation and makes state changes immediate. New Reanimated primitives continue to consume the same preference through `useReedReducedMotion`.

### Onboarding presence and compact discomfort map

Question text keeps its existing bottom alignment. The mascot uses the measured top of the answer group to fill unused space: a question scale up to 1.65, a 32px clearance from the heading, and the existing compact size when space is tight. Only the mascot moves; the reserved layout zone and the text do not. Changes settle with `reedSprings.morph`, immediately under reduced motion. Welcome, synthesis and letter retain their own choreography.

Discomfort uses the prior sex answer to choose the figure: female, male, neutral for other/private; an unanswered value defaults to male. No figure switcher is shown. The 3D figure starts at a slight three-quarter angle with a raised camera; horizontal drag rotates it. One rotation icon toggles front/back with shared timing. Taps colour only the authored selected surface patch and reopen its severity control. Selected areas appear as compact rows below the figure, each with a severity colour, label and remove action. Tapping a row reopens its severity rail. Add area opens the named picker below the figure in the same bounded lower section; the figure stays visible, rotatable and mounted. While open, the picker replaces only the selected-list contents and marks existing choices with their severity and a check. Choosing an area restores the selected list. Long area lists scroll within this lower section, rather than lengthening the page. The right-hand rail shows the current word and endpoints, with keyboard and screen-reader adjustment. The measured stage and heading budget the figure and list together. `reedOnboardingMetrics` owns the 240px minimum and 420px maximum figure heights, 144px selected-list cap, 192px open-picker cap and 34px stage padding clearance. The figure uses the remaining space; only very short screens or large text need page scrolling. Model shift uses the shared morph spring; Reduce Motion applies shift, rail reveal and rotation immediately.

### Local personal accents and centered presence

The automatic accent uses Blue for male, Rose for female, Sage for other/private. No answer uses Blue. Existing profile gender initializes the automatic default only when no local preference exists; onboarding preview selection updates it locally. Settings offers Automatic plus Blue, Rose, Sage, Silver and Amber. A manual choice takes precedence and persists through reloads using AsyncStorage; it is never written to Convex. The stored preference contains color IDs only. Loading storage must not overwrite a choice made while it loads, and profile initialization waits for storage hydration.

Onboarding starts Blue independently of a saved app preference. Its current sex answer supplies the accent after selection, and returning to earlier questions keeps that answer's color. Choosing a sex sets the local app preference to Automatic so the color continues into the app; Settings can override it afterwards. Accent and glow colors blend over `reedMotion.theme.accentMs` (360ms), beginning from the current visible color if interrupted. Reduce Motion applies the final color immediately. Only this short transition publishes intermediate theme colors, at most once per 32ms; it does not add a permanent animation loop.

| Accent | Fill | Fill text | Accent ink |
|:--|:--|:--|:--|
| Blue | #3d66f2 | #ffffff | #aec2ff |
| Rose | #b85070 | #ffffff | #edb0c2 |
| Sage | #33795e | #ffffff | #a2d9ba |
| Silver | #bcc5d1 | #121110 | #dce2ea |
| Amber | #c6a16a | #121110 | #e8c693 |

`accentSoft` derives from each fill at .16 alpha. Home field, mascot halo, controls and selection indicators consume the resolved accent. Pain, destructive, success and workout data colors retain their meanings. Blue retains the existing glow palette; other glow palettes use their fill/ink hues and existing warm data color.

Quiet home with no coach note or expanded widget grows the existing hero up to 25%, including when Log weight is collapsed, using `reedHomeMascotMetrics`: scale 1.25, compact width 320, full width 390, compact height 640. Compact layouts scale the increase down; coach notes, quick logs and expanded widgets retain existing hero sizes. The measured slot continues to own positioning and the one mascot morphs to its existing corner size.

Resting expressions have no built-in lateral gaze bias; semantic gaze and bounded animated glances remain. Unequal eyes retain their expression while their combined visible horizontal bounds are centered. Existing motion and reduced-motion behavior remain.

Listening uses two equally sized upright, rounded eyes on a level baseline: aperture width 50, gap 20, stroke 6.5, rotation 90 degrees, with no body tilt or lateral offset. It replaces the three inward-moving dashes. While listening on home or to an onboarding field, gaze stays centered instead of pointing at the composer. Eye transitions, gentle breathing and occasional vertical blinks reuse the mascot engine; reduced motion retains the static expression and idle blink.

## Reusable body viewer

The male/female discomfort figure is a rotatable, matte 3D body over the page background. The WebGL canvas, DOM host, native WebView and loading overlay are transparent, delivered as gzip of the canonical GLB. Originals, Meshopt alternatives, Blender sources and previews remain outside the runtime dependency graph. A focused Expo DOM component owns Three.js/WebGL; native controls own the area list, rotation shortcut and vertical five-stop pain editor. Horizontal drag rotates; a tap selects the nearest visible body surface using the manifest triangle map. Direct surface hits take priority. When a tap misses the silhouette, visible anchors have a 22px screen-space allowance with occlusion checks. Face/head and unlisted triangles remain unselectable. Anatomical labels are retained; triangle numbers are never stored as product locations. Other/private retains the neutral illustration because this asset release contains no neutral 3D body.

Primary and secondary muscle roles are independent inputs resolved through the canonical aliases, with primary winning overlaps. Unknown/unrepresented groups receive no invented substitute. Primary uses `bodyMuscle` red at .85 opacity; secondary uses data-warm at .65. Pain uses green, orange, strong orange-red (`bodyPainStrong`) and severe red (`bodyPainHigh`) at .85, above muscle patches. Areas awaiting a severity choice use fixed blue (`bodyPending`, #3d66f2) at .6 opacity; choosing severity replaces it with that level's colour. These model colours do not follow the app's gender accent. Onboarding supplies no exercise muscle roles. Inactive highlight nodes are hidden, their materials are independently controlled, and every patch receives both morph weights and their product corrective even while hidden. Depth test, single-sided rendering and vertex-alpha feathering are retained.

The v3.4 source/export contract includes separate biceps and triceps pain regions, patches and triangle runs. Its embedded atlas uses gentle fitted coverage with continuous matte clay on the female back. Runtime uses those authored assets directly, without region remapping or texture shader overrides. Originals remain at the v3.0, v3.1, v3.2 and v3.3 paths. The saved v3.2 meshes are refined without remeshing: softer scapular, chest, lumbar/glute, shoulder and leg contours retain the original height, facial identity, UVs and topology. All appearance endpoints receive the refinement; hidden patches are refitted by source vertex ID. Discomfort uses 45 independent locations: front/back/inner thighs, shins/calves, front/back knees, feet/heels, lateral hips/glutes/groin, and forearms/wrist joints/hands. Lower anterior abdomen belongs to abdomen. Exercise muscle roles remain separate. Torso/arm selection uses its own authored mask, separate from deformation restraints, so torso patches cannot include forearm islands.

Onboarding maps its earlier body-shape answer to relative 0–1 fullness, defaults to .4 if unanswered, and fixes muscularity at 1. It has no extra appearance sliders. These weights describe the figurine's appearance, not calibrated body-fat percentages. Morph and highlight changes update an already loaded scene without decoding again. The viewer renders on demand, caps pixel ratio at 1.5, loads one variant at a time, and releases geometry, materials, textures and its WebGL context on unmount. Errors keep the labeled area picker usable and offer retry.

`reedBodyMetrics` owns the 22px joint radius, 6px drag threshold, .012 radians-per-pixel rotation, 1.5 pixel-ratio cap, .32-radian introductory angle, .16m camera elevation, 80px severity rail, .4 default fullness, camera clearance and highlight strengths. Loading and error copy use existing type/colour tokens. The separate body playground and its query route have been removed; the viewer is used directly by the onboarding discomfort step.

## Launch and app identity

Smiling Reed is the app mark: the existing paired arches, centered on the existing dark orb. iOS uses an opaque 1024px square without baked-in corners. Android uses a transparent 1024px foreground with the orb inside the central 60% safe zone, a canvas background and a separate monochrome mask. Web uses a crisp 64px favicon and an opaque 180px Apple touch icon. Native and JavaScript loading share the same transparent mark, displayed at 180px on canvas.

The first welcome on a device plays one short introduction, remembered locally as `reed.launch-intro.v1`. A running shoe, snowboard and kettlebell orbit smiling Reed, gather inward, then Reed settles into its actual welcome position. The welcome title, activity strips, promise and actions arrive in that order. Returning launches go straight from the static loading mark to the app. The intro can be skipped; Reduce Motion goes directly to the finished welcome. It does not delay authentication or replay when the app returns from the background. Storage failure never blocks entry. `/onboarding-v2?intro=1` replays the introduction for review without changing the stored flag.

`reedLaunchMetrics` owns the 180px loading mark, 248px introduction mascot, 480px stage width, 104px cutouts, responsive orbit bounds and 48px skip target. `reedMotion.launch` owns the 3400ms introduction, orbit/gather/settle phases, object stagger and welcome construction delays. Motion uses the existing easing and entry primitives, with no extra background effects.

The public front door reuses only the new welcome screen. Get started opens the existing sign-up flow; existing-account entry opens sign-in. Persisted onboarding remains on its existing flow until that separate migration is ready.

## Message reactions and manual time

Sent user messages may carry one emoji reaction from Reed, displayed below the bubble. Sent Reed responses have always-visible React and icon-only Copy controls below their text. Tap React or hold the reply for 300ms to open a compact reaction bar beside the message, without a bottom sheet or dimming the conversation. Hold, slide into an emoji, and release to select; a tap-opened bar also scrolls horizontally through the fifteen shared choices. The current emoji toggles off when selected again. Outside tap, Escape and Android Back dismiss the bar. Selection updates immediately and closes the picker; failed saves restore the previous emoji and show an inline error. All loaded history pages subscribe to saved reactions.

`reedMessageActionMetrics` owns the 44px targets, 32px more control and 24px emoji type size. The picker uses existing `xs` padding/gap, raised surfaces and `lg` radius. `reedMotion.messageActions` owns the 300ms hold, 8px slide threshold and .96 entrance scale, using `snappy`; reduced motion removes scale/travel. Copy changes to a checkmark in the same space for the shared 1200ms feedback interval, with accessible Copy/Copied labels.

Duration capture and quick activity logging offer a count-up stopwatch with Start, Pause/Resume and Reset. Pausing fills the duration field; saving captures the current elapsed time. Total workout duration is a separate, optional manual override. Tap the session's duration to edit it or restore automatic timing. Original session timestamps stay intact.

### Authentication

The same Expo auth entry serves phones and web. It sits directly on the canvas, with the smiling mascot and a single heading above Apple/Google buttons and the email form. No enclosing card or segmented mode switch. `reedAuthMetrics` sets a 440px maximum form width, a 128px mascot (96px below 740px viewport height). Use existing spacing, typography and button tokens. Social buttons may have a leading icon in `ReedButton`. Password visibility, recovery, code resend and returning to sign-in are explicit controls. Recovery verifies an email code before accepting a new password; extra Clerk Device Trust verification uses the same code screen.

---
name: Reed
description: A minimalist fitness OS. Adaptive instrument panel, not a tab container. Less is more, always elegant, every element intentional.
colors:
  primary: "#0f172a"
  canvas: "#f7f7f4"
  canvas-secondary: "#ffffff"
  canvas-dark: "#040404"
  canvas-secondary-dark: "#0a0a0a"
  text-primary: "#0f172a"
  text-secondary: "#334155"
  text-muted: "#64748b"
  text-primary-dark: "#f8fafc"
  text-secondary-dark: "#d4d4d8"
  text-muted-dark: "#a1a1aa"
  accent-primary: "#2455e6"
  accent-primary-text: "#f8fafc"
  accent-secondary: "#f43f5e"
  accent-secondary-dark: "#fb7185"
  success: "#166534"
  success-dark: "#86efac"
  danger: "#b91c1c"
  danger-dark: "#fecaca"
  control-active-fill-dark: "#27272a"
typography:
  display:
    fontFamily: Outfit
    fontSize: 34px
    lineHeight: 38px
    letterSpacing: -0.8px
    fontWeight: 900
  title:
    fontFamily: Outfit
    fontSize: 24px
    lineHeight: 28px
    letterSpacing: -0.5px
    fontWeight: 800
  section:
    fontFamily: Outfit
    fontSize: 18px
    lineHeight: 22px
    letterSpacing: -0.2px
    fontWeight: 800
  body:
    fontFamily: Outfit
    fontSize: 15px
    lineHeight: 22px
    fontWeight: 400
  body-strong:
    fontFamily: Outfit
    fontSize: 15px
    lineHeight: 22px
    fontWeight: 600
  label:
    fontFamily: Outfit
    fontSize: 12px
    lineHeight: 16px
    letterSpacing: 1.2px
    fontWeight: 600
  caption:
    fontFamily: Outfit
    fontSize: 13px
    lineHeight: 18px
    fontWeight: 400
rounded:
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
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
components:
  button-primary:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.accent-primary-text}"
    rounded: "{rounded.sm}"
    padding: 18px
  button-secondary:
    backgroundColor: "{colors.canvas-secondary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 18px
  button-ghost:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 18px
  button-danger:
    backgroundColor: "{colors.danger-dark}"
    textColor: "{colors.danger}"
    rounded: "{rounded.sm}"
    padding: 18px
  input:
    backgroundColor: "{colors.canvas-secondary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 16px
  segmented-control:
    backgroundColor: "{colors.canvas-secondary}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.lg}"
    padding: 4px
  segmented-control-active:
    backgroundColor: "{colors.canvas-secondary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
  glass-surface:
    backgroundColor: "{colors.canvas-secondary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
  glass-surface-dark:
    backgroundColor: "{colors.canvas-secondary-dark}"
    textColor: "{colors.text-primary-dark}"
    rounded: "{rounded.xl}"
  glass-surface-danger:
    backgroundColor: "{colors.danger-dark}"
    textColor: "{colors.danger}"
    rounded: "{rounded.xl}"
---

## Overview

Reed is a fitness OS, not a fitness app. The core design provocation: the UI is an adaptive instrument panel, not a fixed container with tabs. The interface grows in complexity as the user earns it — at first it can feel almost empty; layers emerge as the user demonstrates competence and consistency.

**Design personality:** Spare, credible, dark-mode native. Feels like a high-end instrument or a premium editorial publication — not a gamified wellness product. Silence and restraint are part of the brand.

**Primary platform:** Android (mobile-first), with iOS parity.

> **Frontend / design changes:** Always read `DESIGN.md` before implementing or modifying any UI component, screen layout, animation, or colour. It is the single source of truth for tokens, glassmorphism rules, motion, and component contracts.

## Colors

The palette is a **dual-mode system** (light + dark). Both modes share the same named tokens suffixed with `-dark` for dark variants. Never use raw colour values in components — always reference a theme token from `design/system.ts`.

### Light Mode
- **Canvas (#f7f7f4):** Warm off-white base surface. Slightly warmer than pure white to reduce harshness.
- **Canvas Secondary (#ffffff):** Pure white for elevated surfaces only.
- **Text Primary (#0f172a):** Deep ink. Used for all main text and headings.
- **Text Secondary (#334155):** Subordinate copy, metadata.
- **Text Muted (#64748b):** Placeholders, disabled labels, de-emphasised metadata.
- **Accent Primary (#2455e6):** The only vivid interaction colour. Primary actions, focus states, active tabs.
- **Accent Secondary (#f43f5e):** Rose-red for secondary signals, PR badges, accent highlights.
- **Danger (#b91c1c):** Destructive actions and error states.
- **Success (#166534):** Positive confirmations.

### Dark Mode
- **Canvas (#040404):** Near-black, not pure black. Preserves depth.
- **Canvas Secondary (#0a0a0a):** Slightly lighter for cards and surfaces.
- **Text Primary (#f8fafc):** Bright off-white.
- **Text Secondary (#d4d4d8):** Zinc-300.
- **Text Muted (#a1a1aa):** Zinc-400.
- **Accent Secondary (#fb7185):** Brighter in dark mode for vibrancy on dark canvas.
- **Success (#86efac):** Soft green on dark.
- **Danger (#fecaca):** Soft red on dark.

### Translucent / Glass Tokens (prose-only — not expressible as hex)

These values live in `components/ui/glass-material.ts` and must never be hardcoded elsewhere:

| Token | Light | Dark |
|:------|:------|:-----|
| `glass-fill` | `rgba(255,255,255, 0.62)` | `rgba(24,24,27, 0.68)` |
| `glass-highlight` | `rgba(255,255,255, 0.7)` | `rgba(255,255,255, 0.05)` |
| `glass-fallback` | `rgba(255,255,255, 0.76)` | `rgba(24,24,27, 0.9)` |
| `control-fill` | `rgba(241,245,249, 0.94)` | `rgba(24,24,27, 0.82)` |
| `control-border` | `rgba(148,163,184, 0.3)` | `rgba(255,255,255, 0.09)` |
| `control-active-fill` | `rgba(255,255,255, 0.98)` | `#27272a` |
| `input-fill` | `rgba(248,250,252, 0.9)` | `rgba(11,14,20, 0.72)` |
| `input-border` | `rgba(148,163,184, 0.4)` | `rgba(255,255,255, 0.12)` |
| `border-soft` | `rgba(148,163,184, 0.22)` | `rgba(255,255,255, 0.09)` |
| `border-strong` | `rgba(100,116,139, 0.22)` | `rgba(255,255,255, 0.16)` |
| `success-fill` | `rgba(34,197,94, 0.2)` | `rgba(22,163,74, 0.28)` |
| `danger-fill` | `rgba(254,226,226, 0.84)` | `rgba(69,10,10, 0.68)` |
| `danger-border` | `rgba(248,113,113, 0.24)` | `rgba(248,113,113, 0.18)` |

## Typography

**Outfit** is the single typeface family across all UI text. No fallbacks in designed UI — the font is loaded at app boot via Expo Google Fonts.

| Variant | Weight | Size / Line-height | Letter-spacing | Usage |
|:--------|:-------|:-------------------|:---------------|:------|
| display | 900 | 34px / 38px | −0.8px | Screen titles, large numeric readouts |
| title | 800 | 24px / 28px | −0.5px | Sheet titles, section headers |
| section | 800 | 18px / 22px | −0.2px | Within-page section labels |
| body | 400 | 15px / 22px | — | Default paragraph and list text |
| body-strong | 600 | 15px / 22px | — | Emphasis, button labels |
| label | 600 | 12px / 16px | +1.2px UPPERCASE | Micro-labels, control captions, tags |
| caption | 400 | 13px / 18px | — | Timestamps, secondary metadata |
| brand | 600 | 12px / 16px | +1.6px UPPERCASE | Wordmark only — `accent-primary` colour |

Text variants map to the `ReedText` component with `variant` and `tone` props. Do not use raw `Text` elements with inline styles.

**Tones:** `default | muted | accent | accentSecondary | success | danger`

## Layout & Spacing

The spacing scale: `4 → 8 → 12 → 16 → 20 → 28 → 36 → 48px`. Nearly all gaps, padding, and margins derive from this scale.

- Most common: `md (16px)` for internal padding, `lg (20px)` for structural gaps.
- Minimum tap target: `44px` height. Standard interactive row: `54px`.
- Tab bar / floating controls dock `20px` above safe-area bottom with `20px` horizontal margin.

**Key principles:**
- Do not wrap every control or row in a card. Containers are earned — add them only when they carry clear UX meaning.
- No eyebrow + oversized title + subtitle page-chrome unless the screen genuinely warrants it.
- Prefer full-bleed layouts with restrained padding over heavily boxed content.

## Elevation & Depth

Depth is conveyed primarily through **glassmorphism**, not solid shadows.

### Glassmorphism System

Glass surfaces use a three-layer stack on iOS and web:

1. **Blur layer** — `expo-blur` `BlurView` at `intensity: 44` (light) / `36` (dark) with matching tint. Covers the surface with `position: absolute, inset: 0`.
2. **Fill layer** — Translucent `backgroundColor` on the container view (`glass-fill` token).
3. **Highlight layer** — A top-border inset overlay at `opacity: 0.75` to catch the specular edge (`glass-highlight` token).

**Android fallback:** `BlurView` is skipped on Android (artefacts on rounded translucent views). The opaque `glass-fallback` colour is used instead. Shadows are also suppressed on Android.

**Pane tones:**
- `default`: `glass-fill` / `glass-highlight` border / `blur 66` (light), `blur 52` (dark)
- `danger`: `danger-fill` / `danger-border` / same blur levels

**Shadows (iOS/web only):**
- Floating/card: `y:18, blur:24, opacity:0.08` on light; `y:24, blur:30, opacity:0.34` on dark
- Control active: `y:10, blur:18, opacity:0.08` on light; `y:8, blur:16, opacity:0.20` on dark
- Keep card shadows visible by giving scroll content enough horizontal breathing room; do not push `GlassSurface` cards hard against clipped screen edges.

**Backdrop diffusion:** Full-screen scenes use a radial gradient behind glass layers for ambient depth (`cool`, `warm`, `neutral` variants from `getBackdropDiffusionTokens`). These are background-only, not glass colours.

## Shapes

| Token | Value | Usage |
|:------|:------|:------|
| `sm` | 12px | Buttons, inputs |
| `md` | 16px | Control thumbs, inner segments |
| `lg` | 20px | Segmented control shell |
| `xl` | 24px | Cards, sheets, `GlassSurface` |
| `pill` | 999px | Tab bar pill, circular buttons |

## Components

### `ReedButton`
Four variants: `primary`, `secondary`, `ghost`, `danger`. All share `rounded.sm (12px)`, `minHeight: 54px`, `paddingHorizontal: 18px`.
- **Primary:** `accent-primary` fill, white text, floating shadow.
- **Secondary:** `input-fill` + `input-border`, primary text, floating shadow.
- **Ghost:** Transparent, no shadow.
- **Danger:** `danger-fill` / `danger-border` / `danger` text, floating shadow.
- Press: `scale(0.97)`, `100ms easeOut`. Disabled: `opacity: 0.45`.

### `ReedInput`
`rounded.md`, `borderWidth: 1`, `minHeight: 56px`. `input-fill` bg, `input-border` border. Optional `label` prop renders `ReedText label/muted` above the field.

### `ReedText`
Typed `Text` wrapper with `variant` and `tone` props. Never use raw `Text` + inline style for anything covered by these variants.

### `GlassSurface`
`rounded.xl`, `borderWidth: 1`, `overflow: hidden`. Tones: `default` / `danger`. Inner content: `padding: 20px`, `gap: 14px`. On iOS/web renders a `BlurView` behind content; on Android uses opaque fallback fill.

### `SegmentedControl`
Shell: `rounded.lg`, `padding: 4px`. Animated thumb slides via `Animated.timing` at `standard (180ms)`. Active label: `text-primary`. Inactive: `text-muted`. Heights: compact `40px`, default `44px`, stacked (icon+label) `58px`.

### Tab Bar Pill
Floats `20px` above safe-area, `20px` horizontal margin. Min height: `64px`. All glass tokens come from `glass-material.ts`.

## Motion

All animation primitives are single-source in `design/motion.ts`. Do not add custom springs, easing curves, or `LayoutAnimation.configureNext` outside this module.

| Token | Duration | Usage |
|:------|:---------|:------|
| `micro` | 100ms | Press feedback (tap scale), fast toggles |
| `standard` | 180ms | Segmented thumb, tab transitions, list inserts |
| `mode` | 240ms | Theme switch, screen entry/exit |

**Easing:** `easeOut (quad)` for animated values; `easeInOut (quad)` for layout animations.

**Scale:** tap press `0.97`, active tab `1.06`, background sheet `0.98`.

**Opacity:** disabled `0.45`, flash `0.06`, screen-shift `0.95`.

## Do's and Don'ts

**Do:**
- Read this file before any frontend or design change.
- Source all colour values from `design/system.ts` theme tokens. Zero raw hex or rgba in component styles.
- Use `GlassSurface` for any floating card, sheet, or modal.
- Use `ReedText` for all text (variant + tone, not inline styles).
- Let silence communicate. An almost-empty first-launch screen is intentional.
- Animate every interactive state (press scale, tab slide, segment thumb).

**Don't:**
- Don't add shadows or `elevation` on Android glass surfaces.
- Don't hardcode glass RGBA values outside `glass-material.ts`.
- Don't add custom easing or `LayoutAnimation` calls outside `design/motion.ts`.
- Don't nest glassmorphism layers — one glass surface per depth level.
- Don't wrap every row in a card. Chrome should be invisible unless it earns its place.
- Don't add a label + oversized title + subtitle header to every screen.
- Don't show error states with red text alone — always pair with a fill and border change.

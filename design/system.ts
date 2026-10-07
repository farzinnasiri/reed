import type { ColorValue, TextStyle } from 'react-native';

/**
 * Reed's design system tokens (DESIGN.md). Dark only: there is one theme and no appearance
 * setting. Add a token to DESIGN.md before using a new value here.
 */

export const reedBreakpoints = {
  compact: 380,
} as const;

// Phone web preview spacing when the browser supplies no device safe area.
export const reedWebPhoneFrame = {
  maxWidth: 600,
  bottomInset: 22,
} as const;

export const reedThreadMetrics = { historyPrefetch: 160 } as const;

export const reedMessageActionMetrics = { targetSize: 44, moreSize: 32, emojiSize: 24 } as const;

export const reedComposerMetrics = {
  control: 40,
  inputFontSize: 16,
  inputLineHeight: 22,
  inputMaxLines: 5,
  sessionRest: 56,
  sessionFocused: 44,
  sessionLive: 112,
  radius: 28,
  multilineRadius: 24,
  menuWidth: 220,
  menuRowHeight: 52,
  focusRingAlpha: 0.55,
  draftRingAlpha: 0.75,
  focusHalo: 22,
  focusHaloAlpha: 0.28,
  draftHaloAlpha: 0.36,
} as const;

export const reedOnboardingMetrics = {
  hit: 48, gutter: 20, answerGap: 24, presence: 104, compactPresence: 72,
  skipWidth: 64, letterSkipWidth: 116, dockGap: 8,
  signatureWidth: 190, signatureFraction: 0.54, signatureTop: -32, signatureRight: -8, letterTop: 48, letterHeader: 64, letterFollowClearance: 32, letterSectionGap: 12,
  hero: 180, compactHero: 120, compactHeight: 740, bodyHeight: 320, compactBodyHeight: 280, editingBodyHeight: 208, dayWidth: 48, intentionTileHeight: 116, intentionTilePadding: 14, priorityBadge: 24, questionScale: 1.65, questionClearance: 32,
  bodyMaxHeight: 420, bodyMinHeight: 240, bodySelectedHeight: 144, bodyPickerHeight: 192, bodyStageClearance: 34,
} as const;

export const reedAuthMetrics = { maxWidth: 440, mascot: 128, compactMascot: 96, compactHeight: 740 } as const;

export const reedProfileMetrics = { maxWidth: 640, detailFraction: .88, avatar: 56, hit: 44, metricHeight: 68 } as const;

export const reedSessionMetrics = { header: 40, hit: 44, sheetMascot: 56, sheetFraction: 0.88, handle: 24 } as const;

// DESIGN.md → Shapes. Do not invent in-between radii.
export const reedRadii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  card: 26,
  sheet: 36,
  pill: 999,
} as const;

const reedSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
  xxxl: 48,
  gutter: 18,
  chromeGutter: 14,
} as const;

// Outer gutter of the workout, goals and chat screens, so headers, cards and the composer share one edge.
export const SCREEN_CONTENT_HORIZONTAL_MARGIN = reedSpacing.gutter;
// Edge of floating chrome (the Pulse, the workout strip, the dock), slightly wider than content on purpose.
export const SCREEN_CHROME_HORIZONTAL_MARGIN = reedSpacing.chromeGutter;

const reedColors = {
  canvas: '#121110',
  surface: '#1c1a18',
  surfaceRaised: '#26231f',
  surfaceHigh: '#302c27',
  sheet: '#1a1816',
  ink: '#f4efe8',
  inkSecondary: '#b8afa4',
  inkMuted: '#938a7f',
  accent: '#3d66f2',
  accentText: '#ffffff',
  accentInk: '#aec2ff',
  accentSoft: 'rgba(61, 102, 242, 0.16)',
  // Second series in the Pulse training split, and the image editor's warm pen.
  dataWarm: '#e5a36f',
  dangerInk: '#f0a3a3',
  painHigh: '#ed7070',
  bodyMuscle: '#e33e42',
  bodyPending: '#3d66f2',
  bodyPainStrong: '#e9663a',
  bodyPainHigh: '#df343b',
  dangerFill: 'rgba(240, 100, 100, 0.14)',
  // DESIGN.md has no danger border token; derived from danger-ink so error states keep an outline.
  dangerBorder: 'rgba(240, 163, 163, 0.3)',
  successInk: '#9ad7a8',
  line: 'rgba(255, 240, 220, 0.07)',
  lineStrong: 'rgba(255, 240, 220, 0.14)',
  scrim: 'rgba(6, 5, 4, 0.5)',
} as const satisfies Record<string, ColorValue>;

export const reedFonts = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
} as const;

const tabularNums = ['tabular-nums'] as TextStyle['fontVariant'];

const reedTypography = {
  display: { fontFamily: reedFonts.semibold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, fontVariant: tabularNums },
  title: { fontFamily: reedFonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  headline: { fontFamily: reedFonts.semibold, fontSize: 17.5, lineHeight: 24, letterSpacing: -0.2 },
  voice: { fontFamily: reedFonts.regular, fontSize: 16.5, lineHeight: 26 },
  body: { fontFamily: reedFonts.regular, fontSize: 15.5, lineHeight: 22 },
  bodyStrong: { fontFamily: reedFonts.semibold, fontSize: 15.5, lineHeight: 22 },
  caption: { fontFamily: reedFonts.medium, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: reedFonts.medium, fontSize: 12, lineHeight: 16 },
  stat: { fontFamily: reedFonts.semibold, fontSize: 26, lineHeight: 32, letterSpacing: -0.8, fontVariant: tabularNums },
} satisfies Record<string, TextStyle>;

export const reedTheme = {
  colors: reedColors,
  radii: reedRadii,
  spacing: reedSpacing,
  typography: reedTypography,
} as const;

export const reedLaunchMetrics = {
  loadingSize: 180, mascotSize: 248, stageWidth: 480, cutoutSize: 104,
  orbitMaxX: 132, orbitWidthRatio: .3, orbitMaxY: 112, orbitHeightRatio: .16,
  centerHeightRatio: .43, skipTarget: 48, skipInset: 20,
} as const;

export const reedBodyMetrics = {
  jointRadius: 22, dragThreshold: 6, radiansPerPixel: .012, pixelRatioCap: 1.5,
  framePadding: 1.12, cameraDistance: 4, occlusionTolerance: .003,
  primaryStrength: .85, secondaryStrength: .65, pendingStrength: .6,
  painStrength: .85, viewHeight: 320, loadTimeoutMs: 20000,
  introYaw: .32, cameraElevation: .16, severityWidth: 80, severityGap: 8,
  severityInset: 24, severityDot: 14, severityThumb: 28, severityTrack: 4,
  defaultAdiposity: .4,
} as const;

export type ReedTheme = Omit<typeof reedTheme, 'colors'> & { colors: { [Key in keyof typeof reedColors]: string } };

// Domain palette for workout analytics semantics.
// Intentionally separate from core UI accent tokens.
export const workoutSemanticPalette = {
  modalities: {
    cardio: '#059669',
    holds: '#7c3aed',
    load: '#c2410c',
    neutral: '#6f6f6f',
  },
  warmup: {
    activeFill: 'rgba(251, 191, 36, 0.22)',
    activeBorder: '#f59e0b',
    activeText: '#fde68a',
  },
  muscleGroups: {
    arms: '#0f766e',
    back: '#c2410c',
    cardio: '#dc2626',
    chest: '#059669',
    core: '#0891b2',
    legs: '#65a30d',
    other: '#6f6f6f',
    shoulders: '#7c3aed',
  },
  granularMuscleGroups: {
    adductors: '#65a30d',
    biceps: '#9333ea',
    calves: '#10b981',
    cardio: '#f59e0b',
    chest: '#0d9488',
    core: '#f97316',
    forearms: '#a855f7',
    glutes: '#84cc16',
    hamstrings: '#16a34a',
    lats: '#0f766e',
    other: '#6f6f6f',
    quads: '#22c55e',
    shoulders: '#8b5cf6',
    traps: '#14b8a6',
    triceps: '#c026d3',
    upperBack: '#0ea5a4',
  },
  prTypes: {
    load: '#059669',
    output: '#6f6f6f',
    rep: '#7c3aed',
    volume: '#c2410c',
  },
} as const;

export const reedGlowPalette = { accent: '#3d66f2', light: '#5678ff', deep: '#2d50dc', wave: '#5a7dff', warm: '#e5a36f' } as const;
export const reedGlowMetrics = { radii: [270, 205, 225], alpha: [0.4, 0.26, 0.22], tilt: [6, 12, 8], waveRadius: 300, waveX: 1.4, waveY: 0.45, waveAlpha: 0.22 } as const;

export const reedSuggestionMetrics = { height: 36, padding: 15, fontSize: 14, lineHeight: 20, fadeWidth: 28, gap: 8 } as const;
export const reedTodaySuggestionMetrics = { height: 44, padding: 10, fontSize: 13, lineHeight: 18, icon: 16 } as const;
export const reedWidgetMetrics = { summaryHeight: 72, summaryIcon: 32, summaryChevron: 20 } as const;
export const reedHomeUtilityMetrics = { target: 44, icon: 18 } as const;
export const reedPulseStripMetrics = { compactWidth: 270, compactDayWidth: 4, compactDayGap: 2, goalRingMinWidth: 300, goalValueMinWidth: 400 } as const;

export function withColorAlpha(color: string, opacity: number) {
  const normalizedOpacity = Math.max(0, Math.min(1, opacity));
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (hex) {
    const value = hex[1];
    const normalizedHex = value.length === 3
      ? value.split('').map(chunk => `${chunk}${chunk}`).join('')
      : value;
    const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
    const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
    const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${normalizedOpacity})`;
  }

  const rgb = color.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const channels = rgb[1].split(',').map(part => part.trim());
    if (channels.length >= 3) {
      const [red, green, blue] = channels;
      return `rgba(${red}, ${green}, ${blue}, ${normalizedOpacity})`;
    }
  }

  return color;
}

// Local accent choices. Semantic status/data colors stay independent of the personal accent.
export const reedAccentPalettes = {
  blue: { label: 'Blue', accent: '#3d66f2', accentText: '#ffffff', accentInk: '#aec2ff' },
  rose: { label: 'Rose', accent: '#b85070', accentText: '#ffffff', accentInk: '#edb0c2' },
  sage: { label: 'Sage', accent: '#33795e', accentText: '#ffffff', accentInk: '#a2d9ba' },
  silver: { label: 'Silver', accent: '#bcc5d1', accentText: '#121110', accentInk: '#dce2ea' },
  amber: { label: 'Amber', accent: '#c6a16a', accentText: '#121110', accentInk: '#e8c693' },
} as const;
export type ReedAccent = keyof typeof reedAccentPalettes;
export type ReedGlowPalette = { [Key in keyof typeof reedGlowPalette]: string };
export function themeForAccent(accent: ReedAccent): ReedTheme {
  const palette = reedAccentPalettes[accent];
  return { ...reedTheme, colors: { ...reedColors, accent: palette.accent, accentText: palette.accentText, accentInk: palette.accentInk, accentSoft: withColorAlpha(palette.accent, .16) } };
}
export function glowPaletteForAccent(accent: ReedAccent): ReedGlowPalette {
  if (accent === 'blue') return reedGlowPalette;
  const palette = reedAccentPalettes[accent];
  return { accent: palette.accent, light: palette.accentInk, deep: palette.accent, wave: palette.accentInk, warm: reedColors.dataWarm };
}
export const reedHomeMascotMetrics = { quietScale: 1.3, minWidth: 320, fullWidth: 390, compactHeight: 640 } as const;

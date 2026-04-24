import { Platform, type ColorValue, type TextStyle, type ViewStyle } from 'react-native';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
  xxxl: 48,
} as const;

export const reedRadii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

// Domain palette for workout analytics semantics.
// Intentionally separate from core UI accent tokens.
export const workoutSemanticPalette = {
  modalities: {
    cardio: '#059669',
    holds: '#7c3aed',
    load: '#c2410c',
    neutral: '#64748b',
  },
  muscleGroups: {
    arms: '#0f766e',
    back: '#c2410c',
    cardio: '#dc2626',
    chest: '#059669',
    core: '#0891b2',
    legs: '#65a30d',
    other: '#64748b',
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
    other: '#64748b',
    quads: '#22c55e',
    shoulders: '#8b5cf6',
    traps: '#14b8a6',
    triceps: '#c026d3',
    upperBack: '#0ea5a4',
  },
  prTypes: {
    load: '#059669',
    output: '#64748b',
    rep: '#7c3aed',
    volume: '#c2410c',
  },
} as const;

const radii = reedRadii;

const typography = {
  display: {
    fontFamily: 'Outfit_900Black',
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
  } satisfies TextStyle,
  title: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.5,
  } satisfies TextStyle,
  section: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.2,
  } satisfies TextStyle,
  body: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    lineHeight: 22,
  } satisfies TextStyle,
  bodyStrong: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    lineHeight: 22,
  } satisfies TextStyle,
  label: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  caption: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    lineHeight: 18,
  } satisfies TextStyle,
} as const;

type ReedTheme = {
  mode: ThemeMode;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  colors: {
    canvas: ColorValue;
    canvasSecondary: ColorValue;
    glowPrimary: ColorValue;
    glowSecondary: ColorValue;
    textPrimary: ColorValue;
    textSecondary: ColorValue;
    textMuted: ColorValue;
    accentPrimary: ColorValue;
    accentPrimaryText: ColorValue;
    accentSecondary: ColorValue;
    borderSoft: ColorValue;
    borderStrong: ColorValue;
    glassFill: ColorValue;
    glassFallback: ColorValue;
    glassHighlight: ColorValue;
    inputFill: ColorValue;
    inputBorder: ColorValue;
    controlFill: ColorValue;
    controlBorder: ColorValue;
    controlActiveFill: ColorValue;
    controlActiveBorder: ColorValue;
    pillFill: ColorValue;
    pillActiveFill: ColorValue;
    pillActiveText: ColorValue;
    successText: ColorValue;
    successFill: ColorValue;
    dangerText: ColorValue;
    dangerFill: ColorValue;
    dangerBorder: ColorValue;
    overlayScrim: ColorValue;
  };
  gradients: {
    background: readonly [ColorValue, ColorValue, ColorValue];
    glass: readonly [ColorValue, ColorValue];
    glassDanger: readonly [ColorValue, ColorValue];
  };
  shadows: {
    floating: ViewStyle;
    card: ViewStyle;
    controlActive: ViewStyle;
  };
  blur: {
    intensity: number;
    tint: 'light' | 'dark';
  };
  motion: {
    quick: number;
    regular: number;
    slow: number;
  };
};

type ShadowConfig = {
  blur: number;
  color: string;
  elevation: number;
  opacity: number;
  y: number;
};

function createShadow(config: ShadowConfig): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `0px ${config.y}px ${config.blur}px ${toRgba(config.color, config.opacity)}`,
    } as ViewStyle;
  }

  return {
    elevation: config.elevation,
    shadowColor: config.color,
    shadowOffset: { width: 0, height: config.y },
    shadowOpacity: config.opacity,
    shadowRadius: config.blur,
  };
}

function toRgba(hexColor: string, opacity: number) {
  const hex = hexColor.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map(chunk => `${chunk}${chunk}`).join('') : hex;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export const lightTheme: ReedTheme = {
  mode: 'light',
  spacing,
  radii,
  typography,
  colors: {
    canvas: '#f7f7f4',
    canvasSecondary: '#ffffff',
    glowPrimary: 'rgba(14, 165, 233, 0.16)',
    glowSecondary: 'rgba(244, 63, 94, 0.14)',
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    accentPrimary: '#2455e6',
    accentPrimaryText: '#f8fafc',
    accentSecondary: '#f43f5e',
    borderSoft: 'rgba(148, 163, 184, 0.22)',
    borderStrong: 'rgba(100, 116, 139, 0.22)',
    glassFill: 'rgba(255, 255, 255, 0.62)',
    glassFallback: 'rgba(255, 255, 255, 0.76)',
    glassHighlight: 'rgba(255, 255, 255, 0.7)',
    inputFill: 'rgba(248, 250, 252, 0.9)',
    inputBorder: 'rgba(148, 163, 184, 0.4)',
    controlFill: 'rgba(241, 245, 249, 0.94)',
    controlBorder: 'rgba(148, 163, 184, 0.3)',
    controlActiveFill: 'rgba(255, 255, 255, 0.98)',
    controlActiveBorder: 'rgba(148, 163, 184, 0.24)',
    pillFill: 'rgba(241, 245, 249, 0.94)',
    pillActiveFill: 'rgba(255, 255, 255, 0.98)',
    pillActiveText: '#0f172a',
    successText: '#166534',
    successFill: 'rgba(34, 197, 94, 0.2)',
    dangerText: '#b91c1c',
    dangerFill: 'rgba(254, 226, 226, 0.84)',
    dangerBorder: 'rgba(248, 113, 113, 0.24)',
    overlayScrim: 'rgba(248, 250, 255, 0.12)',
  },
  gradients: {
    background: ['#ffffff', '#f7f7f4', '#f7f7f4'],
    glass: ['rgba(255, 255, 255, 0.72)', 'rgba(255, 255, 255, 0.16)'],
    glassDanger: ['rgba(255, 255, 255, 0.66)', 'rgba(254, 226, 226, 0.56)'],
  },
  shadows: {
    floating: {
      ...createShadow({
        blur: 24,
        color: '#0f172a',
        elevation: 12,
        opacity: 0.08,
        y: 18,
      }),
    },
    card: {
      ...createShadow({
        blur: 24,
        color: '#0f172a',
        elevation: 10,
        opacity: 0.08,
        y: 18,
      }),
    },
    controlActive: createShadow({
      blur: 18,
      color: '#0f172a',
      elevation: 4,
      opacity: 0.08,
      y: 10,
    }),
  },
  blur: {
    intensity: 44,
    tint: 'light',
  },
  motion: {
    quick: 100,
    regular: 180,
    slow: 240,
  },
};

export const darkTheme: ReedTheme = {
  mode: 'dark',
  spacing,
  radii,
  typography,
  colors: {
    canvas: '#040404',
    canvasSecondary: '#0a0a0a',
    glowPrimary: 'rgba(56, 189, 248, 0.16)',
    glowSecondary: 'rgba(251, 113, 133, 0.14)',
    textPrimary: '#f8fafc',
    textSecondary: '#d4d4d8',
    textMuted: '#a1a1aa',
    accentPrimary: '#2455e6',
    accentPrimaryText: '#f8fafc',
    accentSecondary: '#fb7185',
    borderSoft: 'rgba(255, 255, 255, 0.09)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
    glassFill: 'rgba(24, 24, 27, 0.68)',
    glassFallback: 'rgba(24, 24, 27, 0.9)',
    glassHighlight: 'rgba(255, 255, 255, 0.05)',
    inputFill: 'rgba(11, 14, 20, 0.72)',
    inputBorder: 'rgba(255, 255, 255, 0.12)',
    controlFill: 'rgba(24, 24, 27, 0.82)',
    controlBorder: 'rgba(255, 255, 255, 0.09)',
    controlActiveFill: '#27272a',
    controlActiveBorder: 'rgba(255, 255, 255, 0.08)',
    pillFill: 'rgba(24, 24, 27, 0.82)',
    pillActiveFill: '#27272a',
    pillActiveText: '#f8fafc',
    successText: '#86efac',
    successFill: 'rgba(22, 163, 74, 0.28)',
    dangerText: '#fecaca',
    dangerFill: 'rgba(69, 10, 10, 0.68)',
    dangerBorder: 'rgba(248, 113, 113, 0.18)',
    overlayScrim: 'rgba(2, 6, 23, 0.18)',
  },
  gradients: {
    background: ['#040404', '#040404', '#0a0a0a'],
    glass: ['rgba(39, 39, 42, 0.76)', 'rgba(24, 24, 27, 0.34)'],
    glassDanger: ['rgba(69, 10, 10, 0.58)', 'rgba(24, 24, 27, 0.4)'],
  },
  shadows: {
    floating: {
      ...createShadow({
        blur: 30,
        color: '#020617',
        elevation: 18,
        opacity: 0.34,
        y: 24,
      }),
    },
    card: {
      ...createShadow({
        blur: 30,
        color: '#020617',
        elevation: 16,
        opacity: 0.34,
        y: 24,
      }),
    },
    controlActive: createShadow({
      blur: 16,
      color: '#020617',
      elevation: 3,
      opacity: 0.2,
      y: 8,
    }),
  },
  blur: {
    intensity: 36,
    tint: 'dark',
  },
  motion: {
    quick: 100,
    regular: 180,
    slow: 240,
  },
};

export type { ReedTheme };

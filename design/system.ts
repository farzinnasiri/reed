import type { ColorValue, ShadowStyleIOS, TextStyle, ViewStyle } from 'react-native';

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

const radii = {
  sm: 14,
  md: 20,
  lg: 28,
  xl: 36,
  pill: 999,
} as const;

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

const lightShadow: ShadowStyleIOS = {
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 18 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
};

const darkShadow: ShadowStyleIOS = {
  shadowColor: '#020617',
  shadowOffset: { width: 0, height: 24 },
  shadowOpacity: 0.34,
  shadowRadius: 30,
};

export const lightTheme: ReedTheme = {
  mode: 'light',
  spacing,
  radii,
  typography,
  colors: {
    canvas: '#e2e8f0',
    canvasSecondary: '#f8fafc',
    glowPrimary: 'rgba(14, 165, 233, 0.16)',
    glowSecondary: 'rgba(244, 63, 94, 0.14)',
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    accentPrimary: '#0ea5e9',
    accentPrimaryText: '#082f49',
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
    successText: '#0369a1',
    successFill: 'rgba(125, 211, 252, 0.18)',
    dangerText: '#b91c1c',
    dangerFill: 'rgba(254, 226, 226, 0.84)',
    dangerBorder: 'rgba(248, 113, 113, 0.24)',
  },
  gradients: {
    background: ['#edf3f9', '#e2e8f0', '#dce4ee'],
    glass: ['rgba(255, 255, 255, 0.72)', 'rgba(255, 255, 255, 0.16)'],
    glassDanger: ['rgba(255, 255, 255, 0.66)', 'rgba(254, 226, 226, 0.56)'],
  },
  shadows: {
    floating: {
      ...lightShadow,
      elevation: 12,
    },
    card: {
      ...lightShadow,
      elevation: 10,
    },
    controlActive: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 4,
    },
  },
  blur: {
    intensity: 44,
    tint: 'light',
  },
  motion: {
    quick: 120,
    regular: 220,
    slow: 360,
  },
};

export const darkTheme: ReedTheme = {
  mode: 'dark',
  spacing,
  radii,
  typography,
  colors: {
    canvas: '#05070b',
    canvasSecondary: '#101319',
    glowPrimary: 'rgba(56, 189, 248, 0.16)',
    glowSecondary: 'rgba(251, 113, 133, 0.14)',
    textPrimary: '#f8fafc',
    textSecondary: '#d4d4d8',
    textMuted: '#a1a1aa',
    accentPrimary: '#38bdf8',
    accentPrimaryText: '#082f49',
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
    successText: '#7dd3fc',
    successFill: 'rgba(14, 116, 144, 0.24)',
    dangerText: '#fecaca',
    dangerFill: 'rgba(69, 10, 10, 0.68)',
    dangerBorder: 'rgba(248, 113, 113, 0.18)',
  },
  gradients: {
    background: ['#05070b', '#090d12', '#10151d'],
    glass: ['rgba(39, 39, 42, 0.76)', 'rgba(24, 24, 27, 0.34)'],
    glassDanger: ['rgba(69, 10, 10, 0.58)', 'rgba(24, 24, 27, 0.4)'],
  },
  shadows: {
    floating: {
      ...darkShadow,
      elevation: 18,
    },
    card: {
      ...darkShadow,
      elevation: 16,
    },
    controlActive: {
      shadowColor: '#020617',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 3,
    },
  },
  blur: {
    intensity: 36,
    tint: 'dark',
  },
  motion: {
    quick: 120,
    regular: 220,
    slow: 360,
  },
};

export type { ReedTheme };

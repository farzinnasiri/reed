import { Platform, type ViewStyle } from 'react-native';
import type { ReedTheme } from '@/design/system';

export type GlassTone = 'default' | 'danger';
export const TAB_DOCK_BASE_BOTTOM_OFFSET = 20;
export const TAB_DOCK_HORIZONTAL_MARGIN = 20;
export const TAB_PILL_MIN_HEIGHT = 64;

type GlassPaneTokens = {
  backgroundColor: string;
  blurIntensity: number;
  borderColor: string;
  shadowStyle: ViewStyle;
};

type GlassControlTokens = {
  activeBackgroundColor: string;
  activeBorderColor: string;
  shellBackgroundColor: string;
  shellBorderColor: string;
  shadowStyle: ViewStyle;
};

type GlassScrimTokens = {
  backgroundColor: string;
  blurIntensity: number;
};

type BackdropDiffusionTokens = {
  cool: readonly [string, string, string];
  coolOpacity: number;
  neutral: readonly [string, string, string];
  warm: readonly [string, string, string];
};

export function canUseGlassBlur() {
  return Platform.OS === 'ios' || Platform.OS === 'web';
}

export function getGlassPaneTokens(theme: ReedTheme, tone: GlassTone = 'default'): GlassPaneTokens {
  const isDark = theme.mode === 'dark';

  if (tone === 'danger') {
    return {
      backgroundColor: isDark ? 'rgba(82, 14, 14, 0.5)' : 'rgba(255, 228, 228, 0.56)',
      blurIntensity: isDark ? 52 : 66,
      borderColor: isDark ? 'rgba(248, 113, 113, 0.38)' : 'rgba(248, 113, 113, 0.36)',
      shadowStyle: createGlassShadowStyle(),
    };
  }

  return {
    backgroundColor: isDark ? 'rgba(13, 18, 27, 0.5)' : 'rgba(255, 255, 255, 0.5)',
    blurIntensity: isDark ? 52 : 66,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.76)',
    shadowStyle: createGlassShadowStyle(),
  };
}

export function getGlassControlTokens(theme: ReedTheme): GlassControlTokens {
  const isDark = theme.mode === 'dark';

  return {
    activeBackgroundColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.78)',
    activeBorderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.9)',
    shellBackgroundColor: isDark ? 'rgba(13, 18, 27, 0.42)' : 'rgba(255, 255, 255, 0.4)',
    shellBorderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.7)',
    shadowStyle: createGlassShadowStyle(),
  };
}

export function getGlassScrimTokens(theme: ReedTheme): GlassScrimTokens {
  if (theme.mode === 'dark') {
    return {
      backgroundColor: 'rgba(2, 6, 23, 0.18)',
      blurIntensity: 18,
    };
  }

  return {
    backgroundColor: 'rgba(248, 250, 255, 0.12)',
    blurIntensity: 18,
  };
}

export function getBackdropDiffusionTokens(theme: ReedTheme): BackdropDiffusionTokens {
  if (theme.mode === 'dark') {
    return {
      cool: ['rgba(68, 170, 236, 0.32)', 'rgba(52, 114, 186, 0.18)', 'rgba(33, 55, 84, 0)'],
      coolOpacity: 0.9,
      neutral: ['rgba(18, 28, 44, 0.54)', 'rgba(12, 18, 30, 0.18)', 'rgba(9, 13, 19, 0)'],
      warm: ['rgba(196, 84, 118, 0.34)', 'rgba(124, 62, 104, 0.2)', 'rgba(36, 28, 42, 0.04)'],
    };
  }

  return {
    cool: ['rgba(142, 211, 255, 0.58)', 'rgba(128, 196, 250, 0.32)', 'rgba(176, 208, 238, 0.02)'],
    coolOpacity: 0.9,
    neutral: ['rgba(236, 245, 255, 0.28)', 'rgba(224, 238, 252, 0.14)', 'rgba(255, 255, 255, 0)'],
    warm: ['rgba(255, 176, 205, 0.54)', 'rgba(246, 182, 213, 0.3)', 'rgba(236, 204, 228, 0.1)'],
  };
}

function createGlassShadowStyle(): ViewStyle {
  // Android often renders rounded translucent surfaces with a rectangular
  // elevation layer. Keep glass shadows on iOS/Web and avoid elevation
  // artifacts on device.
  if (Platform.OS === 'android') {
    return {};
  }

  if (Platform.OS === 'web') {
    return {
      boxShadow: '0px 8px 16px rgba(15, 23, 42, 0.08)',
    } as ViewStyle;
  }

  return {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  };
}

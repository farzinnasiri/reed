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
  if (tone === 'danger') {
    return {
      backgroundColor: String(theme.colors.dangerFill),
      blurIntensity: theme.mode === 'dark' ? 52 : 66,
      borderColor: String(theme.colors.dangerBorder),
      shadowStyle: createGlassShadowStyle(theme),
    };
  }

  return {
    backgroundColor: String(theme.colors.glassFill),
    blurIntensity: theme.mode === 'dark' ? 52 : 66,
    borderColor: String(theme.colors.glassHighlight),
    shadowStyle: createGlassShadowStyle(theme),
  };
}

export function getGlassControlTokens(theme: ReedTheme): GlassControlTokens {
  return {
    activeBackgroundColor: String(theme.colors.controlActiveFill),
    activeBorderColor: String(theme.colors.controlActiveBorder),
    shellBackgroundColor: String(theme.colors.controlFill),
    shellBorderColor: String(theme.colors.controlBorder),
    shadowStyle: createGlassShadowStyle(theme),
  };
}

export function getGlassScrimTokens(theme: ReedTheme): GlassScrimTokens {
  return {
    backgroundColor: String(theme.colors.overlayScrim),
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

function createGlassShadowStyle(theme: ReedTheme): ViewStyle {
  // Android often renders rounded translucent surfaces with a rectangular
  // elevation layer. Keep glass shadows on iOS/Web and avoid elevation
  // artifacts on device.
  if (Platform.OS === 'android') {
    return {};
  }

  const cardShadow = theme.shadows.card ?? {};
  return {
    ...cardShadow,
    elevation: 0,
  };
}

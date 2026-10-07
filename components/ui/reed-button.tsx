import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ColorValue, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { getDisabledOpacity, usePressAnimation } from '@/design/use-press-animation';

// `soft` and `quiet` are the compact 38px pills (DESIGN.md → Buttons); the others are 52px.
type ReedButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'quiet';

type ReedButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: ReedButtonVariant;
};

export function ReedButton({
  disabled,
  label,
  leading,
  style,
  variant = 'primary',
  ...props
}: ReedButtonProps) {
  const { theme } = useReedTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();

  const palettes = {
    primary: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
      textColor: theme.colors.accentText,
    },
    soft: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: 'transparent',
      textColor: theme.colors.accentInk,
    },
    quiet: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      textColor: theme.colors.inkMuted,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      textColor: theme.colors.ink,
    },
    secondary: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.lineStrong,
      textColor: theme.colors.ink,
    },
  } satisfies Record<ReedButtonVariant, { backgroundColor: ColorValue; borderColor: ColorValue; textColor: ColorValue }>;
  const palette = palettes[variant];
  const isCompact = variant === 'soft' || variant === 'quiet';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      {...props}
    >
      <Animated.View
        style={[
          styles.base,
          {
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor,
            opacity: getDisabledOpacity(disabled),
          },
          animatedStyle,
          style,
        ]}
      >
        <View style={[styles.inner, isCompact ? styles.compactInner : null]}>
          {leading}
          <ReedText
            style={{ color: palette.textColor }}
            variant="bodyStrong"
          >
            {label}
          </ReedText>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: reedRadii.pill,
    borderWidth: 1,
  },
  inner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  compactInner: {
    minHeight: 38,
    paddingHorizontal: 15,
  },
});

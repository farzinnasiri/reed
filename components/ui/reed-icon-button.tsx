import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { getGlassControlTokens } from '@/components/ui/glass-material';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

type ReedIconButtonProps = Omit<PressableProps, 'style'> & {
  children: React.ReactNode;
  shape?: 'rounded' | 'pill';
  variant?: 'default' | 'ghost' | 'glass';
};

export function ReedIconButton({
  children,
  disabled,
  shape = 'rounded',
  variant = 'default',
  ...props
}: ReedIconButtonProps) {
  const { theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'default' ? theme.shadows.controlActive : null,
        shape === 'pill' ? styles.pill : null,
        {
          backgroundColor:
            variant === 'ghost'
              ? 'transparent'
              : variant === 'glass'
                ? glassControls.shellBackgroundColor
                : theme.colors.controlFill,
          borderColor:
            variant === 'ghost'
              ? 'transparent'
              : variant === 'glass'
                ? glassControls.shellBorderColor
                : theme.colors.controlBorder,
          ...getTapScaleStyle(pressed, disabled),
        },
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pill: {
    borderRadius: reedRadii.pill,
  },
});

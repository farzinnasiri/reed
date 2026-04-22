import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

type ReedIconButtonProps = Omit<PressableProps, 'style'> & {
  children: React.ReactNode;
  variant?: 'default' | 'ghost';
};

export function ReedIconButton({
  children,
  disabled,
  variant = 'default',
  ...props
}: ReedIconButtonProps) {
  const { theme } = useReedTheme();

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'default' ? theme.shadows.controlActive : null,
        {
          backgroundColor: variant === 'ghost' ? 'transparent' : theme.colors.controlFill,
          borderColor: variant === 'ghost' ? 'transparent' : theme.colors.controlBorder,
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
});

import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { useReedTheme } from '@/design/provider';

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
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
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
    borderRadius: 20,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});

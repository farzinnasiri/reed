import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { getDisabledOpacity, usePressAnimation } from '@/design/use-press-animation';

type ReedIconButtonProps = Omit<PressableProps, 'style'> & {
  children: React.ReactNode;
  shape?: 'rounded' | 'pill';
  variant?: 'default' | 'ghost';
};

export function ReedIconButton({
  children,
  disabled,
  shape = 'rounded',
  variant = 'default',
  ...props
}: ReedIconButtonProps) {
  const { theme } = useReedTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();

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
          shape === 'pill' ? styles.pill : null,
          {
            backgroundColor: variant === 'ghost' ? 'transparent' : theme.colors.surface,
            borderColor: variant === 'ghost' ? 'transparent' : theme.colors.line,
            opacity: getDisabledOpacity(disabled),
          },
          animatedStyle,
        ]}
      >
        {children}
      </Animated.View>
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

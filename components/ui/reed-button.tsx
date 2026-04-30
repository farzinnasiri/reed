import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

type ReedButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ReedButtonProps = Omit<PressableProps, 'style'> & {
  elevated?: boolean;
  label: string;
  style?: StyleProp<ViewStyle>;
  variant?: ReedButtonVariant;
};

export function ReedButton({
  disabled,
  elevated = true,
  label,
  style,
  variant = 'primary',
  ...props
}: ReedButtonProps) {
  const { theme } = useReedTheme();

  const palette =
    variant === 'primary'
      ? {
          backgroundColor: theme.colors.accentPrimary,
          borderColor: theme.colors.accentPrimary,
          textColor: theme.colors.accentPrimaryText,
        }
      : variant === 'danger'
        ? {
            backgroundColor: theme.colors.dangerFill,
            borderColor: theme.colors.dangerBorder,
            textColor: theme.colors.dangerText,
          }
        : variant === 'ghost'
          ? {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              textColor: theme.colors.textPrimary,
            }
          : {
              backgroundColor: theme.colors.inputFill,
              borderColor: theme.colors.inputBorder,
              textColor: theme.colors.textPrimary,
            };

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'ghost' || !elevated ? null : theme.shadows.floating,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          ...getTapScaleStyle(pressed, disabled),
        },
        style,
      ]}
      {...props}
    >
      <View style={styles.inner}>
        <ReedText
          style={{ color: palette.textColor }}
          variant="bodyStrong"
        >
          {label}
        </ReedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: reedRadii.sm,
    borderWidth: 1,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
  },
});

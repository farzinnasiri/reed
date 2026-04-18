import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { useReedTheme } from '@/design/provider';

type ReedTextVariant = 'brand' | 'display' | 'title' | 'section' | 'body' | 'bodyStrong' | 'label' | 'caption';
type ReedTextTone = 'default' | 'muted' | 'accent' | 'accentSecondary' | 'success' | 'danger';

type ReedTextProps = TextProps & {
  style?: StyleProp<TextStyle>;
  tone?: ReedTextTone;
  variant?: ReedTextVariant;
};

export function ReedText({
  style,
  tone = 'default',
  variant = 'body',
  ...props
}: ReedTextProps) {
  const { theme } = useReedTheme();

  const toneStyle: TextStyle = {
    color:
      tone === 'muted'
        ? theme.colors.textMuted
        : tone === 'accent'
          ? theme.colors.accentPrimary
          : tone === 'accentSecondary'
            ? theme.colors.accentSecondary
            : tone === 'success'
              ? theme.colors.successText
              : tone === 'danger'
                ? theme.colors.dangerText
                : theme.colors.textPrimary,
  };

  const variantStyle: TextStyle =
    variant === 'brand'
      ? {
          ...theme.typography.label,
          color: theme.colors.accentPrimary,
          letterSpacing: 1.6,
        }
      : theme.typography[variant];

  return <Text style={[variantStyle, toneStyle, style]} {...props} />;
}

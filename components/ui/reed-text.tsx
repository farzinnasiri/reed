import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { useReedTheme } from '@/design/provider';

type ReedTextVariant =
  | 'display'
  | 'title'
  | 'headline'
  | 'voice'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'micro'
  | 'stat';
type ReedTextTone = 'default' | 'secondary' | 'muted' | 'accent' | 'success' | 'danger';

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
      tone === 'secondary'
        ? theme.colors.inkSecondary
        : tone === 'muted'
          ? theme.colors.inkMuted
          : tone === 'accent'
            ? theme.colors.accentInk
            : tone === 'success'
              ? theme.colors.successInk
              : tone === 'danger'
                ? theme.colors.dangerInk
                : theme.colors.ink,
  };

  return <Text style={[theme.typography[variant], toneStyle, style]} {...props} />;
}

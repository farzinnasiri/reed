import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

type ReedInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  label?: string;
};

export function ReedInput({ containerStyle, label, style, ...props }: ReedInputProps) {
  const { theme } = useReedTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <ReedText variant="caption" tone="muted">{label}</ReedText> : null}
      <TextInput
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={String(theme.colors.inkMuted)}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.lineStrong,
            color: theme.colors.ink,
            fontFamily: theme.typography.body.fontFamily,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  input: {
    borderRadius: reedRadii.md,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
});

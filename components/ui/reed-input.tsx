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
      {label ? <ReedText variant="label" tone="muted">{label}</ReedText> : null}
      <TextInput
        placeholderTextColor={String(theme.colors.textMuted)}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.inputFill,
            borderColor: theme.colors.inputBorder,
            color: theme.colors.textPrimary,
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

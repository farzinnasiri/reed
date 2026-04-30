// ---------------------------------------------------------------------------
// ChipSelect — reusable multi-select or single-select chip row.
// Used for training styles, equipment, pain areas, goals, etc.
// ---------------------------------------------------------------------------

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

type ChipOption<T extends string> = {
  label: string;
  value: T;
};

type ChipSelectProps<T extends string> = {
  /** Maximum number of selections allowed. 0 = unlimited. */
  max?: number;
  onChange: (selected: T[]) => void;
  options: ChipOption<T>[];
  selected: T[];
  style?: StyleProp<ViewStyle>;
};

export function ChipSelect<T extends string>({
  max = 0,
  onChange,
  options,
  selected,
  style,
}: ChipSelectProps<T>) {
  const { theme } = useReedTheme();

  function handlePress(value: T) {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      if (max > 0 && selected.length >= max) {
        // Evict the oldest selection (first item) to make room for the new one
        const itemsToKeep = selected.slice(selected.length - max + 1);
        onChange([...itemsToKeep, value]);
      } else {
        onChange([...selected, value]);
      }
    }
  }

  return (
    <View style={[styles.container, style]}>
      {options.map(option => {
        const isActive = selected.includes(option.value);

        return (
          <Pressable
            key={option.value}
            onPress={() => handlePress(option.value)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: isActive
                  ? theme.colors.accentPrimary
                  : theme.colors.controlFill,
                borderColor: isActive
                  ? theme.colors.accentPrimary
                  : theme.colors.controlBorder,
              },
              getTapScaleStyle(pressed),
            ]}
          >
            <ReedText
              style={{
                color: isActive
                  ? theme.colors.accentPrimaryText
                  : theme.colors.textPrimary,
              }}
              variant="bodyStrong"
            >
              {option.label}
            </ReedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    alignItems: 'center',
    borderRadius: reedRadii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';

type SegmentedOption<T extends string> = {
  accessibilityLabel?: string;
  icon?: ReactNode;
  label?: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  compact?: boolean;
  iconOnly?: boolean;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  value: T;
};

export function SegmentedControl<T extends string>({
  compact = false,
  iconOnly = false,
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  const { theme } = useReedTheme();

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: theme.colors.controlFill,
          borderColor: theme.colors.controlBorder,
        },
      ]}
    >
      {options.map(option => {
        const isActive = option.value === value;

        return (
          <Pressable
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.item,
              isActive ? theme.shadows.controlActive : null,
              {
                backgroundColor: isActive ? theme.colors.controlActiveFill : 'transparent',
                borderColor: isActive ? theme.colors.controlActiveBorder : 'transparent',
              },
              compact ? styles.itemCompact : null,
            ]}
          >
            {option.icon ? <View style={styles.iconWrap}>{option.icon}</View> : null}
            {iconOnly ? null : option.label ? (
              <ReedText
                style={{ color: isActive ? theme.colors.pillActiveText : theme.colors.textMuted }}
                variant="bodyStrong"
              >
                {option.label}
              </ReedText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  item: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  itemCompact: {
    minHeight: 40,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
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

const SHELL_PADDING = 4;
const SHOULD_USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function SegmentedControl<T extends string>({
  compact = false,
  iconOnly = false,
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  const { theme } = useReedTheme();
  const [shellWidth, setShellWidth] = useState(0);
  const progress = useRef(new Animated.Value(Math.max(0, options.findIndex(option => option.value === value)))).current;
  const optionIndex = Math.max(0, options.findIndex(option => option.value === value));
  const itemWidth = Math.max(0, (shellWidth - SHELL_PADDING * 2) / Math.max(1, options.length));
  const indicatorTranslateX = useMemo(
    () => Animated.multiply(progress, itemWidth || 0),
    [itemWidth, progress],
  );

  useEffect(() => {
    Animated.timing(progress, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
      toValue: optionIndex,
      useNativeDriver: SHOULD_USE_NATIVE_DRIVER,
    }).start();
  }, [optionIndex, progress]);

  return (
    <View
      onLayout={event => setShellWidth(event.nativeEvent.layout.width)}
      style={[
        styles.shell,
        {
          backgroundColor: theme.colors.controlFill,
          borderColor: theme.colors.controlBorder,
        },
      ]}
    >
      {itemWidth > 0 ? (
        <Animated.View
          style={[
            styles.indicator,
            theme.shadows.controlActive,
            { pointerEvents: 'none' },
            {
              backgroundColor: theme.colors.controlActiveFill,
              borderColor: theme.colors.controlActiveBorder,
              transform: [{ translateX: indicatorTranslateX }],
              width: itemWidth,
            },
          ]}
        />
      ) : null}

      {options.map(option => {
        const isActive = option.value === value;

        return (
          <Pressable
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.item,
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
    padding: SHELL_PADDING,
    position: 'relative',
  },
  indicator: {
    borderRadius: 18,
    borderWidth: 1,
    bottom: SHELL_PADDING,
    left: SHELL_PADDING,
    position: 'absolute',
    top: SHELL_PADDING,
  },
  item: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 12,
    zIndex: 1,
  },
  itemCompact: {
    minHeight: 40,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

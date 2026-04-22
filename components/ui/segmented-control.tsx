import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { getGlassControlTokens } from '@/components/ui/glass-material';
import { ReedText } from '@/components/ui/reed-text';
import { createTiming, getTapScaleStyle, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

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
  const control = getGlassControlTokens(theme);
  const [shellWidth, setShellWidth] = useState(0);
  const progress = useRef(new Animated.Value(Math.max(0, options.findIndex(option => option.value === value)))).current;
  const optionIndex = Math.max(0, options.findIndex(option => option.value === value));
  const shouldStackItems = !iconOnly && options.length > 0 && options.every(option => Boolean(option.icon && option.label));
  const itemWidth = Math.max(0, (shellWidth - SHELL_PADDING * 2) / Math.max(1, options.length));
  const indicatorTranslateX = useMemo(
    () => Animated.multiply(progress, itemWidth || 0),
    [itemWidth, progress],
  );

  useEffect(() => {
    createTiming(progress, optionIndex, reedMotion.durations.standard, undefined, SHOULD_USE_NATIVE_DRIVER).start();
  }, [optionIndex, progress]);

  return (
    <View
      onLayout={event => setShellWidth(event.nativeEvent.layout.width)}
      style={[
        styles.shell,
        {
          backgroundColor: control.shellBackgroundColor,
          borderColor: control.shellBorderColor,
        },
      ]}
    >
      {itemWidth > 0 ? (
        <Animated.View
          style={[
            styles.indicator,
            control.shadowStyle,
            { pointerEvents: 'none' },
            {
              backgroundColor: control.activeBackgroundColor,
              borderColor: control.activeBorderColor,
              transform: [{ translateX: indicatorTranslateX }],
              width: itemWidth,
            },
          ]}
        />
      ) : null}

      {options.map(option => {
        const isActive = option.value === value;
        const hasIconAndLabel = Boolean(option.icon && option.label);

        return (
          <Pressable
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.item,
              compact ? styles.itemCompact : null,
              shouldStackItems ? styles.itemStacked : null,
              getTapScaleStyle(pressed),
            ]}
          >
            {option.icon ? <View style={styles.iconWrap}>{option.icon}</View> : shouldStackItems ? <View style={styles.iconSpacer} /> : null}
            {iconOnly ? null : option.label ? (
              <ReedText
                style={[
                  shouldStackItems && hasIconAndLabel ? styles.stackedLabel : null,
                  { color: isActive ? theme.colors.pillActiveText : theme.colors.textMuted },
                ]}
                variant={shouldStackItems ? 'caption' : 'bodyStrong'}
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
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    padding: SHELL_PADDING,
    position: 'relative',
  },
  indicator: {
    borderRadius: reedRadii.md,
    borderWidth: 1,
    bottom: SHELL_PADDING,
    left: SHELL_PADDING,
    position: 'absolute',
    top: SHELL_PADDING,
  },
  item: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
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
  itemStacked: {
    gap: 4,
    minHeight: 58,
    paddingBottom: 8,
    paddingTop: 8,
  },
  stackedLabel: {
    lineHeight: 16,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSpacer: {
    height: 18,
  },
});

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
  style?: StyleProp<ViewStyle>;
  value: T;
  variant?: 'default' | 'ghost' | 'pill';
};

const SHELL_PADDING = 4;
type ItemLayout = {
  width: number;
  x: number;
};

export function SegmentedControl<T extends string>({
  compact = false,
  iconOnly = false,
  onChange,
  options,
  style,
  value,
  variant = 'default',
}: SegmentedControlProps<T>) {
  const { theme } = useReedTheme();
  const control = getGlassControlTokens(theme);
  const [itemLayouts, setItemLayouts] = useState<Record<string, ItemLayout>>({});
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const hasPositionedIndicator = useRef(false);
  const shouldStackItems = !iconOnly && options.length > 0 && options.every(option => Boolean(option.icon && option.label));
  const optionSignature = useMemo(() => options.map(option => option.value).join('|'), [options]);
  const activeLayout = itemLayouts[value];

  useEffect(() => {
    hasPositionedIndicator.current = false;
    indicatorX.setValue(0);
    indicatorWidth.setValue(0);
    setItemLayouts({});
  }, [indicatorWidth, indicatorX, optionSignature]);

  useEffect(() => {
    if (!activeLayout) {
      return;
    }

    if (!hasPositionedIndicator.current) {
      indicatorX.setValue(activeLayout.x);
      indicatorWidth.setValue(activeLayout.width);
      hasPositionedIndicator.current = true;
      return;
    }

    Animated.parallel([
      createTiming(indicatorX, activeLayout.x, reedMotion.durations.standard, undefined, false),
      createTiming(indicatorWidth, activeLayout.width, reedMotion.durations.standard, undefined, false),
    ]).start();
  }, [activeLayout, indicatorWidth, indicatorX]);

  return (
    <View
      accessibilityRole="tablist"
      style={[
        variant === 'pill' ? styles.pillShell : styles.shell,
        variant === 'ghost'
          ? styles.ghostShell
          : {
              backgroundColor: control.shellBackgroundColor,
              borderColor: control.shellBorderColor,
            },
        style,
      ]}
    >
      {activeLayout ? (
        <Animated.View
          style={[
            variant === 'pill'
              ? styles.pillIndicator
              : variant === 'ghost'
                ? styles.ghostIndicator
                : styles.indicator,
            { pointerEvents: 'none' },
            {
              backgroundColor: control.activeBackgroundColor,
              borderColor: variant === 'default' ? control.activeBorderColor : 'transparent',
              transform: [{ translateX: indicatorX }],
              width: indicatorWidth,
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
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={option.value}
            onLayout={event => {
              const nextLayout = {
                width: event.nativeEvent.layout.width,
                x: event.nativeEvent.layout.x,
              };
              setItemLayouts(layouts => {
                const current = layouts[option.value];
                if (current && current.x === nextLayout.x && current.width === nextLayout.width) {
                  return layouts;
                }
                return { ...layouts, [option.value]: nextLayout };
              });
            }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.item,
              compact ? styles.itemCompact : null,
              variant !== 'default' ? styles.pillItem : null,
              shouldStackItems ? styles.itemStacked : null,
              getTapScaleStyle(pressed),
            ]}
          >
            {option.icon ? <View style={styles.iconWrap}>{option.icon}</View> : shouldStackItems ? <View style={styles.iconSpacer} /> : null}
            {iconOnly ? null : option.label ? (
              <ReedText
                adjustsFontSizeToFit
                ellipsizeMode="tail"
                minimumFontScale={0.78}
                numberOfLines={1}
                style={[
                  styles.label,
                  shouldStackItems && hasIconAndLabel ? styles.stackedLabel : null,
                  {
                    color:
                      variant === 'default' && isActive
                        ? theme.colors.pillActiveText
                        : isActive
                          ? theme.colors.textPrimary
                          : theme.colors.textMuted,
                  },
                ]}
                variant={compact || shouldStackItems ? 'caption' : 'bodyStrong'}
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
  pillShell: {
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    padding: SHELL_PADDING,
  },
  ghostShell: {
    borderWidth: 0,
    gap: 8,
  },
  indicator: {
    borderRadius: reedRadii.md,
    borderWidth: 1,
    bottom: SHELL_PADDING,
    left: 0,
    position: 'absolute',
    top: SHELL_PADDING,
  },
  pillIndicator: {
    borderRadius: reedRadii.pill,
    borderWidth: 0,
    bottom: SHELL_PADDING,
    left: 0,
    position: 'absolute',
    top: SHELL_PADDING,
  },
  ghostIndicator: {
    borderRadius: reedRadii.pill,
    borderWidth: 0,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
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
  label: {
    maxWidth: '100%',
    minWidth: 0,
    textAlign: 'center',
  },
  itemCompact: {
    minHeight: 40,
    paddingHorizontal: 8,
  },
  pillItem: {
    borderRadius: reedRadii.pill,
    minHeight: 44,
    paddingHorizontal: 10,
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

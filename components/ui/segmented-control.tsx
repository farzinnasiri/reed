import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { getGlassControlTokens } from '@/components/ui/glass-material';
import { ReedText } from '@/components/ui/reed-text';
import { reedSprings } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { usePressAnimation } from '@/design/use-press-animation';

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
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const hasPositionedIndicator = useRef(false);
  const shouldStackItems = !iconOnly && options.length > 0 && options.every(option => Boolean(option.icon && option.label));
  const optionSignature = useMemo(() => options.map(option => option.value).join('|'), [options]);
  const activeLayout = itemLayouts[value];

  useEffect(() => {
    hasPositionedIndicator.current = false;
    indicatorX.value = 0;
    indicatorWidth.value = 0;
    setItemLayouts({});
  }, [indicatorWidth, indicatorX, optionSignature]);

  useEffect(() => {
    if (!activeLayout) {
      return;
    }

    if (!hasPositionedIndicator.current) {
      indicatorX.value = activeLayout.x;
      indicatorWidth.value = activeLayout.width;
      hasPositionedIndicator.current = true;
      return;
    }

    indicatorX.value = withSpring(activeLayout.x, reedSprings.smooth);
    indicatorWidth.value = withSpring(activeLayout.width, reedSprings.smooth);
  }, [activeLayout, indicatorWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

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
            },
            indicatorStyle,
          ]}
        />
      ) : null}

      {options.map(option => {
        const isActive = option.value === value;
        const hasIconAndLabel = Boolean(option.icon && option.label);

        return (
          <SegmentedItem
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            compact={compact}
            hasIconAndLabel={hasIconAndLabel}
            icon={option.icon}
            iconOnly={iconOnly}
            isActive={isActive}
            key={option.value}
            label={option.label}
            onChange={() => onChange(option.value)}
            onLayout={nextLayout => {
              setItemLayouts(layouts => {
                const current = layouts[option.value];
                if (current && current.x === nextLayout.x && current.width === nextLayout.width) {
                  return layouts;
                }
                return { ...layouts, [option.value]: nextLayout };
              });
            }}
            shouldStackItems={shouldStackItems}
            variant={variant}
          />
        );
      })}
    </View>
  );
}

function SegmentedItem({
  accessibilityLabel,
  compact,
  hasIconAndLabel,
  icon,
  iconOnly,
  isActive,
  label,
  onChange,
  onLayout,
  shouldStackItems,
  variant,
}: {
  accessibilityLabel?: string;
  compact: boolean;
  hasIconAndLabel: boolean;
  icon?: ReactNode;
  iconOnly: boolean;
  isActive: boolean;
  label?: string;
  onChange: () => void;
  onLayout: (layout: ItemLayout) => void;
  shouldStackItems: boolean;
  variant: 'default' | 'ghost' | 'pill';
}) {
  const { theme } = useReedTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      onLayout={event => {
        onLayout({
          width: event.nativeEvent.layout.width,
          x: event.nativeEvent.layout.x,
        });
      }}
      onPress={onChange}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        styles.item,
        variant !== 'default' ? styles.pillItem : null,
        compact ? styles.itemCompact : null,
        shouldStackItems ? styles.itemStacked : null,
      ]}
    >
      <Animated.View style={[styles.itemContent, animatedStyle]}>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : shouldStackItems ? <View style={styles.iconSpacer} /> : null}
        {iconOnly ? null : label ? (
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
            {label}
          </ReedText>
        ) : null}
      </Animated.View>
    </Pressable>
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
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 12,
    zIndex: 1,
  },
  itemContent: {
    alignItems: 'center',
    gap: 6,
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

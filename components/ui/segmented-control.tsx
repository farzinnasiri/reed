import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ReedText } from '@/components/ui/reed-text';
import { reedSprings } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedFonts, reedRadii } from '@/design/system';
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
  options: readonly SegmentedOption<T>[];
  style?: StyleProp<ViewStyle>;
  value: T;
  // `card` is the control that sits inside a card: a canvas track, 32px segments.
  variant?: 'card' | 'default' | 'ghost' | 'pill';
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
  const [itemLayouts, setItemLayouts] = useState<Record<string, ItemLayout>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const hasPositionedIndicator = useRef(false);
  const shouldStackItems = !iconOnly && options.length > 0 && options.every(option => Boolean(option.icon && option.label));
  const optionSignature = useMemo(() => options.map(option => option.value).join('|'), [options]);
  const [previousOptionSignature, setPreviousOptionSignature] = useState(optionSignature);
  if (previousOptionSignature !== optionSignature) { setPreviousOptionSignature(optionSignature); setItemLayouts({}); }
  const activeLayout = itemLayouts[value];

  useEffect(() => {
    hasPositionedIndicator.current = false;
    indicatorX.value = 0;
    indicatorWidth.value = 0;
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
        variant === 'pill' ? styles.pillShell : variant === 'card' ? styles.cardShell : styles.shell,
        variant === 'ghost'
          ? styles.ghostShell
          : {
              // The track is canvas, sunk into the card it sits on.
              backgroundColor: theme.colors.canvas,
              borderColor: variant === 'card' ? 'transparent' : theme.colors.line,
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
                : variant === 'card'
                  ? styles.cardIndicator
                  : styles.indicator,
            { pointerEvents: 'none' },
            {
              backgroundColor: theme.colors.surfaceHigh,
              borderColor: variant === 'default' ? theme.colors.line : 'transparent',
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
  variant: 'card' | 'default' | 'ghost' | 'pill';
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
        variant !== 'default' && variant !== 'card' ? styles.pillItem : null,
        compact ? styles.itemCompact : null,
        shouldStackItems ? styles.itemStacked : null,
        variant === 'card' ? styles.cardItem : null,
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
              variant === 'card' && isActive ? { fontFamily: reedFonts.semibold } : null,
              {
                color:
                  (variant === 'default' || variant === 'card') && isActive
                    ? theme.colors.ink
                    : isActive
                      ? theme.colors.ink
                      : theme.colors.inkMuted,
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
  cardShell: {
    borderRadius: 18,
    borderWidth: 0,
    flexDirection: 'row',
    padding: SHELL_PADDING,
    position: 'relative',
  },
  cardIndicator: {
    borderRadius: 14,
    borderWidth: 0,
    bottom: SHELL_PADDING,
    left: 0,
    position: 'absolute',
    top: SHELL_PADDING,
  },
  cardItem: {
    borderRadius: 14,
    minHeight: 32,
    paddingHorizontal: 8,
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

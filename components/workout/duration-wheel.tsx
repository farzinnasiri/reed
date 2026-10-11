import { ScrollView } from 'react-native-gesture-handler';
import { useEffect, useRef } from 'react';
import {
  Platform,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useReedTheme } from '@/design/provider';
import { reedWorkoutReviewMetrics as metrics } from '@/design/system';
import { reedMotion } from '@/design/motion';
import * as haptics from '@/design/haptics';

/** A bounded wheel, with the same value available through touch, keys and assistive actions. */
export function DurationWheel({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const { theme } = useReedTheme();
  const scroll = useRef<ScrollView>(null);
  const selected = useRef(value);
  const interacting = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const row = metrics.wheelRow;
  const padding = row * Math.floor(metrics.wheelRows / 2);
  const bounded = (next: number) => Math.max(0, Math.min(max, next));
  const move = (next: number) => {
    const clamped = bounded(next);
    selected.current = clamped;
    onChange(clamped);
    haptics.detent();
    haptics.settled();
    scroll.current?.scrollTo({ y: clamped * row, animated: false });
  };
  useEffect(() => {
    if (!interacting.current || selected.current > max) {
      selected.current = value;
      scroll.current?.scrollTo({ y: value * row, animated: false });
    }
  }, [value, row, max]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function settle() {
    interacting.current = false;
    scroll.current?.scrollTo({ y: selected.current * row, animated: false });
    onChange(selected.current);
    haptics.settled();
  }
  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    interacting.current = true;
    const next = bounded(Math.round(event.nativeEvent.contentOffset.y / row));
    if (next !== selected.current) {
      selected.current = next;
      onChange(next);
      haptics.detent();
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(settle, reedMotion.durations.standard);
  }
  return (
    <View style={{ flex: 1, gap: theme.spacing.xs }}>
      <ReedText tone="muted" variant="caption" style={{ textAlign: 'center' }}>
        {label}
      </ReedText>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          move(value + (event.nativeEvent.actionName === 'increment' ? 1 : -1))
        }
        {...(Platform.OS === 'web'
          ? {
              tabIndex: 0,
              onKeyDown: (event: {
                key: string;
                preventDefault: () => void;
              }) => {
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  event.preventDefault();
                  move(value + (event.key === 'ArrowUp' ? 1 : -1));
                }
              },
            }
          : {})}
        style={{ height: row * metrics.wheelRows, overflow: 'hidden' }}
      >
        <View
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            top: padding,
            left: 0,
            right: 0,
            height: row,
            backgroundColor: theme.colors.surfaceRaised,
            borderRadius: theme.radii.sm,
          }}
        />
        <ScrollView
          ref={scroll}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden={true}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={row}
          decelerationRate="fast"
          bounces={false}
          onLayout={() =>
            scroll.current?.scrollTo({
              y: selected.current * row,
              animated: false,
            })
          }
          onScrollBeginDrag={() => {
            interacting.current = true;
          }}
          onScroll={handleScroll}
          onMomentumScrollEnd={settle}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: padding }}
        >
          {Array.from({ length: max + 1 }, (_, index) => (
            <HapticPressable
              key={index}
              feedback={false}
              accessible={false}
              focusable={false}
              tabIndex={-1}
              accessibilityLabel={`${index} ${label.toLowerCase()}`}
              onPress={() => move(index)}
              style={{
                height: row,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <ReedText
                variant={index === value ? 'stat' : 'title'}
                tone={index === value ? 'default' : 'muted'}
                style={{
                  opacity: Math.abs(index - value) > 1 ? 0.35 : 1,
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                {String(index).padStart(2, '0')}
              </ReedText>
            </HapticPressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

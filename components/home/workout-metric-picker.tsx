import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { RecipeFieldDefinition } from '@/domains/workout/recipes';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';

const ITEM_HEIGHT = 24;
const VISIBLE_ROWS = 5;
const PADDING_HEIGHT = ((VISIBLE_ROWS - 1) / 2) * ITEM_HEIGHT;

type WorkoutMetricPickerProps = {
  compact?: boolean;
  field: RecipeFieldDefinition;
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
  previousValue?: number;
  value: number;
  onChange: (value: number) => void;
};

export function WorkoutMetricPicker({
  compact = false,
  field,
  onInteractionEnd,
  onInteractionStart,
  previousValue,
  value,
  onChange,
}: WorkoutMetricPickerProps) {
  const { theme } = useReedTheme();
  const { height, width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const values = useMemo(
    () => buildRange(field.pickerMin, field.pickerMax, field.step),
    [field.pickerMax, field.pickerMin, field.step],
  );
  const normalizedValue = normalizeValueForField(field, value);
  const normalizedPreviousValue =
    previousValue === undefined ? undefined : normalizeValueForField(field, previousValue);
  const lastOffsetYRef = useRef(0);
  const lastEmittedValueRef = useRef<number>(normalizedValue);
  const isInteractingRef = useRef(false);
  const valueFontSize = Math.max(48, Math.min(68, Math.floor(width * 0.165)));
  const rowMinHeight = compact
    ? Math.max(98, Math.min(124, Math.floor(height * 0.135)))
    : Math.max(132, Math.min(180, Math.floor(height * 0.19)));
  const accentColor = getMetricAccentColor(theme, field, normalizedValue);

  // Clamp an out-of-range initial value a single time. Using a ref guard
  // prevents a re-render ping-pong when onChange causes the parent to re-render
  // with the same (still in-range) value on subsequent renders.
  const hasEmittedInitialClampRef = useRef(false);
  useEffect(() => {
    if (!hasEmittedInitialClampRef.current && normalizedValue !== value) {
      hasEmittedInitialClampRef.current = true;
      onChange(normalizedValue);
    }
    // Only run on mount / when the field definition changes, not when value floats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.key]);

  useEffect(() => {
    const index = findNearestIndex(values, normalizedValue);
    lastEmittedValueRef.current = values[index];

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        animated: false,
        y: index * ITEM_HEIGHT,
      });
    });
  }, [normalizedValue, values]);

  function settle(offsetY: number, source: 'touch' | 'momentum') {
    lastOffsetYRef.current = offsetY;
    const nextValue = getNearestValue(values, offsetY);

    scrollRef.current?.scrollTo({
      animated: true,
      y: findNearestIndex(values, nextValue) * ITEM_HEIGHT,
    });

    if (nextValue !== lastEmittedValueRef.current) {
      lastEmittedValueRef.current = nextValue;
      onChange(nextValue);
    }

    // Release the swipe-card disable when the fling settles. Guard with a ref
    // so we don't fire onInteractionEnd multiple times if both touch-end and
    // momentum-end fire for the same gesture.
    if (source === 'momentum' && isInteractingRef.current) {
      isInteractingRef.current = false;
      onInteractionEnd?.();
    }
  }

  function handleScroll(offsetY: number) {
    lastOffsetYRef.current = offsetY;
    const nextValue = getNearestValue(values, offsetY);

    if (nextValue !== lastEmittedValueRef.current) {
      lastEmittedValueRef.current = nextValue;
      onChange(nextValue);
    }
  }

  return (
    <View style={[styles.row, { minHeight: rowMinHeight }]}>
      <View style={styles.copy}>
        <ReedText style={{ color: theme.colors.textMuted }} variant="label">
          {formatMetricLabel(field)}
          {normalizedPreviousValue !== undefined
            ? ` · PREV ${formatMetricValue(field, normalizedPreviousValue, 'label')}`
            : ''}
        </ReedText>
        <ReedText
          style={{
            color: accentColor,
            fontSize: valueFontSize,
            letterSpacing: -1.8,
            lineHeight: Math.floor(valueFontSize * 0.9),
          }}
          variant="display"
        >
          {formatMetricValue(field, normalizedValue, 'value')}
        </ReedText>
      </View>

      <View style={styles.pickerShell}>
        <View
          style={[
            styles.centerIndicator,
            { pointerEvents: 'none' },
            {
              backgroundColor: accentColor,
            },
          ]}
        />
        <ScrollView
          decelerationRate="fast"
          nestedScrollEnabled
          onMomentumScrollEnd={event => settle(event.nativeEvent.contentOffset.y, 'momentum')}
          onScroll={event => {
            handleScroll(event.nativeEvent.contentOffset.y);
          }}
          onScrollEndDrag={event => settle(event.nativeEvent.contentOffset.y, 'touch')}
          onScrollBeginDrag={() => {
            isInteractingRef.current = true;
            onInteractionStart?.();
          }}
          onTouchEnd={() => {
            settle(lastOffsetYRef.current, 'touch');
            if (isInteractingRef.current) {
              isInteractingRef.current = false;
              onInteractionEnd?.();
            }
          }}
          onTouchStart={() => {
            isInteractingRef.current = true;
            onInteractionStart?.();
          }}
          ref={scrollRef}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          style={styles.picker}
        >
          <View style={{ height: PADDING_HEIGHT }} />
          {values.map((option, tickIndex) => {
            const isSelected = option === normalizedValue;
            // Use the array index for major/minor so that float step sizes
            // (e.g. 0.5, 2.5) don't alias when rounded.
            const isMajor = tickIndex % 2 === 0;

            return (
              <View key={String(option)} style={styles.tickRow}>
                <View
                  style={[
                    styles.tickMark,
                    {
                      backgroundColor: isSelected ? theme.colors.textPrimary : theme.colors.textMuted,
                      height: isSelected ? 4 : isMajor ? 3 : 2,
                      opacity: isSelected ? 1 : isMajor ? 0.72 : 0.38,
                      width: isSelected ? 34 : isMajor ? 24 : 12,
                    },
                  ]}
                />
              </View>
            );
          })}
          <View style={{ height: PADDING_HEIGHT }} />
        </ScrollView>
      </View>
    </View>
  );
}

function buildRange(min: number, max: number, step: number) {
  const values: number[] = [];

  for (let current = min; current <= max + step / 10; current += step) {
    values.push(roundMetric(current));
  }

  return values;
}

function findNearestIndex(values: number[], target: number) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  values.forEach((candidate, index) => {
    const distance = Math.abs(candidate - target);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function getNearestValue(values: number[], offsetY: number) {
  const index = Math.max(0, Math.min(values.length - 1, Math.round(offsetY / ITEM_HEIGHT)));
  return values[index];
}

function formatMetricValue(field: RecipeFieldDefinition, value: number, mode: 'value' | 'label') {
  const rounded = roundMetric(value);

  if (field.key === 'reps') {
    return `${Math.round(rounded)}`;
  }

  if (field.key === 'rpe') {
    return rounded.toFixed(1);
  }

  if (field.key === 'load' || field.key === 'assistLoad' || field.key === 'addedLoad') {
    return rounded.toFixed(1);
  }

  if (field.key === 'duration') {
    return mode === 'value' ? `${Math.round(rounded)}` : `${Math.round(rounded)}s`;
  }

  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function formatMetricLabel(field: RecipeFieldDefinition) {
  if (field.key === 'load') {
    return 'LOAD (KG)';
  }
  if (field.key === 'assistLoad') {
    return 'ASSIST (KG)';
  }
  if (field.key === 'addedLoad') {
    return 'ADDED LOAD (KG)';
  }
  if (field.key === 'reps') {
    return 'REPS';
  }
  if (field.key === 'rpe') {
    return 'TARGET RPE';
  }
  if (field.key === 'duration') {
    return 'DURATION (S)';
  }
  return field.label.toUpperCase();
}

function getMetricAccentColor(
  theme: ReturnType<typeof useReedTheme>['theme'],
  field: RecipeFieldDefinition,
  value: number,
) {
  if (field.key === 'rpe') {
    const min = field.min ?? field.pickerMin;
    const max = field.max ?? field.pickerMax;
    const t = max <= min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
    const low = theme.mode === 'dark' ? '#fbbf24' : '#f59e0b';
    const high = theme.mode === 'dark' ? '#b91c1c' : '#9f1239';
    return blendHex(low, high, t);
  }

  const key = field.key;

  if (key === 'load' || key === 'assistLoad' || key === 'addedLoad') {
    return String(theme.colors.accentPrimary);
  }

  return String(theme.colors.textPrimary);
}

function blendHex(fromHex: string, toHex: string, t: number) {
  const from = parseHexColor(fromHex);
  const to = parseHexColor(toHex);
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(from.r + (to.r - from.r) * clamped);
  const g = Math.round(from.g + (to.g - from.g) * clamped);
  const b = Math.round(from.b + (to.b - from.b) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

function parseHexColor(hex: string) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3 ? normalized.split('').map(char => char + char).join('') : normalized;
  const parsed = Number.parseInt(value, 16);

  return {
    b: parsed & 255,
    g: (parsed >> 8) & 255,
    r: (parsed >> 16) & 255,
  };
}

function roundMetric(value: number) {
  return Number.isInteger(value) ? value : Number(value.toFixed(1));
}

function normalizeValueForField(field: RecipeFieldDefinition, value: number) {
  const min = field.min ?? field.pickerMin;
  const max = field.max ?? field.pickerMax;
  return roundMetric(Math.max(min, Math.min(max, value)));
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  pickerShell: {
    height: ITEM_HEIGHT * VISIBLE_ROWS,
    justifyContent: 'center',
    overflow: 'visible',
    width: 80,
  },
  centerIndicator: {
    borderRadius: 999,
    height: 18,
    position: 'absolute',
    right: 4,
    top: (ITEM_HEIGHT * VISIBLE_ROWS - 18) / 2,
    width: 8,
    zIndex: 10,
  },
  picker: {
    flex: 1,
  },
  tickRow: {
    alignItems: 'flex-end',
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    paddingRight: 12,
  },
  tickMark: {
    borderRadius: 999,
  },
});

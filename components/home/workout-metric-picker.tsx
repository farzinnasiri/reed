import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { isDurationField, type RecipeFieldDefinition } from '@/domains/workout/recipes';
import {
  formatMetricLabel,
  formatMetricValue,
  normalizeMetricInput,
  normalizeMetricValueForField,
  normalizeMinutePart,
  normalizeSecondPart,
  roundMetricValue,
} from '@/domains/workout/metric-formatting';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { useRunningTicker } from './use-running-ticker';

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
  const isDurationMetric = isDurationField(field);
  const values = useMemo(
    () => buildRange(field.pickerMin, field.pickerMax, field.step),
    [field.pickerMax, field.pickerMin, field.step],
  );
  const normalizedValue = normalizeMetricValueForField(field, value);
  const normalizedPreviousValue =
    previousValue === undefined ? undefined : normalizeMetricValueForField(field, previousValue);
  const lastOffsetYRef = useRef(0);
  const lastEmittedValueRef = useRef<number>(normalizedValue);
  const isInteractingRef = useRef(false);
  const valueFontSize = isDurationMetric
    ? Math.max(42, Math.min(58, Math.floor(width * 0.15)))
    : Math.max(48, Math.min(68, Math.floor(width * 0.165)));
  const rowMinHeight = compact
    ? Math.max(98, Math.min(124, Math.floor(height * 0.135)))
    : Math.max(132, Math.min(180, Math.floor(height * 0.19)));
  const accentColor = getMetricAccentColor(theme, field, normalizedValue);
  const [isDurationRunning, setIsDurationRunning] = useState(false);
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [durationMinutesDraft, setDurationMinutesDraft] = useState('');
  const [durationSecondsDraft, setDurationSecondsDraft] = useState('');
  const durationMinutesInputRef = useRef<TextInput | null>(null);
  const durationSecondsInputRef = useRef<TextInput | null>(null);
  const currentValueRef = useRef(normalizedValue);
  const onChangeRef = useRef(onChange);
  const minValue = field.min ?? field.pickerMin;
  const maxValue = field.max ?? field.pickerMax;

  currentValueRef.current = normalizedValue;
  onChangeRef.current = onChange;

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
        animated: !(isDurationMetric && isDurationRunning),
        y: index * ITEM_HEIGHT,
      });
    });
  }, [isDurationMetric, isDurationRunning, normalizedValue, values]);

  useEffect(() => {
    setIsDurationRunning(false);
    setIsEditingDuration(false);
    setDurationMinutesDraft('');
    setDurationSecondsDraft('');
  }, [field.key]);

  useRunningTicker({
    isRunning: isDurationMetric && isDurationRunning,
    onTick: () => {
      const nextValue = normalizeMetric(currentValueRef.current + 1, minValue, maxValue);
      if (nextValue === currentValueRef.current) {
        setIsDurationRunning(false);
        return;
      }
      onChangeRef.current(nextValue);
    },
  });

  function toggleDurationRun() {
    if (!isDurationMetric) {
      return;
    }
    if (isEditingDuration) {
      commitDurationEdit();
    }
    setIsDurationRunning(current => !current);
  }

  function beginDurationEdit() {
    if (!isDurationMetric) {
      return;
    }
    const totalSeconds = Math.round(normalizedValue);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    setIsDurationRunning(false);
    setDurationMinutesDraft(String(minutes));
    setDurationSecondsDraft(seconds.toString().padStart(2, '0'));
    setIsEditingDuration(true);
    onInteractionStart?.();
  }

  function commitDurationEdit() {
    if (!isDurationMetric || !isEditingDuration) {
      return;
    }

    const normalizedMinutes = normalizeMinutePart(durationMinutesDraft);
    const normalizedSeconds = normalizeSecondPart(durationSecondsDraft);

    if (normalizedMinutes.length > 0 || normalizedSeconds.length > 0) {
      const minutes = normalizedMinutes.length > 0 ? Number.parseInt(normalizedMinutes, 10) : 0;
      const seconds = normalizedSeconds.length > 0 ? Number.parseInt(normalizedSeconds, 10) : 0;
      const parsed = minutes * 60 + Math.max(0, Math.min(59, seconds));
      onChange(normalizeMetricInput(parsed, minValue, maxValue));
    }

    setIsEditingDuration(false);
    setDurationMinutesDraft('');
    setDurationSecondsDraft('');
    onInteractionEnd?.();
  }

  function handleDurationMinutesChange(text: string) {
    const normalized = normalizeMinutePart(text);
    setDurationMinutesDraft(normalized);
  }

  function handleDurationSecondsChange(text: string) {
    const normalized = normalizeSecondPart(text);
    setDurationSecondsDraft(normalized);

    if (normalized.length >= 2) {
      durationSecondsInputRef.current?.blur();
    }
  }

  function handleDurationEditorBlur() {
    requestAnimationFrame(() => {
      const minuteInputFocused = durationMinutesInputRef.current?.isFocused() ?? false;
      const secondInputFocused = durationSecondsInputRef.current?.isFocused() ?? false;
      if (!minuteInputFocused && !secondInputFocused) {
        commitDurationEdit();
      }
    });
  }

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
        <View style={styles.metricHeaderRow}>
          <ReedText style={{ color: theme.colors.textMuted }} variant="label">
            {formatMetricLabel(field)}
            {normalizedPreviousValue !== undefined
              ? ` · PREV ${formatMetricValue(field, normalizedPreviousValue)}`
              : ''}
          </ReedText>
        </View>
        {isDurationMetric && isEditingDuration ? (
          <View style={styles.durationEditRow}>
            <TextInput
              autoFocus
              keyboardType="number-pad"
              maxLength={3}
              onBlur={handleDurationEditorBlur}
              onChangeText={handleDurationMinutesChange}
              onSubmitEditing={() => durationSecondsInputRef.current?.focus()}
              ref={durationMinutesInputRef}
              returnKeyType="next"
              style={[
                styles.durationInput,
                styles.durationMinutesInput,
                {
                  color: accentColor,
                  fontSize: valueFontSize,
                  lineHeight: Math.floor(valueFontSize * 0.9),
                },
              ]}
              value={durationMinutesDraft}
            />
            <ReedText
              style={{
                color: accentColor,
                fontSize: valueFontSize,
                lineHeight: Math.floor(valueFontSize * 0.9),
              }}
              variant="display"
            >
              :
            </ReedText>
            <TextInput
              keyboardType="number-pad"
              maxLength={2}
              onBlur={handleDurationEditorBlur}
              onChangeText={handleDurationSecondsChange}
              onSubmitEditing={commitDurationEdit}
              ref={durationSecondsInputRef}
              returnKeyType="done"
              style={[
                styles.durationInput,
                styles.durationSecondsInput,
                {
                  color: accentColor,
                  fontSize: valueFontSize,
                  lineHeight: Math.floor(valueFontSize * 0.9),
                },
              ]}
              value={durationSecondsDraft}
            />
          </View>
        ) : (
          <Pressable
            disabled={!isDurationMetric}
            onPress={beginDurationEdit}
            style={({ pressed }) => [{ opacity: pressed && isDurationMetric ? 0.88 : 1 }]}
          >
            <ReedText
              style={{
                color: accentColor,
                fontSize: valueFontSize,
                letterSpacing: isDurationMetric ? -1.2 : -1.8,
                lineHeight: Math.floor(valueFontSize * 0.9),
              }}
              variant="display"
            >
              {formatMetricValue(field, normalizedValue)}
            </ReedText>
          </Pressable>
        )}
        {isDurationMetric ? (
          <Pressable
            onPress={toggleDurationRun}
            style={({ pressed }) => [
              styles.durationRunButton,
              {
                backgroundColor: theme.colors.controlFill,
                borderColor: theme.colors.controlBorder,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Ionicons
              color={String(theme.colors.textPrimary)}
              name={isDurationRunning ? 'pause' : 'play'}
              size={14}
            />
          </Pressable>
        ) : null}
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
            if (isDurationRunning) {
              setIsDurationRunning(false);
            }
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
            if (isDurationRunning) {
              setIsDurationRunning(false);
            }
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
    values.push(roundMetricValue(current));
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

function normalizeMetric(value: number, min: number, max: number) {
  return normalizeMetricInput(value, min, max);
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
    position: 'relative',
  },
  metricHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
  },
  durationRunButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -14 }],
    width: 28,
  },
  durationInput: {
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -1.2,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  durationEditRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  durationMinutesInput: {
    minWidth: 54,
    textAlign: 'right',
  },
  durationSecondsInput: {
    minWidth: 42,
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

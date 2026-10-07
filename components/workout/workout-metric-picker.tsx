import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
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
import { ReedSwapText } from '@/components/reed/session/reed-swap-feedback';
import { getTapScaleStyle, reedReanimatedEasing } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { useRunningTicker } from './use-running-ticker';

const ITEM_HEIGHT = 24;
const VISIBLE_ROWS = 5;
const PICKER_TOUCH_HEIGHT = 144;
const PICKER_TOUCH_WIDTH = 116;

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
  const isDurationMetric = isDurationField(field);
  const values = useMemo(
    () => buildRange(field.pickerMin, field.pickerMax, field.step),
    [field.pickerMax, field.pickerMin, field.step],
  );
  const normalizedValue = normalizeMetricValueForField(field, value);
  const normalizedPreviousValue =
    previousValue === undefined ? undefined : normalizeMetricValueForField(field, previousValue);
  const dragOffsetY = useSharedValue(0);
  const gestureStartIndex = useSharedValue(0);
  const gesturePreviewIndex = useSharedValue(0);
  const gestureEndedNormally = useSharedValue(false);
  const valueFontSize = isDurationMetric
    ? Math.max(42, Math.min(58, Math.floor(width * 0.15)))
    : Math.max(48, Math.min(68, Math.floor(width * 0.165)));
  const rowMinHeight = compact
    ? Math.max(98, Math.min(124, Math.floor(height * 0.135)))
    : Math.max(132, Math.min(180, Math.floor(height * 0.19)));
  const [isDurationRunning, setIsDurationRunning] = useState(false);
  const [hasStartedDuration, setHasStartedDuration] = useState(false);
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [isEditingNumeric, setIsEditingNumeric] = useState(false);
  const [durationMinutesDraft, setDurationMinutesDraft] = useState('');
  const [durationSecondsDraft, setDurationSecondsDraft] = useState('');
  const [numericDraft, setNumericDraft] = useState('');
  const durationMinutesInputRef = useRef<TextInput | null>(null);
  const durationSecondsInputRef = useRef<TextInput | null>(null);
  const numericInputRef = useRef<TextInput | null>(null);
  const currentValueRef = useRef(normalizedValue);
  const onChangeRef = useRef(onChange);
  const runningStartedAtRef = useRef<number | null>(null);
  const runningBaseValueRef = useRef<number>(normalizedValue);
  const minValue = field.min ?? field.pickerMin;
  const maxValue = field.max ?? field.pickerMax;
  const supportsManualNumericEdit = !isDurationMetric && field.key !== 'rpe';
  const supportsDecimalNumericEdit = supportsManualNumericEdit && !Number.isInteger(field.step);
  const supportsManualEdit = isDurationMetric || supportsManualNumericEdit;
  const selectedIndex = findNearestIndex(values, normalizedValue);
  const [previewIndex, setPreviewIndex] = useState(selectedIndex);
  const previewValue = values[previewIndex] ?? normalizedValue;
  const accentColor = getMetricAccentColor(theme, field, previewValue);

  useEffect(() => { currentValueRef.current = normalizedValue; onChangeRef.current = onChange; }, [normalizedValue, onChange]);

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
    dragOffsetY.value = 0;
  }, [dragOffsetY, normalizedValue, values]);

  const [previousFieldKey, setPreviousFieldKey] = useState(field.key);
  if (previousFieldKey !== field.key) {
    setPreviousFieldKey(field.key);
    setHasStartedDuration(false);
    setIsDurationRunning(false);
    setIsEditingDuration(false);
    setIsEditingNumeric(false);
    setDurationMinutesDraft('');
    setDurationSecondsDraft('');
    setNumericDraft('');
  }
  useEffect(() => { runningStartedAtRef.current = null; }, [field.key]);
  const [previousSelectedIndex, setPreviousSelectedIndex] = useState(selectedIndex);
  if (previousSelectedIndex !== selectedIndex) { setPreviousSelectedIndex(selectedIndex); setPreviewIndex(selectedIndex); }

  const stopDurationRun = useCallback(() => {
    setIsDurationRunning(false);
    runningStartedAtRef.current = null;
  }, []);

  const applyDurationRunProgress = useCallback((now: number) => {
    if (!isDurationMetric || !isDurationRunning || runningStartedAtRef.current === null) {
      return;
    }

    const elapsedSeconds = Math.max(0, Math.floor((now - runningStartedAtRef.current) / 1000));
    const nextValue = normalizeMetric(runningBaseValueRef.current + elapsedSeconds, minValue, maxValue);
    if (nextValue !== currentValueRef.current) {
      onChangeRef.current(nextValue);
    }

    if (nextValue >= maxValue) {
      stopDurationRun();
    }
  }, [isDurationMetric, isDurationRunning, maxValue, minValue, stopDurationRun]);

  useRunningTicker({
    isRunning: isDurationMetric && isDurationRunning,
    onTick: () => applyDurationRunProgress(Date.now()),
  });

  useEffect(() => {
    if (!isDurationMetric || !isDurationRunning) {
      return;
    }

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        applyDurationRunProgress(Date.now());
      }
    });

    return () => subscription.remove();
  }, [applyDurationRunProgress, isDurationMetric, isDurationRunning]);

  function toggleDurationRun() {
    if (!isDurationMetric) {
      return;
    }
    cancelAnimation(dragOffsetY);
    dragOffsetY.value = 0;
    if (isEditingDuration) {
      setIsEditingDuration(false);
      setDurationMinutesDraft('');
      setDurationSecondsDraft('');
    }

    if (isDurationRunning) {
      applyDurationRunProgress(Date.now());
      stopDurationRun();
      return;
    }

    runningBaseValueRef.current = hasStartedDuration ? normalizedValue : 0;
    if (!hasStartedDuration) onChange(normalizeMetricInput(0, minValue, maxValue));
    setHasStartedDuration(true);
    runningStartedAtRef.current = Date.now();
    setIsDurationRunning(true);
  }

  function beginDurationEdit() {
    if (!isDurationMetric) {
      return;
    }
    cancelAnimation(dragOffsetY);
    dragOffsetY.value = 0;
    const totalSeconds = Math.round(normalizedValue);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    stopDurationRun();
    setDurationMinutesDraft(String(minutes));
    setDurationSecondsDraft(seconds.toString().padStart(2, '0'));
    setIsEditingDuration(true);
  }

  function beginNumericEdit() {
    if (!supportsManualNumericEdit) {
      return;
    }

    cancelAnimation(dragOffsetY);
    dragOffsetY.value = 0;
    setNumericDraft(String(normalizedValue));
    setIsEditingNumeric(true);
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
  }

  function commitNumericEdit() {
    if (!supportsManualNumericEdit || !isEditingNumeric) {
      return;
    }

    const normalized = normalizeNumericDraftInput(numericDraft, supportsDecimalNumericEdit);
    if (normalized.length > 0 && normalized !== '.') {
      const parsed = supportsDecimalNumericEdit
        ? Number.parseFloat(normalized)
        : Number.parseInt(normalized, 10);
      if (Number.isFinite(parsed)) {
        onChange(normalizeMetricValueForField(field, parsed));
      }
    }

    setIsEditingNumeric(false);
    setNumericDraft('');
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

  function handleNumericChange(text: string) {
    setNumericDraft(normalizeNumericDraftInput(text, supportsDecimalNumericEdit));
  }

  function handleNumericBlur() {
    commitNumericEdit();
  }

  const commitValueAtIndex = useCallback((index: number) => {
    const nextValue = values[Math.max(0, Math.min(values.length - 1, index))];
    if (nextValue !== value) onChange(nextValue);
    setPreviewIndex(index);
  }, [onChange, value, values]);

  const beginWheelGesture = useCallback((index: number) => {
    setPreviewIndex(index);
    onInteractionStart?.();
    if (isDurationRunning) setIsDurationRunning(false);
  }, [isDurationRunning, onInteractionStart]);

  const endWheelInteraction = useCallback(() => {
    onInteractionEnd?.();
  }, [onInteractionEnd]);

  const cancelWheelInteraction = useCallback((index: number) => {
    setPreviewIndex(index);
    onInteractionEnd?.();
  }, [onInteractionEnd]);

  const visibleTicks = useMemo(() => buildVisibleTicks(values, previewIndex), [previewIndex, values]);
  const pickerGesture = useMemo(() => Gesture.Pan()
    .enabled(!(isDurationMetric && (isEditingDuration || isDurationRunning)) && !isEditingNumeric)
    .activeOffsetY([-4, 4])
    .failOffsetX([-4, 4])
    .onStart(() => {
      cancelAnimation(dragOffsetY);
      gestureStartIndex.value = selectedIndex;
      gesturePreviewIndex.value = selectedIndex;
      gestureEndedNormally.value = false;
      dragOffsetY.value = 0;
      scheduleOnRN(beginWheelGesture, selectedIndex);
    })
    .onUpdate(event => {
      const rawIndex = gestureStartIndex.value - event.translationY / ITEM_HEIGHT;
      const nextIndex = Math.max(0, Math.min(values.length - 1, Math.round(rawIndex)));
      dragOffsetY.value = (nextIndex - rawIndex) * ITEM_HEIGHT;
      if (nextIndex !== gesturePreviewIndex.value) {
        gesturePreviewIndex.value = nextIndex;
        scheduleOnRN(setPreviewIndex, nextIndex);
      }
    })
    .onEnd(event => {
      gestureEndedNormally.value = true;
      scheduleOnRN(endWheelInteraction);
      const rawIndex = gestureStartIndex.value - event.translationY / ITEM_HEIGHT;
      const nextIndex = Math.max(0, Math.min(values.length - 1, Math.round(rawIndex)));
      dragOffsetY.value = withTiming(0, { duration: 120, easing: reedReanimatedEasing.easeOut }, finished => {
        if (finished) scheduleOnRN(commitValueAtIndex, nextIndex);
      });
    })
    .onFinalize(() => {
      if (!gestureEndedNormally.value) {
        gesturePreviewIndex.value = selectedIndex;
        dragOffsetY.value = withTiming(0, { duration: 120, easing: reedReanimatedEasing.easeOut });
        scheduleOnRN(cancelWheelInteraction, selectedIndex);
      }
    }), [beginWheelGesture, cancelWheelInteraction, commitValueAtIndex, dragOffsetY, endWheelInteraction, gestureEndedNormally, gesturePreviewIndex, gestureStartIndex, isDurationMetric, isDurationRunning, isEditingDuration, isEditingNumeric, selectedIndex, values]);
  const pickerTicksStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragOffsetY.value }] }));

  return (
    <View style={[styles.row, { minHeight: rowMinHeight }]}>
      <View style={styles.copy}>
        <View style={styles.metricHeaderRow}>
          <ReedText style={{ color: theme.colors.inkMuted }} variant="caption">
            {formatMetricLabel(field)}
            {normalizedPreviousValue !== undefined
              ? ` · Prev ${formatMetricValue(field, normalizedPreviousValue)}`
              : ''}
          </ReedText>
        </View>
        <View style={styles.metricValueAnchor}>
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
              <ReedSwapText field={field}
                style={{
                  color: accentColor,
                  fontSize: valueFontSize,
                  lineHeight: Math.floor(valueFontSize * 0.9),
                }}
                variant="display"
              >
                :
              </ReedSwapText>
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
          ) : supportsManualNumericEdit && isEditingNumeric ? (
            <TextInput
              autoFocus
              keyboardType={supportsDecimalNumericEdit ? 'decimal-pad' : 'number-pad'}
              maxLength={5}
              onBlur={handleNumericBlur}
              onChangeText={handleNumericChange}
              onSubmitEditing={commitNumericEdit}
              ref={numericInputRef}
              returnKeyType="done"
              style={[
                styles.numericInput,
                {
                  color: accentColor,
                  fontSize: valueFontSize,
                  letterSpacing: -1.2,
                  lineHeight: Math.floor(valueFontSize * 0.9),
                },
              ]}
              value={numericDraft}
            />
          ) : (
            <Pressable
              disabled={!supportsManualEdit}
              onPress={isDurationMetric ? beginDurationEdit : beginNumericEdit}
              style={({ pressed }) => (supportsManualEdit ? [styles.metricValuePressable, getTapScaleStyle(pressed)] : [styles.metricValuePressable])}
            >
              <ReedSwapText field={field}
                style={{
                  color: accentColor,
                  fontSize: valueFontSize,
                  letterSpacing: isDurationMetric ? -1.2 : -1.8,
                  lineHeight: Math.floor(valueFontSize * 0.9),
                }}
                variant="display"
              >
                {formatMetricValue(field, previewValue)}
              </ReedSwapText>
            </Pressable>
          )}
        </View>
        {isDurationMetric ? (
          <View style={styles.durationRunRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isDurationRunning ? 'Pause duration timer' : 'Start duration timer'}
              onPress={toggleDurationRun}
              style={({ pressed }) => [
                styles.durationRunButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.line,
                  ...getTapScaleStyle(pressed),
                },
              ]}
            >
              <Ionicons
                color={String(theme.colors.ink)}
                name={isDurationRunning ? 'pause' : 'play'}
                size={22}
                style={isDurationRunning ? undefined : styles.durationPlayIcon}
              />
            </Pressable>
            <ReedText style={styles.durationRunLabel} tone="muted" variant="bodyStrong">
              {isDurationRunning ? 'Pause timer' : hasStartedDuration ? 'Resume timer' : 'Start timer'}
            </ReedText>
            <Pressable accessibilityRole="button" accessibilityLabel="Reset duration timer" onPress={() => { stopDurationRun(); setHasStartedDuration(false); onChange(normalizeMetricInput(0, minValue, maxValue)); }} style={({ pressed }) => [{ minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.xs }, getTapScaleStyle(pressed)]}><ReedText tone="muted" variant="caption">Reset</ReedText></Pressable>
          </View>
        ) : null}
      </View>

      <GestureDetector gesture={pickerGesture}>
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
        <Animated.View style={[styles.pickerTicks, pickerTicksStyle]}>
          {visibleTicks.map((tick, rowIndex) => {
            if (!tick) {
              return <View key={`empty-${rowIndex}`} style={styles.tickRow} />;
            }

            const isSelected = tick.index === previewIndex;
            const isMajor = tick.index % 2 === 0;

            return (
              <View key={String(tick.value)} style={styles.tickRow}>
                <View
                  style={[
                    styles.tickMark,
                    {
                      backgroundColor: isSelected ? theme.colors.ink : theme.colors.inkMuted,
                      height: isSelected ? 4 : isMajor ? 3 : 2,
                      opacity: isSelected ? 1 : isMajor ? 0.72 : 0.38,
                      width: isSelected ? 42 : isMajor ? 28 : 14,
                    },
                  ]}
                />
              </View>
            );
          })}
        </Animated.View>
        </View>
      </GestureDetector>
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

function buildVisibleTicks(values: number[], selectedIndex: number) {
  return [-2, -1, 0, 1, 2].map(offset => {
    const index = selectedIndex + offset;
    if (index < 0 || index >= values.length) {
      return null;
    }

    return {
      index,
      value: values[index],
    };
  });
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
    return blendHex('#fbbf24', '#b91c1c', t);
  }

  const key = field.key;

  if (key === 'load' || key === 'assistLoad' || key === 'addedLoad') {
    return String(theme.colors.accent);
  }

  return String(theme.colors.ink);
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

function normalizeNumericDraftInput(input: string, allowDecimal: boolean) {
  if (!allowDecimal) {
    return input.replace(/\D+/g, '');
  }

  const normalized = input.replace(/,/g, '.');
  let output = '';
  let hasDecimal = false;

  for (const char of normalized) {
    if (/\d/.test(char)) {
      output += char;
      continue;
    }

    if (char === '.' && !hasDecimal) {
      output += '.';
      hasDecimal = true;
    }
  }

  return output;
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
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  durationRunLabel: {
    fontFamily: 'Figtree_600SemiBold',
  },
  durationRunRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  durationPlayIcon: {
    marginLeft: 2,
  },
  durationInput: {
    fontFamily: 'Figtree_600SemiBold',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.2,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  metricValueAnchor: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 54,
  },
  metricValuePressable: {
    alignSelf: 'flex-start',
  },
  durationEditRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    minHeight: 54,
  },
  numericInput: {
    fontFamily: 'Figtree_600SemiBold',
    fontVariant: ['tabular-nums'],
    minWidth: 54,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'left',
  },
  durationMinutesInput: {
    minWidth: 54,
    textAlign: 'right',
  },
  durationSecondsInput: {
    minWidth: 42,
  },
  pickerShell: {
    alignItems: 'flex-end',
    height: PICKER_TOUCH_HEIGHT,
    justifyContent: 'center',
    overflow: 'visible',
    width: PICKER_TOUCH_WIDTH,
  },
  centerIndicator: {
    borderRadius: reedRadii.pill,
    height: 18,
    position: 'absolute',
    right: 18,
    top: (PICKER_TOUCH_HEIGHT - 18) / 2,
    width: 8,
    zIndex: 10,
  },
  pickerTicks: {
    height: ITEM_HEIGHT * VISIBLE_ROWS,
    justifyContent: 'center',
    width: 76,
  },
  tickRow: {
    alignItems: 'flex-end',
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    paddingRight: 12,
  },
  tickMark: {
    borderRadius: reedRadii.pill,
  },
});

import { EffortHelp } from './effort-help';
import { type EffortKind } from '@/domains/workout/effort';
import * as haptics from '@/design/haptics';
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
import { bareInputStyle } from '@/components/ui/focus';
import { ReedSwapText } from '@/components/reed/session/reed-swap-feedback';
import { getTapScaleStyle, reedReanimatedEasing } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { useRunningTicker } from './use-running-ticker';
import { useStartCountdown } from './use-start-countdown';

const ITEM_HEIGHT = 24;
const VISIBLE_ROWS = 5;
const PICKER_TOUCH_HEIGHT = 144;
const PICKER_TOUCH_WIDTH = 116;

type WorkoutMetricPickerProps = {
  compact?: boolean;
  availableHeight?: number;
  effortKind?: EffortKind;
  field: RecipeFieldDefinition;
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
  previousValue?: number;
  value: number;
  onChange: (value: number) => void;
};

export function WorkoutMetricPicker({
  compact = false,
  availableHeight,
  effortKind = 'strength',
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
  const defaultValueFontSize = isDurationMetric
    ? Math.max(42, Math.min(58, Math.floor(width * 0.15)))
    : Math.max(48, Math.min(68, Math.floor(width * 0.165)));
  const valueFontSize = availableHeight === undefined ? defaultValueFontSize : Math.max(32, Math.min(
    defaultValueFontSize,
    (availableHeight - (field.key === 'rpe' ? 44 : 18) - (isDurationMetric ? 46 : 0) - 16) / 0.9,
  ));
  const pickerHeight = availableHeight === undefined ? PICKER_TOUCH_HEIGHT : Math.min(PICKER_TOUCH_HEIGHT, availableHeight);
  const itemHeight = Math.min(ITEM_HEIGHT, pickerHeight / (VISIBLE_ROWS + 1));
  const rowMinHeight = compact
    ? Math.max(98, Math.min(124, Math.floor(height * 0.135)))
    : Math.max(112, Math.min(180, Math.floor(height * 0.19)));
  const [isDurationRunning, setIsDurationRunning] = useState(false);
  const [hasStartedDuration, setHasStartedDuration] = useState(false);
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [isEditingNumeric, setIsEditingNumeric] = useState(false);
  const [durationMinutesDraft, setDurationMinutesDraft] = useState('');
  const [durationSecondsDraft, setDurationSecondsDraft] = useState('');
  const [numericDraft, setNumericDraft] = useState('');
  const durationDraftRef = useRef({ minutes: '', seconds: '' });
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
  const accentColor = getMetricAccentColor(theme, field);
  const countdown = useStartCountdown(at => {
    runningBaseValueRef.current = 0;
    onChangeRef.current(normalizeMetricInput(0, minValue, maxValue));
    setHasStartedDuration(true);
    runningStartedAtRef.current = at;
    setIsDurationRunning(true);
  });
  const isPreparing = countdown.remaining !== null;
  const cancelCountdown = countdown.cancel;
  useEffect(() => {
    if (!isPreparing) return;
    onInteractionStart?.();
    return () => onInteractionEnd?.();
  }, [isPreparing, onInteractionEnd, onInteractionStart]);
  useEffect(() => { cancelCountdown(); }, [field.key, cancelCountdown]);

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
    haptics.toggle(!isDurationRunning && !isPreparing);
    if (isPreparing) { countdown.cancel(); return; }
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

    if (!hasStartedDuration) { countdown.start(); return; }
    runningBaseValueRef.current = normalizedValue;
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
    countdown.cancel();
    stopDurationRun();
    setDurationMinutesDraft(String(minutes));
    setDurationSecondsDraft(seconds.toString().padStart(2, '0'));
    durationDraftRef.current = { minutes: String(minutes), seconds: seconds.toString().padStart(2, '0') };
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

    // A blur or submit can arrive before React commits the final digit.
    const normalizedMinutes = normalizeMinutePart(durationDraftRef.current.minutes);
    const normalizedSeconds = normalizeSecondPart(durationDraftRef.current.seconds);

    if (normalizedMinutes.length > 0 || normalizedSeconds.length > 0) {
      const minutes = normalizedMinutes.length > 0 ? Number.parseInt(normalizedMinutes, 10) : 0;
      const seconds = normalizedSeconds.length > 0 ? Number.parseInt(normalizedSeconds, 10) : 0;
      const parsed = minutes * 60 + Math.max(0, Math.min(59, seconds));
      const next = normalizeMetricInput(parsed, minValue, maxValue);
      if (next !== value) { haptics.selection(); onChange(next); }
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
        const next = normalizeMetricValueForField(field, parsed);
        if (next !== value) { haptics.selection(); onChange(next); }
      }
    }

    setIsEditingNumeric(false);
    setNumericDraft('');
  }

  function handleDurationMinutesChange(text: string) {
    const normalized = normalizeMinutePart(text);
    durationDraftRef.current.minutes = normalized;
    setDurationMinutesDraft(normalized);
  }

  function handleDurationSecondsChange(text: string) {
    const normalized = normalizeSecondPart(text);
    durationDraftRef.current.seconds = normalized;
    setDurationSecondsDraft(normalized);
  }

  function handleDurationEditorBlur() {
    setTimeout(() => {
      const minuteInputFocused = durationMinutesInputRef.current?.isFocused() ?? false;
      const secondInputFocused = durationSecondsInputRef.current?.isFocused() ?? false;
      if (!minuteInputFocused && !secondInputFocused) {
        commitDurationEdit();
      }
    }, 0);
  }

  function handleNumericChange(text: string) {
    setNumericDraft(normalizeNumericDraftInput(text, supportsDecimalNumericEdit));
  }

  function handleNumericBlur() {
    commitNumericEdit();
  }

  const commitValueAtIndex = useCallback((index: number) => {
    const nextValue = values[Math.max(0, Math.min(values.length - 1, index))];
    if (nextValue !== value) { haptics.settled(); onChange(nextValue); }
    setPreviewIndex(index);
  }, [onChange, value, values]);

  const previewValueAtIndex = useCallback((index: number) => {
    setPreviewIndex(index);
    haptics.detent();
  }, []);

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
    .enabled(!(isDurationMetric && (isEditingDuration || isDurationRunning || isPreparing)) && !isEditingNumeric)
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
      const rawIndex = gestureStartIndex.value - event.translationY / itemHeight;
      const nextIndex = Math.max(0, Math.min(values.length - 1, Math.round(rawIndex)));
      dragOffsetY.value = (nextIndex - rawIndex) * itemHeight;
      if (nextIndex !== gesturePreviewIndex.value) {
        gesturePreviewIndex.value = nextIndex;
        scheduleOnRN(previewValueAtIndex, nextIndex);
      }
    })
    .onEnd(event => {
      gestureEndedNormally.value = true;
      scheduleOnRN(endWheelInteraction);
      const rawIndex = gestureStartIndex.value - event.translationY / itemHeight;
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
    }), [beginWheelGesture, cancelWheelInteraction, commitValueAtIndex, dragOffsetY, endWheelInteraction, gestureEndedNormally, gesturePreviewIndex, gestureStartIndex, isDurationMetric, isDurationRunning, isEditingDuration, isEditingNumeric, isPreparing, itemHeight, previewValueAtIndex, selectedIndex, values]);
  const pickerTicksStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragOffsetY.value }] }));

  return (
    <View style={[styles.row, availableHeight === undefined ? { minHeight: rowMinHeight } : { flex: 1, minHeight: 0 }]}>
      <View style={styles.copy}>
        <View style={styles.metricHeaderRow}>
          <ReedText style={{ color: isPreparing ? theme.colors.dataWarm : theme.colors.inkMuted }} variant="caption">
            {isPreparing ? 'Ready' : formatMetricLabel(field)}
            {!isPreparing && normalizedPreviousValue !== undefined
              ? ` · Prev ${formatMetricValue(field, normalizedPreviousValue)}`
              : ''}
          </ReedText>
          {field.key === 'rpe' ? <EffortHelp kind={effortKind} /> : null}
        </View>
        <View style={[styles.metricValueAnchor, { minHeight: Math.floor(valueFontSize * 0.9) }]}>
          {isDurationMetric && isEditingDuration ? (
            <View style={[styles.durationEditRow, { minHeight: Math.floor(valueFontSize * 0.9) }]}>
              <TextInput
                accessibilityLabel="Duration minutes"
                autoFocus
                selectTextOnFocus
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
                  bareInputStyle,
                  {
                    borderBottomColor: accentColor,
                    height: Math.floor(valueFontSize * 0.9),
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
                accessibilityLabel="Duration seconds"
                selectTextOnFocus
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
                  bareInputStyle,
                  {
                    borderBottomColor: accentColor,
                    height: Math.floor(valueFontSize * 0.9),
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
              accessibilityLabel={formatMetricLabel(field)}
              autoFocus
              selectTextOnFocus
              keyboardType={supportsDecimalNumericEdit ? 'decimal-pad' : 'number-pad'}
              maxLength={5}
              onBlur={handleNumericBlur}
              onChangeText={handleNumericChange}
              onSubmitEditing={commitNumericEdit}
              ref={numericInputRef}
              returnKeyType="done"
              style={[
                styles.numericInput,
                bareInputStyle,
                {
                  borderBottomColor: accentColor,
                  height: Math.floor(valueFontSize * 0.9),
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
              accessibilityRole={supportsManualEdit ? 'button' : undefined}
              accessibilityLabel={isPreparing ? `Ready, ${countdown.remaining}` : `Edit ${formatMetricLabel(field)}`}
              disabled={!supportsManualEdit || isPreparing}
              onPress={isDurationMetric ? beginDurationEdit : beginNumericEdit}
              style={({ pressed }) => (supportsManualEdit ? [styles.metricValuePressable, getTapScaleStyle(pressed)] : [styles.metricValuePressable])}
            >
              <ReedSwapText field={field}
                style={{
                  color: isPreparing ? theme.colors.dataWarm : accentColor,
                  fontSize: valueFontSize,
                  letterSpacing: isDurationMetric ? -1.2 : -1.8,
                  lineHeight: Math.floor(valueFontSize * 0.9),
                }}
                variant="display"
              >
                {isPreparing ? String(countdown.remaining) : formatMetricValue(field, previewValue)}
              </ReedSwapText>
            </Pressable>
          )}
        </View>
        {isDurationMetric ? (
          <View style={styles.durationRunRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPreparing ? 'Cancel start countdown' : isDurationRunning ? 'Pause duration timer' : hasStartedDuration ? 'Resume duration timer' : 'Start duration timer'}
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
                name={isPreparing ? 'stop' : isDurationRunning ? 'pause' : 'play'}
                size={22}
                style={isDurationRunning || isPreparing ? undefined : styles.durationPlayIcon}
              />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Reset duration timer" onPress={() => { const next = normalizeMetricInput(0, minValue, maxValue); if (isPreparing || isDurationRunning || next !== value) haptics.selection(); countdown.cancel(); stopDurationRun(); setHasStartedDuration(false); onChange(next); }} style={({ pressed }) => [{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }, getTapScaleStyle(pressed)]}><Ionicons name="refresh-outline" size={22} color={String(theme.colors.inkMuted)} /></Pressable>
          </View>
        ) : null}
      </View>

      <GestureDetector gesture={pickerGesture}>
        <View style={[styles.pickerShell, { height: pickerHeight }]}>
        <View
          style={[
            styles.centerIndicator,
            { pointerEvents: 'none' },
            {
              backgroundColor: accentColor,
              top: (pickerHeight - 18) / 2,
            },
          ]}
        />
        <Animated.View style={[styles.pickerTicks, { height: itemHeight * VISIBLE_ROWS }, pickerTicksStyle]}>
          {visibleTicks.map((tick, rowIndex) => {
            if (!tick) {
              return <View key={`empty-${rowIndex}`} style={[styles.tickRow, { height: itemHeight }]} />;
            }

            const isSelected = tick.index === previewIndex;
            const isMajor = tick.index % 2 === 0;

            return (
              <View key={String(tick.value)} style={[styles.tickRow, { height: itemHeight }]}>
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
) {
  if (field.key === 'rpe') return String(theme.colors.dataWarm);

  const key = field.key;

  if (key === 'load' || key === 'assistLoad' || key === 'addedLoad') {
    return String(theme.colors.accent);
  }

  return String(theme.colors.ink);
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
    minWidth: 0,
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
    borderBottomWidth: 1,
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
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    minHeight: 54,
  },
  numericInput: {
    width: '100%',
    borderBottomWidth: 1,
    fontFamily: 'Figtree_600SemiBold',
    fontVariant: ['tabular-nums'],
    minWidth: 54,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'left',
  },
  durationMinutesInput: {
    width: '55%',
    flexShrink: 1,
    textAlign: 'right',
  },
  durationSecondsInput: {
    width: '40%',
    flexShrink: 1,
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

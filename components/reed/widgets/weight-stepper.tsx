import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { HOLD_ACCELERATE_AFTER, HOLD_ACCELERATED_STEPS, HOLD_DELAY_MS, HOLD_REPEAT_MS, stepWeight } from './weight';

type WeightStepperProps = {
  valueKg: number;
  onChange: (valueKg: number) => void;
  /** Sits after the + button in the same row (the widget's Save). */
  trailing?: ReactNode;
};

/**
 * The weight control used everywhere weight is logged: a step down, the value, a step up.
 * Tapping steps a tenth; holding repeats, and speeds up, so a first weigh-in far from the default
 * is not hundreds of taps.
 */
export function WeightStepper({ valueKg, onChange, trailing }: WeightStepperProps) {
  const latest = useRef(valueKg);
  useEffect(() => { latest.current = valueKg; }, [valueKg]);
  const move = useCallback((direction: -1 | 1, steps = 1) => {
    latest.current = stepWeight(latest.current, direction, steps);
    onChange(latest.current);
  }, [onChange]);

  return (
    <View style={styles.row}>
      <StepButton direction={-1} icon="remove" label="Decrease weight" move={move} />
      <ReedText accessibilityLabel={`${valueKg.toFixed(1)} kilograms`} style={styles.value} variant="stat">
        {valueKg.toFixed(1)}
        <ReedText tone="muted" variant="caption"> kg</ReedText>
      </ReedText>
      <StepButton direction={1} icon="add" label="Increase weight" move={move} />
      {trailing}
    </View>
  );
}

function StepButton({ direction, icon, label, move }: { direction: -1 | 1; icon: 'add' | 'remove'; label: string; move: (direction: -1 | 1, steps?: number) => void }) {
  const { theme } = useReedTheme();
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = useCallback(() => {
    if (repeat.current !== null) clearInterval(repeat.current);
    repeat.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  function startRepeating() {
    stop();
    let repeats = 0;
    move(direction);
    repeat.current = setInterval(() => {
      repeats += 1;
      move(direction, repeats > HOLD_ACCELERATE_AFTER ? HOLD_ACCELERATED_STEPS : 1);
    }, HOLD_REPEAT_MS);
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      delayLongPress={HOLD_DELAY_MS}
      onLongPress={startRepeating}
      onPress={() => { haptics.selection(); move(direction); }}
      onPressOut={stop}
      style={({ pressed }) => [styles.step, { backgroundColor: theme.colors.surfaceRaised }, getTapScaleStyle(pressed)]}
    >
      <Ionicons color={String(theme.colors.inkSecondary)} name={icon} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  step: {
    alignItems: 'center',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  value: {
    flex: 1,
    fontSize: 36,
    letterSpacing: -1,
    lineHeight: 40,
    textAlign: 'center',
  },
});

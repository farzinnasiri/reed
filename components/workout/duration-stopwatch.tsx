import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import {
  stopwatchSeconds,
  type StopwatchState,
} from '@/domains/workout/stopwatch';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { getTapScaleStyle } from '@/design/motion';
import { useRunningTicker } from './use-running-ticker';

/** Measures this activity only. It never changes the workout's total duration. */
export function DurationStopwatch({
  onDuration,
  onRunningChange,
}: {
  onDuration: (seconds: number) => void;
  onRunningChange: (running: boolean) => void;
}) {
  const { theme } = useReedTheme();
  const [state, setState] = useState<StopwatchState>({
    accumulatedSeconds: 0,
    startedAt: null,
  });
  const [now, setNow] = useState(Date.now);
  const running = state.startedAt !== null;
  const seconds = stopwatchSeconds(state, now);
  const tick = useCallback(() => setNow(Date.now()), []);
  useRunningTicker({ isRunning: running, onTick: tick });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (value) => {
      if (value === 'active') tick();
    });
    return () => subscription.remove();
  }, [tick]);
  function toggle() {
    const at = Date.now();
    setNow(at);
    if (running) {
      const elapsed = stopwatchSeconds(state, at);
      setState({ accumulatedSeconds: elapsed, startedAt: null });
      onDuration(elapsed);
      onRunningChange(false);
    } else {
      setState({ ...state, startedAt: at });
      onRunningChange(true);
    }
  }
  function reset() {
    setState({ accumulatedSeconds: 0, startedAt: null });
    onDuration(0);
    onRunningChange(false);
  }
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <ReedText
          accessibilityLabel={`Activity timer ${seconds} seconds`}
          variant="stat"
          style={{ minWidth: 90 }}
        >
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </ReedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            running
              ? 'Pause activity timer'
              : seconds
                ? 'Resume activity timer'
                : 'Start activity timer'
          }
          onPress={toggle}
          style={({ pressed }) => [
            {
              minHeight: 44,
              paddingHorizontal: theme.spacing.sm,
              justifyContent: 'center',
              backgroundColor: theme.colors.surfaceRaised,
              borderRadius: theme.radii.sm,
            },
            getTapScaleStyle(pressed),
          ]}
        >
          <ReedText variant="bodyStrong">
            {running ? 'Pause' : seconds ? 'Resume' : 'Start'}
          </ReedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset activity timer"
          onPress={reset}
          style={({ pressed }) => [
            {
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.xs,
            },
            getTapScaleStyle(pressed),
          ]}
        >
          <ReedText tone="muted">Reset</ReedText>
        </Pressable>
      </View>
      <ReedText tone="muted" variant="caption">
        Pause to use this time.
      </ReedText>
    </View>
  );
}

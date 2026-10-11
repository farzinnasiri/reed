import * as haptics from '@/design/haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HapticPressable } from '@/components/ui/haptic-pressable';
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
import { useStartCountdown } from './use-start-countdown';

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
  const [hasStarted, setHasStarted] = useState(false);
  const countdown = useStartCountdown(at => {
    setNow(at);
    setHasStarted(true);
    setState(current => ({ ...current, startedAt: at }));
  }, () => onRunningChange(false));
  const preparing = countdown.remaining !== null;
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
    haptics.toggle(!running && !preparing);
    if (preparing) { countdown.cancel(); return; }
    const at = Date.now();
    setNow(at);
    if (running) {
      const elapsed = stopwatchSeconds(state, at);
      setState({ accumulatedSeconds: elapsed, startedAt: null });
      onDuration(elapsed);
      onRunningChange(false);
    } else {
      onRunningChange(true);
      if (hasStarted) setState({ ...state, startedAt: at });
      else countdown.start();
    }
  }
  function reset() {
    if (preparing || running || seconds > 0) haptics.selection();
    countdown.cancel();
    setHasStarted(false);
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
          accessibilityLabel={preparing ? `Ready, ${countdown.remaining}` : `Activity timer ${seconds} seconds`}
          variant="stat"
          style={{ minWidth: 90, color: preparing ? theme.colors.dataWarm : theme.colors.ink }}
        >
          {preparing ? String(countdown.remaining) : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
        </ReedText>
        <HapticPressable feedback="direct"
          accessibilityRole="button"
          accessibilityLabel={
            preparing ? 'Cancel start countdown' : running
              ? 'Pause activity timer'
              : seconds
                ? 'Resume activity timer'
                : 'Start activity timer'
          }
          onPress={toggle}
          style={({ pressed }) => [
            {
              height: 44,
              width: 44,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.surfaceRaised,
              borderRadius: theme.radii.pill,
            },
            getTapScaleStyle(pressed),
          ]}
        >
          <Ionicons name={preparing ? 'stop' : running ? 'pause' : 'play'} size={22} color={String(theme.colors.ink)} />
        </HapticPressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset activity timer"
          onPress={reset}
          style={({ pressed }) => [
            {
              minHeight: 44,
              minWidth: 44,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.xs,
            },
            getTapScaleStyle(pressed),
          ]}
        >
          <Ionicons name="refresh-outline" size={22} color={String(theme.colors.inkMuted)} />
        </Pressable>
      </View>
      <ReedText tone="muted" variant="caption">
        {preparing ? 'Ready' : 'Pause to use this time.'}
      </ReedText>
    </View>
  );
}

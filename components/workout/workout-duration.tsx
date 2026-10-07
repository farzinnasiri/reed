import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  MAX_WORKOUT_DURATION_SECONDS,
  sessionDurationSeconds,
} from '@/domains/workout/session-duration';
import { ReedSheet } from '@/components/ui/reed-sheet';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { getTapScaleStyle } from '@/design/motion';
import { useUserOperation } from '@/lib/use-user-operation';
import { useCompactElapsedLabel } from './use-compact-elapsed-label';

export type WorkoutTiming = {
  sessionId: Id<'liveSessions'>;
  startedAt: number;
  endedAt?: number;
  manualDurationSeconds?: number;
};
export function WorkoutDuration({
  timing,
  fallback,
}: {
  timing?: WorkoutTiming;
  fallback: string;
}) {
  const { theme } = useReedTheme();
  const live = useCompactElapsedLabel(
    timing &&
      timing.endedAt === undefined &&
      timing.manualDurationSeconds === undefined
      ? timing.startedAt
      : undefined,
  );
  const sheet = useRef<BottomSheetModal>(null);
  const save = useMutation(api.liveSessions.setSessionDuration);
  const operation = useUserOperation(
    'workout.duration',
    'Could not save workout duration. Try again.',
  );
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const duration = Number(minutes) * 60 + Number(seconds);
  const valid =
    /^\d+$/.test(minutes) &&
    /^\d+$/.test(seconds) &&
    Number(seconds) < 60 &&
    duration > 0 &&
    duration <= MAX_WORKOUT_DURATION_SECONDS;
  function open() {
    if (!timing) return;
    const value = sessionDurationSeconds(timing, Date.now());
    setMinutes(String(Math.floor(value / 60)));
    setSeconds(String(value % 60));
    operation.clearError();
    sheet.current?.present();
  }
  async function commit(value: number | null) {
    if (!timing) return;
    const result = await operation.run(() =>
      save({ sessionId: timing.sessionId, durationSeconds: value }),
    );
    if (result.status === 'success') sheet.current?.dismiss();
  }
  const label =
    timing?.manualDurationSeconds !== undefined
      ? formatDuration(timing.manualDurationSeconds)
      : timing?.endedAt !== undefined
        ? formatDuration(sessionDurationSeconds(timing, timing.endedAt))
        : (live ?? fallback);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit workout duration, ${label}`}
        disabled={!timing}
        onPress={open}
        style={({ pressed }) => [
          { minHeight: 44, justifyContent: 'center', minWidth: 52 },
          getTapScaleStyle(pressed),
        ]}
      >
        <ReedText variant="bodyStrong" numberOfLines={1}>
          {label}
        </ReedText>
      </Pressable>
      <ReedSheet ref={sheet}>
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <ReedText variant="headline">Workout duration</ReedText>
          <ReedText tone="muted" variant="caption">
            Total time for this workout.
          </ReedText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <ReedInput
                label="Minutes"
                keyboardType="number-pad"
                value={minutes}
                onChangeText={setMinutes}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ReedInput
                label="Seconds"
                keyboardType="number-pad"
                value={seconds}
                onChangeText={setSeconds}
              />
            </View>
          </View>
          <ReedButton
            label="Save duration"
            disabled={!valid || operation.isWorking}
            onPress={() => void commit(duration)}
          />
          <ReedButton
            label="Use automatic duration"
            variant="quiet"
            disabled={operation.isWorking}
            onPress={() => void commit(null)}
          />
          {operation.errorMessage ? (
            <ReedText tone="danger">{operation.errorMessage}</ReedText>
          ) : null}
        </View>
      </ReedSheet>
    </>
  );
}
function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes
    ? `${minutes}m${seconds % 60 ? ` ${seconds % 60}s` : ''}`
    : `${seconds}s`;
}

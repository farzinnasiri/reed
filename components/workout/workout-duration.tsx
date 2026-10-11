import * as haptics from '@/design/haptics';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  MAX_WORKOUT_DURATION_SECONDS,
  sessionDurationSeconds,
} from '@/domains/workout/session-duration';
import { ReedSheet } from '@/components/ui/reed-sheet';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedSheetTextInput } from '@/components/ui/reed-sheet-input';
import { DurationWheel } from './duration-wheel';
import { reedWorkoutReviewMetrics } from '@/design/system';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { getTapScaleStyle } from '@/design/motion';
import { useUserOperation } from '@/lib/use-user-operation';
import { formatCompactDuration } from './session-time-format';
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
  variant = 'bodyStrong',
  onEdit,
}: {
  timing?: WorkoutTiming;
  fallback: string;
  variant?: 'bodyStrong' | 'stat';
  onEdit?: () => void;
}) {
  const { theme } = useReedTheme();
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const live = useCompactElapsedLabel(
    timing &&
      timing.endedAt === undefined &&
      timing.manualDurationSeconds === undefined
      ? timing.startedAt
      : undefined,
  );
  const label =
    timing?.manualDurationSeconds !== undefined
      ? formatCompactDuration(timing.manualDurationSeconds)
      : timing?.endedAt !== undefined
        ? formatCompactDuration(sessionDurationSeconds(timing, timing.endedAt))
        : (live ?? fallback);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit workout duration, ${label}`}
        disabled={!timing}
        onPress={onEdit ?? (() => setOpenedAt(Date.now()))}
        style={({ pressed }) => [
          {
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          },
          getTapScaleStyle(pressed),
        ]}
      >
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <ReedText tone="secondary" variant="caption">
            Duration
            {timing?.manualDurationSeconds !== undefined ? ' · adjusted' : ''}
          </ReedText>
          <ReedText variant={variant}>{label}</ReedText>
        </View>
        {timing ? (
          <ReedText tone="accent" variant="bodyStrong">
            Edit
          </ReedText>
        ) : null}
      </Pressable>
      {timing && !onEdit ? (
        <WorkoutDurationEditor
          timing={timing}
          openedAt={openedAt}
          onClose={() => setOpenedAt(null)}
        />
      ) : null}
    </>
  );
}

export function WorkoutDurationEditor({
  timing,
  openedAt,
  onClose,
}: {
  timing: WorkoutTiming;
  openedAt: number | null;
  onClose: () => void;
}) {
  const { theme } = useReedTheme();
  const save = useMutation(api.liveSessions.setSessionDuration);
  const operation = useUserOperation(
    'workout.duration',
    'Could not save workout duration. Try again.',
  );
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('0');
  const [seconds, setSeconds] = useState('0');
  const [typing, setTyping] = useState(false);
  const [recorded, setRecorded] = useState(0);
  const duration =
    Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  const valid =
    /^\d+$/.test(hours) &&
    /^\d+$/.test(minutes) &&
    /^\d+$/.test(seconds) &&
    Number(minutes) < 60 &&
    Number(seconds) < 60 &&
    duration > 0 &&
    duration <= MAX_WORKOUT_DURATION_SECONDS;
  const [previousOpening, setPreviousOpening] = useState<number | null>(null);
  if (openedAt !== previousOpening) {
    setPreviousOpening(openedAt);
    if (openedAt !== null) {
      const value = Math.min(
        MAX_WORKOUT_DURATION_SECONDS,
        sessionDurationSeconds(timing, openedAt),
      );
      setHours(String(Math.floor(value / 3600)));
      setMinutes(String(Math.floor(value / 60) % 60));
      setSeconds(String(value % 60));
      setRecorded(
        sessionDurationSeconds(
          { ...timing, manualDurationSeconds: undefined },
          openedAt,
        ),
      );
      setTyping(false);
      operation.clearError();
    }
  }
  async function commit(value: number | null) {
    const result = await operation.run(() =>
      save({ sessionId: timing.sessionId, durationSeconds: value }),
    );
    if (result.status === 'success') {
      haptics.saved();
      onClose();
    } else if (result.status === 'error') haptics.warning();
  }
  return (
    <ReedSheet
      open={openedAt !== null}
      onDismiss={onClose}
      heightFraction={reedWorkoutReviewMetrics.editorFraction}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.gutter,
          gap: theme.spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <ReedText variant="title">Duration</ReedText>
          <ReedButton
            label="Cancel"
            variant="quiet"
            onPress={() => onClose()}
          />
        </View>
        <ReedText tone="secondary" variant="body">
          How long did you train?
        </ReedText>
        {typing ? (
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.sm,
              minHeight:
                reedWorkoutReviewMetrics.wheelRow *
                (reedWorkoutReviewMetrics.wheelRows + 1),
              alignItems: 'center',
            }}
          >
            {[
              { label: 'Hours', value: hours, change: setHours },
              { label: 'Minutes', value: minutes, change: setMinutes },
              { label: 'Seconds', value: seconds, change: setSeconds },
            ].map((field) => (
              <View
                key={field.label}
                style={{ flex: 1, gap: theme.spacing.xs }}
              >
                <ReedText variant="caption" tone="muted">
                  {field.label}
                </ReedText>
                <ReedSheetTextInput
                  accessibilityLabel={field.label}
                  keyboardType="number-pad"
                  value={field.value}
                  onChangeText={field.change}
                  style={{
                    ...theme.typography.stat,
                    color: theme.colors.ink,
                    backgroundColor: theme.colors.surfaceRaised,
                    borderRadius: theme.radii.sm,
                    padding: theme.spacing.sm,
                    minHeight: 52,
                  }}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <DurationWheel
              label="Hours"
              value={Number(hours)}
              max={24}
              onChange={(value) => {
                setHours(String(value));
                if (value === 24) {
                  setMinutes('0');
                  setSeconds('0');
                }
              }}
            />
            <DurationWheel
              label="Minutes"
              value={Number(minutes)}
              max={Number(hours) === 24 ? 0 : 59}
              onChange={(value) => setMinutes(String(value))}
            />
            <DurationWheel
              label="Seconds"
              value={Number(seconds)}
              max={Number(hours) === 24 ? 0 : 59}
              onChange={(value) => setSeconds(String(value))}
            />
          </View>
        )}
        <ReedButton
          label={typing ? 'Use picker' : 'Enter a time'}
          variant="quiet"
          onPress={() => {
            if (typing) {
              const safe = Math.min(
                MAX_WORKOUT_DURATION_SECONDS,
                Math.max(0, Number.isFinite(duration) ? duration : 0),
              );
              setHours(String(Math.floor(safe / 3600)));
              setMinutes(String(Math.floor(safe / 60) % 60));
              setSeconds(String(safe % 60));
            }
            setTyping((value) => !value);
          }}
        />
        <ReedButton
          hapticTap
          label="Save duration"
          disabled={!valid || operation.isWorking}
          onPress={() => void commit(duration)}
        />
        <ReedButton
          hapticTap
          label={`Reset to recorded · ${formatCompactDuration(recorded)}`}
          variant="quiet"
          disabled={operation.isWorking}
          onPress={() => void commit(null)}
        />
        {!valid ? (
          <ReedText tone="muted" variant="caption">
            Choose a time between 1 second and 24 hours.
          </ReedText>
        ) : null}
        {operation.errorMessage ? (
          <ReedText tone="danger">{operation.errorMessage}</ReedText>
        ) : null}
      </ScrollView>
    </ReedSheet>
  );
}

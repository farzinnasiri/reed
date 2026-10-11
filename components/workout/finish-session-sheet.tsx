import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedSheet } from '@/components/ui/reed-sheet';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { suggestSessionDuration } from '@/domains/workout/session-duration';
import { useCompactElapsedLabel } from './use-compact-elapsed-label';
import { formatCompactDuration, formatClockTime } from './session-time-format';

type FinishSessionSheetProps = {
  /** A planned session with nothing logged is deleted and the plan returns to the queue. */
  discardsOnFinish: boolean;
  exerciseCount: number;
  fromPlan: boolean;
  isWorking: boolean;
  /** When the last set was logged, if any: what a forgotten session's real length is judged by. */
  lastSetAt: number | null;
  manualDurationSeconds?: number;
  onClose: () => void;
  /** `durationSeconds` is set when the user chose the length the sets point to. */
  onFinish: (durationSeconds?: number) => void;
  open: boolean;
  startedAt: number;
};

/**
 * Finishing a session, with a way out for the one you forgot: if the clock has run far past the
 * last set, offer the length the sets point to before saving a 17 hour workout.
 */
export function FinishSessionSheet({ discardsOnFinish, exerciseCount, fromPlan, isWorking, lastSetAt, manualDurationSeconds, onClose, onFinish, open, startedAt }: FinishSessionSheetProps) {
  return (
    <ReedSheet onDismiss={onClose} open={open}>
      <FinishBody
        discardsOnFinish={discardsOnFinish}
        exerciseCount={exerciseCount}
        fromPlan={fromPlan}
        isWorking={isWorking}
        lastSetAt={lastSetAt}
        manualDurationSeconds={manualDurationSeconds}
        onClose={onClose}
        onFinish={onFinish}
        startedAt={startedAt}
      />
    </ReedSheet>
  );
}

// Mounted only while the sheet is open, so the clock and the suggestion are read at the moment of finishing.
function FinishBody({ discardsOnFinish, exerciseCount, fromPlan, isWorking, lastSetAt, manualDurationSeconds, onClose, onFinish, startedAt }: Omit<FinishSessionSheetProps, 'open'>) {
  const { theme } = useReedTheme();
  const elapsed = useCompactElapsedLabel(startedAt, manualDurationSeconds) ?? '0s';
  const isEmpty = discardsOnFinish;
  // Read once, when the sheet opens: the suggestion should not shift under the user's thumb.
  const [suggestion] = useState(() => suggestSessionDuration({ startedAt, lastSetAt, manualDurationSeconds }, Date.now()));

  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <ReedText variant="title">{isEmpty ? 'Close session?' : 'Finish workout?'}</ReedText>
        <ReedText tone="muted">
          {isEmpty
            ? fromPlan
              ? 'Nothing was logged. This plan goes back to your queue.'
              : 'No exercises logged. Nothing will be saved.'
            : `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'} · ${elapsed}`}
        </ReedText>
      </View>

      {suggestion !== null && lastSetAt !== null ? (
        <>
          <View style={[styles.note, { backgroundColor: theme.colors.surfaceRaised }]}>
            <Ionicons color={String(theme.colors.accentInk)} name="time-outline" size={20} />
            <ReedText style={styles.noteCopy} tone="secondary" variant="caption">
              This session has been open for {elapsed}. Your last set was at {formatClockTime(lastSetAt)}.
            </ReedText>
          </View>
          <ReedButton hapticTap={!isEmpty} disabled={isWorking} label={`Finish as ${formatCompactDuration(suggestion)}`} onPress={() => onFinish(suggestion)} />
          <ReedButton hapticTap={!isEmpty} disabled={isWorking} label={`Finish at ${elapsed}`} onPress={() => onFinish()} variant="quiet" />
        </>
      ) : (
        <ReedButton hapticTap={!isEmpty} disabled={isWorking} label={isEmpty ? 'Close session' : 'Finish workout'} onPress={() => onFinish()} />
      )}
      <ReedButton label="Keep going" onPress={onClose} variant="quiet" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingTop: 4 },
  copy: { gap: 4, paddingBottom: 4 },
  note: { alignItems: 'center', borderRadius: reedRadii.md, flexDirection: 'row', gap: 12, padding: 14 },
  noteCopy: { flex: 1 },
});

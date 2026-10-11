import { reedWorkoutReviewMetrics } from '@/design/system';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ReedSheet } from '@/components/ui/reed-sheet';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useReedTheme } from '@/design/provider';
import { useUserOperation } from '@/lib/use-user-operation';
import * as haptics from '@/design/haptics';
import type { EndedSummary } from './use-workout-history';

export function SessionDeleteSheet({
  session,
  onClose,
  onDeleted,
}: {
  session: EndedSummary;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { theme } = useReedTheme();
  const [open, setOpen] = useState(true);
  const remove = useMutation(api.liveSessions.deleteEndedSession);
  const operation = useUserOperation(
    'workout.history.delete',
    'Could not delete this session. Try again.',
  );
  async function deleteSession() {
    const result = await operation.run(() =>
      remove({ sessionId: session.sessionId }),
    );
    if (result.status === 'success') {
      haptics.saved();
      onDeleted();
      setOpen(false);
    }
  }
  return (
    <ReedSheet
      open={open}
      heightFraction={reedWorkoutReviewMetrics.actionsFraction}
      onDismiss={() => {
        onClose();
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.gutter,
          gap: theme.spacing.lg,
          flexGrow: 1,
        }}
      >
        <ReedText variant="title">Delete this session?</ReedText>
        <ReedText variant="bodyStrong">{session.presentation.title}</ReedText>
        <ReedText tone="secondary">
          {new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(
            session.startedAt,
          )}
        </ReedText>
        <ReedText tone="secondary" variant="caption">
          This removes the workout and its logged sets from your training
          history. Your conversation with Reed stays.
        </ReedText>
        <View style={{ flex: 1 }} />
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Confirm delete session"
          disabled={operation.isWorking}
          onPress={() => void deleteSession()}
          style={{
            backgroundColor: theme.colors.dangerFill,
            borderRadius: theme.radii.pill,
            minHeight: 52,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ReedText tone="danger" variant="bodyStrong">
            {operation.isWorking ? 'Deleting…' : 'Delete session'}
          </ReedText>
        </HapticPressable>
        {operation.errorMessage ? (
          <ReedText tone="danger" variant="caption">
            {operation.errorMessage}
          </ReedText>
        ) : null}
        <ReedButton
          label="Cancel"
          variant="quiet"
          disabled={operation.isWorking}
          onPress={() => setOpen(false)}
        />
      </ScrollView>
    </ReedSheet>
  );
}

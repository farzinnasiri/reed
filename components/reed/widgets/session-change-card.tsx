import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { getErrorMessage } from '@/components/workout/workout-surface.utils';
import * as haptics from '@/design/haptics';
import { useReedTheme } from '@/design/provider';
import { formatTargets } from './format-targets';
import { WidgetCard } from './widget-card';

// setTimeout runs immediately for delays past 2^31 ms; proposals live for minutes, so this is a guard.
const MAX_TIMER_MS = 2 ** 31 - 1;

// True from `expiresAt` on. Convex can keep serving a cached "pending" action, so the card also
// watches the clock itself, and re-checks when the app returns to the foreground.
function useHasExpired(expiresAt: number | null) {
  const [hasExpired, setHasExpired] = useState(() => expiresAt !== null && Date.now() >= expiresAt);

  useEffect(() => {
    if (expiresAt === null) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function check() {
      if (timeout) clearTimeout(timeout);
      const remaining = expiresAt! - Date.now();
      if (remaining <= 0) {
        setHasExpired(true);
        return;
      }
      timeout = setTimeout(check, Math.min(remaining, MAX_TIMER_MS));
    }

    check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      subscription.remove();
    };
  }, [expiresAt]);

  return hasExpired;
}

/**
 * Reed's proposal to swap an exercise in the live session. Nothing changes until the person
 * presses Apply swap: the buttons only name the stored proposal, never an operation, and they
 * stop working at its expiry. Afterwards the card is a quiet record of what happened.
 */
export function SessionChangeCard({ actionId, onApplied }: { actionId: Id<'reedSessionActions'>; onApplied?: (sessionId: string, exerciseId: string) => void }) {
  const { theme } = useReedTheme();
  const action = useQuery(api.reedSessionActions.getSessionAction, { actionId });
  const confirmSessionAction = useMutation(api.reedSessionActions.confirmSessionAction);
  const rejectSessionAction = useMutation(api.reedSessionActions.rejectSessionAction);
  const hasExpired = useHasExpired(action?.expiresAt ?? null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!action) return null;

  const { previousExerciseName, replacementExerciseName } = action;
  const swapLine = (
    <View style={styles.swapLine}>
      <ReedText numberOfLines={1} style={[styles.swapName, styles.struck]} tone="muted">{previousExerciseName}</ReedText>
      <Ionicons color={String(theme.colors.inkMuted)} name="arrow-forward" size={17} />
      <ReedText numberOfLines={1} style={styles.swapName} variant="bodyStrong">{replacementExerciseName}</ReedText>
    </View>
  );

  async function resolve(run: () => Promise<unknown>) {
    setIsBusy(true);
    setError(null);
    try {
      await run();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setIsBusy(false);
    }
  }

  if (action.status === 'applied') {
    return (
      <WidgetCard>
        <View style={styles.resolvedRow}>
          <Ionicons color={String(theme.colors.successInk)} name="checkmark-circle-outline" size={20} />
          <ReedText style={styles.flex} variant="bodyStrong">Changed by Reed, confirmed by you</ReedText>
        </View>
        {swapLine}
      </WidgetCard>
    );
  }

  if (action.status === 'rejected' || action.status === 'expired' || hasExpired) {
    const text = action.status === 'rejected' && !action.invalidReason
      ? `Kept ${previousExerciseName}.`
      : action.status === 'rejected'
        ? 'Not applied: the session changed. Ask Reed for a new swap.'
        : 'This swap expired. Ask Reed again if you still want it.';
    return (
      <View style={[styles.mutedCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card }]}>
        <ReedText tone="muted" variant="caption">{text}</ReedText>
      </View>
    );
  }

  const isDisabled = isBusy || !action.canConfirm;

  return (
    <WidgetCard origin="Changes your live session">
      {swapLine}
      <View style={styles.targets}>
        <ReedText tone="muted">Targets</ReedText>
        <ReedText tone="muted">{formatTargets(action.targets)}</ReedText>
      </View>
      {action.rationale ? <ReedText style={styles.rationale} tone="muted" variant="caption">{action.rationale}</ReedText> : null}
      <View style={styles.buttons}>
        <ReedButton
          disabled={isDisabled}
          label="Apply swap"
          onPress={() => void resolve(async () => {
            const result = await confirmSessionAction({ actionId });
            if (result.status === 'applied') { haptics.success(); onApplied?.(result.sessionId, result.sessionExerciseId); }
          })}
          variant="soft"
        />
        <ReedButton
          disabled={isBusy}
          label="Keep current exercise"
          onPress={() => void resolve(() => rejectSessionAction({ actionId }))}
          variant="quiet"
        />
      </View>
      {!action.canConfirm && action.unavailableReason ? (
        <ReedText style={styles.note} tone="muted" variant="caption">The session has changed since Reed proposed this. Ask for a new swap.</ReedText>
      ) : null}
      {error ? <ReedText style={styles.note} tone="danger" variant="caption">{error}</ReedText> : null}
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  buttons: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  flex: {
    flex: 1,
  },
  mutedCard: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  note: {
    marginTop: 8,
  },
  rationale: {
    marginTop: 4,
  },
  resolvedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  swapLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 2,
    marginTop: 6,
  },
  swapName: {
    flexShrink: 1,
  },
  targets: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
});

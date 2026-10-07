import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getTapScaleStyle } from '@/design/motion';
import { reedRadii } from '@/design/system';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useAppShell } from '@/components/home/app-shell-context';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { getErrorMessage } from '@/components/workout/workout-surface.utils';
import * as haptics from '@/design/haptics';
import { useReedTheme } from '@/design/provider';
import { formatTargets } from './format-targets';
import { WidgetCard } from './widget-card';

type PlanCardProps = {
  onOpenSession: (sessionId: string) => void;
  onOpenWorkout: () => void;
  plannedSessionId: Id<'plannedSessions'>;
};

// "Sat 18:00" in the plan's own time zone, so it reads the same wherever the card is opened.
function formatScheduledFor(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone, weekday: 'short' }).format(new Date(timestamp));
}

/**
 * Reed's planned session: the exercises with their targets, then one button for what the plan
 * can do right now (start, continue the open session, or open the one it started). It reads the
 * plan live, so a revision Reed makes in chat shows up here and a start always names the
 * revision on screen. There is no editor: changes go through chat.
 */
export function PlanCard({ onOpenSession, onOpenWorkout, plannedSessionId }: PlanCardProps) {
  const { theme } = useReedTheme();
  const { activeWorkout } = useAppShell();
  const plan = useQuery(api.plannedSessions.getPlannedSession, { plannedSessionId });
  const startPlannedSession = useMutation(api.plannedSessions.startPlannedSession);
  const dismissPlannedSession = useMutation(api.plannedSessions.dismissPlannedSession);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!plan) return (
    <View style={[styles.past, { backgroundColor: theme.colors.surface }]}>
      <ReedText tone="muted" variant="caption">{plan === undefined ? 'Loading plan' : 'Plan unavailable'}</ReedText>
    </View>
  );

  const isReady = plan.status === 'ready';
  const meta = [
    plan.scheduledForAt !== null ? formatScheduledFor(plan.scheduledForAt, plan.timeZone) : null,
    `~${plan.estimatedDurationMinutes} min`,
  ].filter(Boolean).join(' · ');

  async function run(action: () => Promise<void>) {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      // The subscription has already refreshed the card, so the new targets are what the person
      // sees next; nothing starts until they press the button again.
      setError(getErrorMessage(caught));
    } finally {
      setIsBusy(false);
    }
  }

  const start = () => {
    void run(async () => {
      await startPlannedSession({ expectedRevision: plan.revision, plannedSessionId });
      haptics.success();
      onOpenWorkout();
    });
  };
  // A started plan opens the session it started: the live one while it is open, else its summary.
  const isLive = plan.liveSessionId !== null && activeWorkout?.sessionId === plan.liveSessionId;
  const openStarted = () => {
    haptics.selection();
    if (isLive) onOpenWorkout();
    else if (plan.liveSessionId) onOpenSession(plan.liveSessionId);
  };

  if (!isReady) {
    const canOpen = plan.status === 'started' && plan.liveSessionId !== null;
    return (
      <Pressable
        accessibilityRole={canOpen ? 'button' : 'text'}
        accessibilityLabel={`Plan, ${plan.title}, ${plan.status}`}
        accessibilityHint={canOpen ? 'Opens the session started from this plan.' : undefined}
        disabled={!canOpen}
        onPress={openStarted}
        style={({ pressed }) => [styles.past, { backgroundColor: isLive ? theme.colors.accentSoft : theme.colors.surface }, getTapScaleStyle(pressed)]}
      >
        <View style={[styles.pastIcon, { backgroundColor: theme.colors.surfaceRaised }]}>
          <Ionicons name="barbell-outline" color={String(theme.colors.inkMuted)} size={16} />
        </View>
        <ReedText numberOfLines={1} style={styles.pastTitle} tone="secondary">Plan · {plan.title}</ReedText>
        <ReedText tone="muted" variant="caption">{isLive ? 'in progress' : plan.status}</ReedText>
        {canOpen ? <Ionicons name="chevron-forward" color={String(theme.colors.inkMuted)} size={15} /> : null}
      </Pressable>
    );
  }

  const action = !isReady
    ? { label: isLive ? 'Continue session' : 'View session', onPress: openStarted }
    : plan.continueSessionId
      ? { label: 'Continue current session', onPress: onOpenWorkout }
      : { label: `Start ${plan.title}`, onPress: start };
  const isRepairRequired = isReady && !plan.continueSessionId && plan.availability === 'repair_required';

  return (
    <WidgetCard meta={meta} title={plan.title}>
      <View style={styles.items}>
        {plan.exercises.map((exercise, index) => (
          <View key={`${exercise.exerciseCatalogId}:${index}`} style={styles.item}>
            <View style={[styles.index, { backgroundColor: theme.colors.surfaceRaised }]}>
              <ReedText tone="muted" variant="micro">{index + 1}</ReedText>
            </View>
            <ReedText numberOfLines={2} style={styles.name} tone={exercise.available ? 'default' : 'muted'}>{exercise.exerciseName}</ReedText>
            <ReedText tone="muted" variant="caption">{exercise.available ? formatTargets(exercise.targets) : 'Unavailable'}</ReedText>
          </View>
        ))}
      </View>
      <ReedButton
        disabled={isBusy || isRepairRequired}
        label={action.label}
        onPress={action.onPress}
        style={styles.cta}
      />
      {isRepairRequired ? (
        <ReedText style={styles.note} tone="muted" variant="caption">Some exercises are no longer available. Ask Reed to update this plan.</ReedText>
      ) : null}
      {error ? <ReedText style={styles.note} tone="danger" variant="caption">{error}</ReedText> : null}
      {isReady ? (
        <ReedButton
          disabled={isBusy}
          label="Not today"
          onPress={() => void run(async () => { await dismissPlannedSession({ plannedSessionId }); })}
          style={styles.dismiss}
          variant="quiet"
        />
      ) : null}
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  past: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    flexDirection: 'row',
    gap: 10,
    minHeight: 46,
    paddingLeft: 8,
    paddingRight: 14,
  },
  pastIcon: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  pastTitle: { flex: 1, fontSize: 14.5 },
  cta: {
    marginTop: 10,
  },
  dismiss: {
    alignSelf: 'center',
    marginTop: 2,
  },
  index: {
    alignItems: 'center',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  items: {
    marginTop: 2,
  },
  name: {
    flex: 1,
  },
  note: {
    marginTop: 8,
    textAlign: 'center',
  },
});

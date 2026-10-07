import { sessionDurationSeconds } from '@/domains/workout/session-duration';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { formatMessageDate } from '../reed.presenter';
import type { ReedRelatedSession } from '../reed.types';

const MAX_EXERCISE_ROWS = 4;

type SessionSummaryCardProps = {
  onOpen: (sessionId: string) => void;
  /** Dates and length of the session, when the message carries them. */
  related: ReedRelatedSession | null;
  sessionId: string;
};

/**
 * Reed's session summary: sets, reps and load, then the exercises with their best output and a PR
 * badge. It reads the session's insights live, so it is right whenever it is opened. Tapping it
 * opens the session where it already lives.
 */
export function SessionSummaryCard({ onOpen, related, sessionId }: SessionSummaryCardProps) {
  const { theme } = useReedTheme();
  const insights = useQuery(api.liveSessionInsights.getForSession, { sessionId: sessionId as Id<'liveSessions'> });
  const timeline = useQuery(api.liveSessions.getEndedTimeline, { sessionId: sessionId as Id<'liveSessions'> });

  if (!insights || !timeline) return null;

  const { fullInsights, summary } = insights;
  const reps = summary.distribution.workSplit.reduce((total, row) => total + row.reps, 0);
  const prExercises = new Set(fullInsights.performance.prExercises);
  const exercises = timeline.timeline
    .flatMap(item => {
      const bestSet = pickBestSet(item.sets);
      return bestSet ? [{ bestSet, exerciseName: item.exerciseName, id: item.sessionExerciseId }] : [];
    })
    .slice(0, MAX_EXERCISE_ROWS);
  const meta = related
    ? `${formatMessageDate(related.startedAt)} · ${Math.max(1, Math.round(sessionDurationSeconds(related, related.endedAt) / 60))} min`
    : null;

  return (
    <Pressable
      accessibilityHint="Opens this session."
      accessibilityRole="button"
      onPress={() => onOpen(sessionId)}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card }, getTapScaleStyle(pressed)]}
    >
      <View style={styles.header}>
        <ReedText variant="headline">Session</ReedText>
        {meta ? <ReedText tone="muted" variant="caption">{meta}</ReedText> : null}
      </View>

      <View style={[styles.stats, { borderBottomColor: theme.colors.line }]}>
        <Stat label="sets" value={String(summary.output.completedSets)} />
        <Stat label="reps" value={String(Math.round(reps))} />
        <Stat label="kg moved" value={Math.round(summary.output.totalLoadKg).toLocaleString('en')} />
      </View>

      {exercises.map(entry => (
        <View key={entry.id} style={styles.exerciseRow}>
          <ReedText numberOfLines={1} style={styles.exerciseName}>{entry.exerciseName}</ReedText>
          {prExercises.has(entry.exerciseName) ? (
            <View style={[styles.badge, { backgroundColor: theme.colors.accentSoft }]}>
              <ReedText tone="accent" variant="micro">PR</ReedText>
            </View>
          ) : null}
          <ReedText tone="muted">{formatBestSet(entry.bestSet.summary)}</ReedText>
        </View>
      ))}
    </Pressable>
  );
}

type TimelineSet = {
  derivedEffectiveLoadKg: number | null;
  metrics: Record<string, number>;
  summary: string;
  warmup: boolean;
};

// The best set of an exercise: the heaviest working set (then the most reps). With no load to
// compare (holds, cardio, bodyweight without a derived load) it is the last working set.
function pickBestSet(sets: TimelineSet[]) {
  const working = sets.filter(set => !set.warmup);
  const candidates = working.length > 0 ? working : sets;
  let best: TimelineSet | null = null;

  for (const set of candidates) {
    const load = set.derivedEffectiveLoadKg ?? 0;
    const bestLoad = best?.derivedEffectiveLoadKg ?? 0;
    const isHeavier = load > bestLoad;
    const hasMoreReps = load === bestLoad && load > 0 && (set.metrics.reps ?? 0) > (best?.metrics.reps ?? 0);
    const isLaterUnloadedSet = load === 0 && bestLoad === 0;
    if (!best || isHeavier || hasMoreReps || isLaterUnloadedSet) best = set;
  }

  return best;
}

// "62.5 kg × 8 reps · RPE 7" reads as "62.5 kg × 8 reps" here; effort belongs in the full session.
function formatBestSet(summary: string) {
  return summary.replace(/\s·\s(?:RPE|Intensity)\s\S+$/, '');
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ReedText variant="stat">{value}</ReedText>
      <ReedText tone="muted" variant="caption">{label}</ReedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  card: {
    gap: 4,
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  exerciseName: {
    flex: 1,
  },
  exerciseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
  },
  header: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  stats: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginBottom: 6,
    paddingBottom: 12,
    paddingTop: 6,
  },
});

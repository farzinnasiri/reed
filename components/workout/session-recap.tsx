import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MascotController } from '@/components/reed/mascot';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import type { SessionPresentation } from '@/domains/workout/session-presentation';
import { sessionHeadline } from './session-headline';
import { SessionArtwork } from './session-artwork';
import { ExerciseImage } from './exercise-image';
import { SessionNotesRow } from './session-notes-row';
import { formatClockTime, formatCompactDuration } from './session-time-format';
import { styles } from './session-recap.styles';
import { SessionStats } from './session-stats';
import { SessionBreakdown } from './session-breakdown';
import { pickRecapLine } from './sessions-copy';
import type { SessionInsightsValue } from './workout-session-insights';
import { WorkoutDuration, type WorkoutTiming } from './workout-duration';
import type { TimelineRow } from './workout-surface.types';

type Props = {
  celebrate: boolean;
  contentTopInset: number;
  mascot: ReactNode;
  mascotController: MascotController;
  seed: number;
  data: {
    presentation: SessionPresentation;
    dateLabel: string;
    durationFallback: string;
    notes: string;
    minutes: number;
    lastSetAt: number | null;
    suggestedSeconds: number | null;
    timeline: TimelineRow[];
    timeRange: string;
    timing: WorkoutTiming;
  };
  insightState: {
    value: SessionInsightsValue | null;
    error: string | null;
    loading: boolean;
  };
  actions: {
    openNotes: () => void;
    applyDuration: (seconds: number) => void;
    isApplyingDuration: boolean;
  };
};

export function SessionRecap({
  celebrate,
  contentTopInset,
  mascot,
  mascotController,
  seed,
  data,
  insightState,
  actions,
}: Props) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const {
    presentation,
    dateLabel,
    durationFallback,
    notes,
    minutes,
    lastSetAt,
    suggestedSeconds,
    timeline,
    timeRange,
    timing,
  } = data;
  const insights = insightState.value;
  const headline = useMemo(
    () => (insights ? sessionHeadline(insights.summary) : null),
    [insights],
  );
  const said = pickRecapLine(
    { prCount: headline?.prCount ?? 0, sets: presentation.sets, minutes },
    seed,
  );
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const prExercises = insights?.fullInsights.performance.prExercises ?? [];
  const firstRecord = timeline.find((row) =>
    prExercises.includes(row.exerciseName),
  );
  const topSets = new Map(
    [...(insights?.fullInsights.performance.topSets ?? [])]
      .reverse()
      .map((entry) => [entry.exerciseName, entry.summary]),
  );
  useEffect(() => {
    if (celebrate) mascotController.react(said.face, 5000);
  }, [celebrate, mascotController, said.face]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: insets.bottom + theme.spacing.xl,
          paddingTop: contentTopInset,
        },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      {celebrate ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          {mascot}
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <ReedText variant="headline">Workout saved</ReedText>
            <ReedText tone="secondary" variant="caption">
              {said.text}
            </ReedText>
          </View>
        </View>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <ReedText tone="secondary" variant="caption">
            {dateLabel}
          </ReedText>
          <ReedText variant="display">{presentation.title}</ReedText>
          <ReedText tone="muted" variant="caption">
            {presentation.areas.join(' · ') ||
              (presentation.sets
                ? `${presentation.completedExercises} ${presentation.completedExercises === 1 ? 'exercise' : 'exercises'} logged`
                : 'No sets logged')}
          </ReedText>
        </View>
        <SessionArtwork category={presentation.category} />
      </View>
      <SessionStats
        duration={
          <WorkoutDuration fallback={durationFallback} timing={timing} />
        }
        headline={headline}
        setsFallback={presentation.sets}
      />
      {suggestedSeconds !== null && lastSetAt !== null ? (
        <View
          style={[
            styles.suggestion,
            { backgroundColor: theme.colors.surfaceRaised },
          ]}
        >
          <View style={styles.suggestionCopy}>
            <ReedText variant="bodyStrong">Forgot to stop the clock?</ReedText>
            <ReedText tone="secondary" variant="caption">
              Last set at {formatClockTime(lastSetAt)}. Recorded time:{' '}
              {durationFallback}.
            </ReedText>
          </View>
          <ReedButton
            disabled={actions.isApplyingDuration}
            label={`Use ${formatCompactDuration(suggestedSeconds)}`}
            onPress={() => actions.applyDuration(suggestedSeconds)}
            variant="soft"
          />
        </View>
      ) : null}
      {firstRecord ? (
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel={`Show personal record for ${firstRecord.exerciseName}`}
          onPress={() => setExpandedExercise(firstRecord.sessionExerciseId)}
          style={{
            flexDirection: 'row',
            gap: theme.spacing.sm,
            alignItems: 'center',
            paddingVertical: theme.spacing.sm,
          }}
        >
          <Ionicons
            name="trophy-outline"
            size={20}
            color={String(theme.colors.accentInk)}
          />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <ReedText tone="accent" variant="bodyStrong">
              {firstRecord.exerciseName} · new best
            </ReedText>
            <ReedText tone="secondary" variant="caption">
              {topSets.has(firstRecord.exerciseName)
                ? `Top set · ${topSets.get(firstRecord.exerciseName)}`
                : 'Open the exercise to review your sets'}
            </ReedText>
          </View>
          <Ionicons
            name="chevron-down"
            size={16}
            color={String(theme.colors.accentInk)}
          />
        </HapticPressable>
      ) : null}
      <View style={styles.section}>
        <ReedText variant="headline">Exercises</ReedText>
        {timeline.map((row) => (
          <RecapExercise
            key={row.sessionExerciseId}
            row={row}
            bestSet={topSets.get(row.exerciseName) ?? null}
            isRecord={prExercises.includes(row.exerciseName)}
            expanded={expandedExercise === row.sessionExerciseId}
            onToggle={() =>
              setExpandedExercise((current) =>
                current === row.sessionExerciseId
                  ? null
                  : row.sessionExerciseId,
              )
            }
          />
        ))}
      </View>
      <SessionNotesRow notes={notes} onPress={actions.openNotes} />
      {presentation.sets > 0 ? (
        <SessionBreakdown
          errorMessage={insightState.error}
          insights={insights}
          isLoading={insightState.loading}
        />
      ) : null}
      <ReedText tone="muted" variant="caption">
        Recorded {timeRange}
        {timing.manualDurationSeconds !== undefined
          ? ' · duration adjusted'
          : ''}
      </ReedText>
    </ScrollView>
  );
}

function RecapExercise({
  bestSet,
  isRecord,
  row,
  expanded,
  onToggle,
}: {
  bestSet: string | null;
  isRecord: boolean;
  row: TimelineRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { theme } = useReedTheme();
  // A last set is not necessarily the best. Keep its description neutral until insights arrive.
  const evidence = bestSet ?? row.sets.at(-1)?.summary ?? null;
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.line,
        paddingBottom: theme.spacing.sm,
      }}
    >
      <HapticPressable
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} sets for ${row.exerciseName}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        disabled={row.setCount === 0}
        onPress={onToggle}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            minHeight: 64,
            paddingVertical: theme.spacing.xs,
          },
          getTapScaleStyle(pressed),
        ]}
      >
        <ExerciseImage imageUrl={row.imageUrl} />
        <View style={styles.cardCopy}>
          <ReedText variant="bodyStrong">{row.exerciseName}</ReedText>
          <ReedText tone="secondary" variant="caption">
            {row.setCount
              ? `${row.setCount} ${row.setCount === 1 ? 'set' : 'sets'}${evidence ? ` · ${evidence}` : ''}`
              : 'No sets logged'}
          </ReedText>
        </View>
        {isRecord ? (
          <Ionicons
            name="trophy-outline"
            size={16}
            color={String(theme.colors.accentInk)}
          />
        ) : null}
        {row.setCount > 0 ? (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            color={String(theme.colors.inkMuted)}
            size={18}
          />
        ) : null}
      </HapticPressable>
      {expanded ? (
        <View
          style={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }}
        >
          {row.sets.map((set) => (
            <View
              key={set.setLogId}
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: theme.spacing.md,
              }}
            >
              <ReedText tone="muted" variant="caption" style={{ width: 52 }}>
                {set.warmup ? 'Warmup' : `Set ${set.setNumber}`}
              </ReedText>
              <ReedText style={{ flex: 1 }} variant="body">
                {set.summary}
              </ReedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

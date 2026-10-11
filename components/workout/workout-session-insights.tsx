import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { ReedButton } from '@/components/ui/reed-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useReedTheme } from '@/design/provider';
import { workoutSemanticPalette } from '@/design/system';
import type {
  LiveSessionFullInsights,
  LiveSessionSummary,
} from './workout-surface.types';
import { styles } from './workout-session-insights.styles';
import { RecapVisuals } from './recap-visuals';
import { formatCompactDuration } from './session-time-format';

export type SessionInsightsValue = {
  fullInsights: LiveSessionFullInsights;
  summary: LiveSessionSummary;
};
type Props = {
  errorMessage: string | null;
  insights: SessionInsightsValue | null;
  isLoading: boolean;
  onRetry?: () => void;
  showSnapshot?: boolean;
};

export function SessionInsights({
  errorMessage,
  insights,
  isLoading,
  onRetry,
}: Props) {
  const { theme } = useReedTheme();
  const [metric, setMetric] = useState<'sets' | 'reps' | 'volume'>('sets');
  if (!insights)
    return (
      <View style={{ gap: theme.spacing.sm }}>
        {isLoading ? (
          <ActivityIndicator color={String(theme.colors.accent)} />
        ) : null}
        {errorMessage ? <ReedText tone="muted">{errorMessage}</ReedText> : null}
        {errorMessage && onRetry ? (
          <ReedButton label="Try again" variant="quiet" onPress={onRetry} />
        ) : null}
      </View>
    );
  const { summary, fullInsights } = insights;
  const value = (
    row: LiveSessionSummary['distribution']['byGranularMuscleGroup'][number],
  ) =>
    metric === 'sets'
      ? row.setCount
      : metric === 'reps'
        ? row.reps
        : row.loadKg;
  const muscleRows = summary.distribution.byGranularMuscleGroup
    .filter(
      (row) =>
        row.groupId !== 'cardio' && row.groupId !== 'other' && value(row) > 0,
    )
    .sort((a, b) => value(b) - value(a));
  const peak = Math.max(1, ...muscleRows.map(value));
  const unit = metric === 'sets' ? 'sets' : metric === 'reps' ? 'reps' : 'kg';
  const buckets = fullInsights.modalityBreakdown.buckets.filter(
    (bucket) => bucket.count > 0,
  );
  const hasMuscles = summary.distribution.byGranularMuscleGroup.some(
    (row) =>
      row.groupId !== 'cardio' && row.groupId !== 'other' && row.setCount > 0,
  );
  const demand = summary.highlights.mostDemandingExercise;
  const metricRows: [string, string | null][] = [
    [
      'Total load moved',
      summary.output.totalLoadKg > 0
        ? `${Math.round(summary.output.totalLoadKg).toLocaleString()} kg`
        : null,
    ],
    [
      'Distance covered',
      summary.output.totalDistanceKm > 0
        ? `${summary.output.totalDistanceKm.toLocaleString()} km`
        : null,
    ],
    [
      'Time held',
      summary.output.totalHoldSeconds > 0
        ? formatCompactDuration(summary.output.totalHoldSeconds)
        : null,
    ],
    [
      'Average effort',
      summary.intensity.averageRpe !== null
        ? `${summary.intensity.averageRpe.toFixed(1)} / 10`
        : null,
    ],
    [
      'Highest effort',
      summary.intensity.highestRpe !== null
        ? `${summary.intensity.highestRpe} / 10`
        : null,
    ],
    [
      'Average rest',
      summary.recovery.averageRestSeconds !== null
        ? formatCompactDuration(summary.recovery.averageRestSeconds)
        : null,
    ],
    [
      'Total rest',
      summary.recovery.totalRestSeconds > 0
        ? formatCompactDuration(summary.recovery.totalRestSeconds)
        : null,
    ],
    [
      'Longest rest',
      fullInsights.recoveryAnalysis.longestRestSeconds !== null
        ? formatCompactDuration(
            fullInsights.recoveryAnalysis.longestRestSeconds,
          )
        : null,
    ],
    [
      'Shortest rest',
      fullInsights.recoveryAnalysis.shortestRestSeconds !== null
        ? formatCompactDuration(
            fullInsights.recoveryAnalysis.shortestRestSeconds,
          )
        : null,
    ],
    [
      'Sets per hour',
      summary.output.completedSets >= 3 &&
      fullInsights.exerciseMap.setsPerHour !== null
        ? fullInsights.exerciseMap.setsPerHour.toFixed(1)
        : null,
    ],
  ];
  return (
    <View style={[styles.sessionInsightsSections, { gap: theme.spacing.xl }]}>
      {fullInsights.performance.topSets.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <ReedText variant="bodyStrong">Top sets</ReedText>
          {fullInsights.performance.topSets.map((set, index) => (
            <View key={`${set.exerciseName}:${index}`} style={{ gap: theme.spacing.xxs }}>
              <ReedText variant="caption">{set.exerciseName}</ReedText>
              <ReedText variant="bodyStrong" tone="secondary">{set.summary}</ReedText>
            </View>
          ))}
        </View>
      ) : null}
      {buckets.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <ReedText variant="bodyStrong">What you logged</ReedText>
          {buckets.map((bucket) => (
            <View
              key={bucket.key}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: theme.spacing.md,
              }}
            >
              <ReedText tone="secondary">{bucket.label}</ReedText>
              <ReedText variant="bodyStrong">
                {bucket.count} {bucket.count === 1 ? 'set' : 'sets'}
              </ReedText>
            </View>
          ))}
        </View>
      ) : null}
      {hasMuscles ? (
        <View style={{ gap: theme.spacing.md }}>
          <ReedText variant="bodyStrong">Areas trained</ReedText>
          <SegmentedControl
            options={[
              { label: 'Sets', value: 'sets' },
              { label: 'Reps', value: 'reps' },
              { label: 'Load', value: 'volume' },
            ]}
            value={metric}
            onChange={setMetric}
          />
          <ReedText tone="muted" variant="caption">
            Based on the exercises you logged. A set can involve more than one
            area.
          </ReedText>
          {muscleRows.map((row) => (
            <View key={row.groupId} style={{ gap: theme.spacing.xxs }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                }}
              >
                <ReedText variant="caption">{row.label}</ReedText>
                <ReedText tone="secondary" variant="caption">
                  {Math.round(value(row)).toLocaleString()} {unit}
                </ReedText>
              </View>
              <View
                style={{
                  height: theme.spacing.xxs,
                  borderRadius: theme.radii.pill,
                  backgroundColor: theme.colors.surfaceHigh,
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${(value(row) / peak) * 100}%`,
                    borderRadius: theme.radii.pill,
                    backgroundColor:
                      workoutSemanticPalette.granularMuscleGroups[
                        row.groupId as keyof typeof workoutSemanticPalette.granularMuscleGroups
                      ] ?? theme.colors.accentInk,
                  }}
                />
              </View>
            </View>
          ))}
          {!muscleRows.length ? (
            <ReedText tone="muted" variant="caption">
              No {metric === 'volume' ? 'external load' : metric} recorded for
              these areas.
            </ReedText>
          ) : null}
        </View>
      ) : null}
      {metricRows.some(([, value]) => value !== null) ? (
        <View style={{ gap: theme.spacing.sm }}>
          <ReedText variant="bodyStrong">Session details</ReedText>
          {metricRows
            .filter(([, value]) => value !== null)
            .map(([label, value]) => (
              <View
                key={label}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                }}
              >
                <ReedText tone="secondary" variant="caption">
                  {label}
                </ReedText>
                <ReedText variant="caption">{value}</ReedText>
              </View>
            ))}
        </View>
      ) : null}
      <RecapVisuals insights={insights} />
      {fullInsights.performance.prExercises.length > 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <ReedText variant="bodyStrong">Personal records</ReedText>
          {fullInsights.performance.prExercises.map((name) => (
            <View key={name} style={{ gap: theme.spacing.xxs }}>
              <ReedText tone="accent" variant="bodyStrong">
                {name}
              </ReedText>
              <ReedText tone="secondary" variant="caption">
                {
                  fullInsights.performance.topSets.find(
                    (set) => set.exerciseName === name,
                  )?.summary
                }
              </ReedText>
            </View>
          ))}
        </View>
      ) : null}
      {fullInsights.performance.nearPrExercises.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <ReedText variant="bodyStrong">Close to your best</ReedText>
          {fullInsights.performance.nearPrExercises.map((name) => (
            <ReedText key={name} tone="secondary">
              {name}
            </ReedText>
          ))}
        </View>
      ) : null}
      {demand ? (
        <View style={{ gap: theme.spacing.xxs }}>
          <ReedText variant="bodyStrong">Highest average effort</ReedText>
          <ReedText tone="secondary">
            {demand.exerciseName} · {demand.averageRpe.toFixed(1)} / 10
          </ReedText>
        </View>
      ) : null}
    </View>
  );
}

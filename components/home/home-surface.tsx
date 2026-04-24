import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AnalyticsDonut } from '@/components/ui/analytics-donut';
import { getGlassControlTokens } from '@/components/ui/glass-material';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle, runReedLayoutAnimation } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii, workoutSemanticPalette } from '@/design/system';
import { formatWeeklyVolume } from '@/domains/workout/weekly-muscle-stats';
import { getFirstName, pickHomeGreeting } from './home-greetings';

type HomeSurfaceProps = {
  displayName: string;
  hasActiveSession: boolean;
  onOpenWorkout: () => void;
};

type WeeklyBreakdownMetric = 'reps' | 'sets' | 'volume';
type WeeklyBreakdownGroup = {
  groupId: string;
  label: string;
  reps: number;
  setCount: number;
  volume: number;
};
type WeeklyBreakdownStats = {
  granularGroups?: WeeklyBreakdownGroup[];
  groups: WeeklyBreakdownGroup[];
};

export function HomeSurface({
  displayName,
  hasActiveSession,
  onOpenWorkout,
}: HomeSurfaceProps) {
  const { theme } = useReedTheme();
  const startSession = useMutation(api.liveSessions.start);
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(false);
  const [metricMode, setMetricMode] = useState<WeeklyBreakdownMetric>('sets');
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const firstName = getFirstName(displayName);
  const [headline] = useState(() => pickHomeGreeting(firstName));
  const glassControls = getGlassControlTokens(theme);

  const weekRange = getCurrentWeekRange();
  const weeklyStats = useQuery(api.homeStats.getWeeklyMuscleStats, {
    weekEndAt: weekRange.weekEndAt,
    weekStartAt: weekRange.weekStartAt,
  });

  const weekLabel = formatWeekRange(
    weeklyStats?.weekStartAt ?? weekRange.weekStartAt,
    weeklyStats?.weekEndAt ?? weekRange.weekEndAt,
  );
  const workoutShapeGroups = weeklyStats?.groups ?? [];
  const breakdownGroups = getWeeklyBreakdownGroups(weeklyStats);
  const rankedWorkoutShapeGroups = useMemo(
    () =>
      [...workoutShapeGroups]
        .filter(group => group.setCount > 0)
        .sort((left, right) => right.setCount - left.setCount || left.label.localeCompare(right.label)),
    [workoutShapeGroups],
  );
  const workoutShapeShare = useMemo(
    () => getNormalizedShareByGroup(rankedWorkoutShapeGroups, 'sets'),
    [rankedWorkoutShapeGroups],
  );
  const workoutShapeSegments = useMemo(
    () =>
      rankedWorkoutShapeGroups.map(group => ({
        color: getCoarseMuscleGroupColor(group.groupId),
        groupId: group.groupId,
        label: group.label,
        percent: workoutShapeShare.get(group.groupId) ?? 0,
      })),
    [rankedWorkoutShapeGroups, workoutShapeShare],
  );
  const rankedGroups = useMemo(
    () =>
      [...breakdownGroups]
        .filter(group => getMetricValue(group, metricMode) > 0)
        .sort((left, right) => {
          const diff = getMetricValue(right, metricMode) - getMetricValue(left, metricMode);
          if (diff !== 0) {
            return diff;
          }
          return left.label.localeCompare(right.label);
        }),
    [breakdownGroups, metricMode],
  );
  const shareByGroup = useMemo(
    () => getNormalizedShareByGroup(rankedGroups, metricMode),
    [metricMode, rankedGroups],
  );
  const totalMetricValue = useMemo(
    () => rankedGroups.reduce((sum, group) => sum + getMetricValue(group, metricMode), 0),
    [metricMode, rankedGroups],
  );
  const chartSegments = useMemo(
    () =>
      rankedGroups
        .filter(group => getMetricValue(group, metricMode) > 0)
        .map(group => ({
          color: getGranularMuscleGroupColor(group.groupId),
          groupId: group.groupId,
          label: group.label,
          percent: shareByGroup.get(group.groupId) ?? 0,
          value: getMetricValue(group, metricMode),
        })),
    [metricMode, rankedGroups, shareByGroup],
  );

  function toggleBreakdown() {
    runReedLayoutAnimation();
    setIsBreakdownExpanded(current => !current);
  }

  async function handleStartSession() {
    setStartError(null);
    setIsStarting(true);

    try {
      if (!hasActiveSession) {
        await startSession({});
      }
      onOpenWorkout();
    } catch (error) {
      setStartError(getErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: theme.spacing.xxxl + theme.spacing.sm,
          paddingTop: theme.spacing.sm,
        },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <View style={styles.header}>
        <ReedText style={styles.headerHeadline} variant="title">
          {headline}
        </ReedText>
      </View>

      <GlassSurface style={styles.card}>
        <View style={styles.cardHeader}>
          <ReedText variant="section">{hasActiveSession ? 'Session in progress' : 'Start your next session'}</ReedText>
          <ReedText tone="muted">
            {hasActiveSession
              ? 'Jump back into your active timeline and continue logging.'
              : 'Create a live workout and keep this weekly board moving.'}
          </ReedText>
        </View>

        <Pressable
          accessibilityLabel={hasActiveSession ? 'Continue current session' : 'Start a new session'}
          disabled={isStarting}
          onPress={() => void handleStartSession()}
          style={({ pressed }) => [
            styles.startButtonShell,
            {
              opacity: isStarting ? 0.7 : 1,
              ...getTapScaleStyle(pressed, isStarting),
            },
          ]}
        >
          <View
            style={[
              styles.startButtonFill,
              { backgroundColor: theme.colors.accentPrimary },
            ]}
          >
            <ReedText style={[styles.startButtonLabel, { color: theme.colors.accentPrimaryText }]} variant="section">
              {isStarting ? 'Starting...' : hasActiveSession ? 'Continue Session' : 'Start Session'}
            </ReedText>
          </View>
        </Pressable>

        {startError ? <ReedText tone="danger">{startError}</ReedText> : null}
      </GlassSurface>

      <GlassSurface style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.weeklyHeaderCopy}>
            <ReedText variant="section">Weekly load</ReedText>
            <ReedText tone="muted">{weekLabel}</ReedText>
          </View>
          <Pressable
            accessibilityLabel={isBreakdownExpanded ? 'Hide muscle load breakdown' : 'Show muscle load breakdown'}
            onPress={toggleBreakdown}
            style={({ pressed }) => [
              styles.expandButton,
              {
                backgroundColor: glassControls.shellBackgroundColor,
                borderColor: glassControls.shellBorderColor,
                ...getTapScaleStyle(pressed),
              },
            ]}
          >
            <Ionicons
              color={String(theme.colors.textPrimary)}
              name={isBreakdownExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
            />
          </Pressable>
        </View>

        {weeklyStats === undefined ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={String(theme.colors.accentPrimary)} />
            <ReedText tone="muted">Preparing weekly breakdown...</ReedText>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.summaryStrip,
                {
                  backgroundColor: glassControls.shellBackgroundColor,
                  borderColor: glassControls.shellBorderColor,
                },
              ]}
            >
              <SummaryMetric
                label="Sets"
                showDivider
                value={{ value: formatWholeNumber(weeklyStats.totalSets) }}
              />
              <SummaryMetric
                label="Reps"
                showDivider
                value={{ value: formatWholeNumber(weeklyStats.totalReps) }}
              />
              <SummaryMetric
                label="Volume"
                value={formatVolumeDisplay(weeklyStats.totalVolume)}
              />
            </View>

            {isBreakdownExpanded ? (
              rankedGroups.length === 0 ? (
                <View style={styles.emptyState}>
                  <ReedText tone="muted">
                    No sets logged this week yet. Start a session to populate your muscle board.
                  </ReedText>
                </View>
              ) : (
                <View style={styles.breakdownSection}>
                  <View style={styles.breakdownControlsRow}>
                    <View
                      style={[
                        styles.breakdownMetricSwitch,
                        {
                          backgroundColor: glassControls.shellBackgroundColor,
                          borderColor: glassControls.shellBorderColor,
                        },
                      ]}
                    >
                      {(['sets', 'reps', 'volume'] as WeeklyBreakdownMetric[]).map(mode => (
                        <Pressable
                          key={mode}
                          onPress={() => setMetricMode(mode)}
                          style={({ pressed }) => [
                            styles.breakdownMetricOption,
                            metricMode === mode
                              ? {
                                  backgroundColor: theme.colors.controlActiveFill,
                                }
                              : null,
                            getTapScaleStyle(pressed),
                          ]}
                        >
                          <ReedText
                            style={styles.breakdownMetricOptionText}
                            tone={metricMode === mode ? 'default' : 'muted'}
                            variant="caption"
                          >
                            {mode === 'sets' ? 'Sets' : mode === 'reps' ? 'Reps' : 'Volume'}
                          </ReedText>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.breakdownOverview}>
                    <WeeklyDonutChart
                      segments={chartSegments.map(segment => ({
                        color: segment.color,
                        id: segment.groupId,
                        percent: segment.percent,
                      }))}
                      subtitle={metricMode === 'sets' ? 'sets' : metricMode === 'reps' ? 'reps' : 'volume'}
                      value={formatMetricSummaryValue(metricMode, totalMetricValue)}
                    />

                    <View style={styles.breakdownLegend}>
                      {chartSegments.slice(0, 5).map(segment => (
                        <View key={`legend-${segment.groupId}`} style={styles.breakdownLegendRow}>
                          <View style={[styles.breakdownLegendDot, { backgroundColor: segment.color }]} />
                          <ReedText style={styles.breakdownLegendLabel} variant="caption">
                            {segment.label}
                          </ReedText>
                          <ReedText tone="muted" variant="caption">
                            {segment.percent}% ({formatMetricLegendValue(metricMode, segment.value)})
                          </ReedText>
                        </View>
                      ))}
                    </View>
                  </View>

                  {workoutShapeSegments.length > 0 ? (
                    <View style={styles.breakdownShapeSection}>
                      <ReedText tone="muted" variant="caption">
                        Workout shape
                      </ReedText>
                      <View
                        style={[
                          styles.breakdownShapeTrack,
                          { backgroundColor: theme.colors.controlBorder },
                        ]}
                      >
                        {workoutShapeSegments.map(segment => (
                          <View
                            key={`shape-${segment.groupId}`}
                            style={[
                              styles.breakdownShapeSegment,
                              {
                                backgroundColor: segment.color,
                                flex: Math.max(segment.percent, 0.0001),
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <View style={styles.breakdownShapeLegend}>
                        {workoutShapeSegments.map(segment => (
                          <View key={`shape-legend-${segment.groupId}`} style={styles.breakdownShapeLegendRow}>
                            <View style={[styles.breakdownLegendDot, { backgroundColor: segment.color }]} />
                            <ReedText style={styles.breakdownShapeLegendLabel} variant="caption">
                              {segment.label}
                            </ReedText>
                            <ReedText tone="muted" variant="caption">
                              {segment.percent}%
                            </ReedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              )
            ) : null}
          </>
        )}
      </GlassSurface>
    </ScrollView>
  );
}

function SummaryMetric({
  label,
  showDivider = false,
  value,
}: {
  label: string;
  showDivider?: boolean;
  value: MetricDisplay;
}) {
  const { theme } = useReedTheme();

  return (
    <View style={styles.summaryMetric}>
      <View style={styles.summaryValueRow}>
        <ReedText style={styles.summaryValue} variant="title">
          {value.value}
        </ReedText>
        {value.unit ? (
          <ReedText style={styles.summaryValueUnit} tone="muted" variant="bodyStrong">
            {value.unit}
          </ReedText>
        ) : null}
      </View>
      <ReedText tone="muted" variant="label">
        {label}
      </ReedText>
      {showDivider ? (
        <View
          style={[
            styles.summaryDivider,
            { backgroundColor: theme.colors.controlBorder },
          ]}
        />
      ) : null}
    </View>
  );
}

function WeeklyDonutChart({
  segments,
  subtitle,
  value,
}: {
  segments: Array<{ color: string; id: string; percent: number }>;
  subtitle: string;
  value: string;
}) {
  return (
    <AnalyticsDonut
      centerPrimary={value}
      centerPrimaryStyle={styles.breakdownDonutValue}
      centerSecondary={subtitle}
      centerSecondaryStyle={styles.breakdownDonutSubtitle}
      containerStyle={styles.breakdownDonutContainer}
      segments={segments}
      size={132}
      strokeWidth={16}
      wrapStyle={styles.breakdownDonutWrap}
    />
  );
}

type MetricDisplay = {
  unit?: string;
  value: string;
};

function getWeeklyBreakdownGroups(weeklyStats: WeeklyBreakdownStats | undefined): WeeklyBreakdownGroup[] {
  if (!weeklyStats) {
    return [];
  }

  if ('granularGroups' in weeklyStats && Array.isArray(weeklyStats.granularGroups)) {
    return weeklyStats.granularGroups;
  }

  return weeklyStats.groups;
}

function getMetricValue(group: WeeklyBreakdownGroup, mode: WeeklyBreakdownMetric) {
  if (mode === 'sets') {
    return group.setCount;
  }

  if (mode === 'reps') {
    return group.reps;
  }

  return group.volume;
}

function formatMetricSummaryValue(mode: WeeklyBreakdownMetric, value: number) {
  if (mode === 'volume') {
    return formatWeeklyVolume(value);
  }

  return formatWholeNumber(value);
}

function formatMetricLegendValue(mode: WeeklyBreakdownMetric, value: number) {
  if (mode === 'sets') {
    return `${formatWholeNumber(value)} sets`;
  }

  if (mode === 'reps') {
    return `${formatWholeNumber(value)} reps`;
  }

  return formatWeeklyVolume(value);
}

function getNormalizedShareByGroup(
  groups: WeeklyBreakdownGroup[],
  mode: WeeklyBreakdownMetric,
) {
  const shares = new Map<string, number>();
  const positive = groups
    .map(group => ({ group, value: getMetricValue(group, mode) }))
    .filter(entry => entry.value > 0);

  if (positive.length === 0) {
    for (const group of groups) {
      shares.set(group.groupId, 0);
    }
    return shares;
  }

  const total = positive.reduce((sum, entry) => sum + entry.value, 0);
  const ranked = positive.map(entry => {
    const raw = (entry.value / total) * 100;
    const floor = Math.floor(raw);
    return {
      floor,
      fraction: raw - floor,
      groupId: entry.group.groupId,
      value: entry.value,
    };
  });

  let distributed = ranked.reduce((sum, row) => sum + row.floor, 0);
  const needed = Math.max(0, 100 - distributed);
  const byRemainder = [...ranked].sort(
    (left, right) =>
      right.fraction - left.fraction || right.value - left.value || left.groupId.localeCompare(right.groupId),
  );

  for (let index = 0; index < needed; index += 1) {
    const target = byRemainder[index % byRemainder.length];
    target.floor += 1;
    distributed += 1;
    if (distributed >= 100) {
      break;
    }
  }

  for (const row of ranked) {
    shares.set(row.groupId, row.floor);
  }

  for (const group of groups) {
    if (!shares.has(group.groupId)) {
      shares.set(group.groupId, 0);
    }
  }

  return shares;
}

function getCoarseMuscleGroupColor(groupId: string) {
  if (groupId === 'arms') {
    return workoutSemanticPalette.muscleGroups.arms;
  }

  if (groupId === 'back') {
    return workoutSemanticPalette.muscleGroups.back;
  }

  if (groupId === 'cardio') {
    return workoutSemanticPalette.muscleGroups.cardio;
  }

  if (groupId === 'chest') {
    return workoutSemanticPalette.muscleGroups.chest;
  }

  if (groupId === 'core') {
    return workoutSemanticPalette.muscleGroups.core;
  }

  if (groupId === 'legs') {
    return workoutSemanticPalette.muscleGroups.legs;
  }

  if (groupId === 'shoulders') {
    return workoutSemanticPalette.muscleGroups.shoulders;
  }

  return workoutSemanticPalette.muscleGroups.other;
}

function getGranularMuscleGroupColor(groupId: string) {
  if (groupId === 'adductors') {
    return workoutSemanticPalette.granularMuscleGroups.adductors;
  }

  if (groupId === 'biceps') {
    return workoutSemanticPalette.granularMuscleGroups.biceps;
  }

  if (groupId === 'calves') {
    return workoutSemanticPalette.granularMuscleGroups.calves;
  }

  if (groupId === 'cardio') {
    return workoutSemanticPalette.granularMuscleGroups.cardio;
  }

  if (groupId === 'chest') {
    return workoutSemanticPalette.granularMuscleGroups.chest;
  }

  if (groupId === 'core') {
    return workoutSemanticPalette.granularMuscleGroups.core;
  }

  if (groupId === 'forearms') {
    return workoutSemanticPalette.granularMuscleGroups.forearms;
  }

  if (groupId === 'glutes') {
    return workoutSemanticPalette.granularMuscleGroups.glutes;
  }

  if (groupId === 'hamstrings') {
    return workoutSemanticPalette.granularMuscleGroups.hamstrings;
  }

  if (groupId === 'lats') {
    return workoutSemanticPalette.granularMuscleGroups.lats;
  }

  if (groupId === 'quads') {
    return workoutSemanticPalette.granularMuscleGroups.quads;
  }

  if (groupId === 'shoulders') {
    return workoutSemanticPalette.granularMuscleGroups.shoulders;
  }

  if (groupId === 'traps') {
    return workoutSemanticPalette.granularMuscleGroups.traps;
  }

  if (groupId === 'triceps') {
    return workoutSemanticPalette.granularMuscleGroups.triceps;
  }

  if (groupId === 'upperBack') {
    return workoutSemanticPalette.granularMuscleGroups.upperBack;
  }

  return workoutSemanticPalette.granularMuscleGroups.other;
}

function getCurrentWeekRange() {
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const daysSinceMonday = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return {
    weekEndAt: weekEnd.getTime(),
    weekStartAt: weekStart.getTime(),
  };
}

function formatWeekRange(weekStartAt: number, weekEndAt: number) {
  const formatter = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
  });

  const weekStart = new Date(weekStartAt);
  const weekEndDisplay = new Date(weekEndAt - 1);
  return `${formatter.format(weekStart)} - ${formatter.format(weekEndDisplay)}`;
}

function formatWholeNumber(value: number) {
  return Math.round(value).toLocaleString('en');
}

function formatVolumeDisplay(value: number): MetricDisplay {
  const formatted = formatWeeklyVolume(value);
  const [amount, unit] = formatted.split(' ');

  return {
    unit,
    value: amount ?? formatted,
  };
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: string }).message;
    if (message) {
      return message;
    }
  }

  return 'Could not start session right now.';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: 14,
  },
  header: {
    gap: 4,
    paddingHorizontal: 4,
  },
  headerHeadline: {
    lineHeight: 31,
  },
  card: {
    borderRadius: reedRadii.xl,
    marginHorizontal: 2,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  weeklyHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  expandButton: {
    alignItems: 'center',
    borderRadius: reedRadii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    width: 42,
  },
  startButtonShell: {
    borderRadius: reedRadii.lg,
    overflow: 'hidden',
  },
  startButtonFill: {
    alignItems: 'center',
    borderRadius: reedRadii.lg,
    justifyContent: 'center',
    minHeight: 62,
    paddingHorizontal: 20,
  },
  startButtonLabel: {
    textAlign: 'center',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 72,
  },
  summaryStrip: {
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  summaryMetric: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    position: 'relative',
  },
  summaryValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
  },
  summaryValue: {
    textAlign: 'center',
  },
  summaryValueUnit: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 2,
  },
  summaryDivider: {
    bottom: 16,
    position: 'absolute',
    right: 0,
    top: 16,
    width: 1,
  },
  breakdownSection: {
    gap: 12,
    paddingTop: 8,
  },
  breakdownControlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  breakdownMetricSwitch: {
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  breakdownMetricOption: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 58,
    paddingHorizontal: 10,
  },
  breakdownMetricOptionText: {
    fontFamily: 'Outfit_600SemiBold',
  },
  breakdownShapeSection: {
    gap: 6,
  },
  breakdownShapeTrack: {
    borderRadius: reedRadii.pill,
    flexDirection: 'row',
    height: 10,
    overflow: 'hidden',
  },
  breakdownShapeSegment: {
    minWidth: 0,
  },
  breakdownShapeLegend: {
    gap: 4,
  },
  breakdownShapeLegendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  breakdownShapeLegendLabel: {
    flex: 1,
  },
  breakdownOverview: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  breakdownDonutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownDonutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  breakdownDonutValue: {
    textAlign: 'center',
  },
  breakdownDonutSubtitle: {
    marginTop: -1,
    textTransform: 'capitalize',
  },
  breakdownLegend: {
    flex: 1,
    gap: 6,
  },
  breakdownLegendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  breakdownLegendDot: {
    borderRadius: reedRadii.pill,
    height: 8,
    width: 8,
  },
  breakdownLegendLabel: {
    flex: 1,
  },
  emptyState: {
    minHeight: 80,
    justifyContent: 'center',
  },
});

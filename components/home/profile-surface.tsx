import { VALUE_LABELS, startingWeeklyTarget, rankedPractices } from '@/domains/profile/onboarding';
import type { FunctionReturnType } from 'convex/server';
import { BodyWeightProgress } from './profile/body-weight-progress';
import { ProgressSkeleton, formatDate } from './profile/progress-presentation';
import { styles } from './profile/profile.styles';
import { getCurrentWeekBounds, type ProfilePeriod } from '@/domains/trainingKnowledge/progress-periods';
import { useProgressPeriod } from './profile/use-progress-period';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ReedMascot } from '@/components/reed/mascot';
import { AnalyticsDonut } from '@/components/ui/analytics-donut';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import * as haptics from '@/design/haptics';
import { getTapScaleStyle } from '@/design/motion';
import { useBreakpoint } from '@/design/use-breakpoint';
import { useReedTheme } from '@/design/provider';
import { formatWeeklyVolume } from '@/domains/workout/weekly-muscle-stats';
import { getConsistencyCellFill, getConsistencyCellOpacity } from './profile/consistency-presenter';
import { useAppShell } from './app-shell-context';
import { ProgressSection } from './progress-section';
import { useFiveMinuteNow } from './use-five-minute-now';
import { weeklyActiveDaysProse, type StoredTrainingProfile } from './profile/profile-contract';
import { formatBodyMetric } from './profile-facts';

const CONSISTENCY_WEEK_COUNT = 12;

type ProgressMetric = 'load' | 'reps' | 'sets';
type TrainingWindowSummary = FunctionReturnType<typeof api.trainingKnowledge.summarizeWindow>;
type TrainingWindowGroup = TrainingWindowSummary['work']['groups'][number];
type ProfileConsistencyResult = FunctionReturnType<typeof api.trainingKnowledge.getConsistency>;

export function ProfileDashboardCards({ afterCoachNote }: { afterCoachNote?: ReactNode }) {
  const viewerTrainingProfile = useQuery(api.profiles.viewerTrainingProfile, {});
  const periodRange = useProgressPeriod('week');
  const progressSummary = useQuery(api.trainingKnowledge.summarizeWindow, {
    windowEndAt: periodRange.current.endAt,
    windowStartAt: periodRange.current.startAt,
  });
  const clock = useFiveMinuteNow();
  const consistency = useQuery(api.trainingKnowledge.getConsistency, { now: clock });
  const profileInsight = useQuery(api.profileInsight.getCurrent, {});
  const ensureProfileInsight = useMutation(api.profileInsight.ensureFresh);
  const { hasUnreadCoachMessage, markCoachMessageRead } = useAppShell();

  const trainingProfile = viewerTrainingProfile?.trainingProfile ?? null;
  const bodyWeight = viewerTrainingProfile?.latestBodyMetrics?.find((metric: { metricKey: string }) => metric.metricKey === 'body_weight') ?? null;
  const coachNote = useMemo(
    () => profileInsight?.content
      ? { lead: '', body: profileInsight.content }
      : formatCoachNote(trainingProfile, bodyWeight, progressSummary, consistency),
    [bodyWeight, consistency, profileInsight, progressSummary, trainingProfile],
  );

  useEffect(() => {
    void ensureProfileInsight({ clientNow: Date.now() });
  }, [ensureProfileInsight]);

  // Progress shows the note in full, so opening it is reading it.
  useEffect(() => {
    if (hasUnreadCoachMessage) {
      markCoachMessageRead();
    }
  }, [hasUnreadCoachMessage, markCoachMessageRead]);

  return (
    <>
      <CoachNote note={coachNote} />
      {afterCoachNote}
      <TrainingProgressExpansion />
      <ConsistencySurface consistency={consistency} />
      <BodyWeightProgress latestWeight={bodyWeight} />
    </>
  );
}

// Reed reading the numbers: its mascot and one note, with no card around it.
function CoachNote({ note }: { note: { body: string; lead: string } }) {
  const { theme } = useReedTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const noteKey = `${note.lead}|${note.body}`;
  const [previousNote, setPreviousNote] = useState(noteKey);
  if (previousNote !== noteKey) { setPreviousNote(noteKey); setIsExpanded(false); }
  const copy = <>{note.lead ? <ReedText variant="bodyStrong">{note.lead} </ReedText> : null}{note.body}</>;

  return (
    <View style={styles.coachNote}>
      <ReedMascot expression="idle" size="sm" />
      <View style={styles.coachNoteBody}>
        {/* Measure the same text at full length. RN Web does not implement onTextLayout. */}
        <ReedText
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          onLayout={event => setIsTruncated(event.nativeEvent.layout.height > theme.typography.body.lineHeight * 3 + 1)}
          style={{ position: 'absolute', left: 0, right: 0, top: 3, opacity: 0, pointerEvents: 'none' }}
          variant="body"
        >{copy}</ReedText>
        <ReedText numberOfLines={isExpanded ? undefined : 3} tone="secondary" variant="body">{copy}</ReedText>
        {isTruncated ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? 'Show less from Reed' : 'Read more from Reed'}
            accessibilityState={{ expanded: isExpanded }}
            hitSlop={8}
            onPress={() => { haptics.selection(); setIsExpanded(value => !value); }}
            style={({ pressed }) => [styles.coachNoteMore, getTapScaleStyle(pressed)]}
          >
            <ReedText tone="accent" variant="caption">{isExpanded ? 'Less' : 'More'}</ReedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ConsistencySurface({ consistency }: { consistency: ProfileConsistencyResult | undefined }) {
  const { theme } = useReedTheme();
  const [isHelperVisible, setIsHelperVisible] = useState(false);
  const rate = consistency?.recentOnTargetRate;

  return (
    <ProgressSection
      meta={rate && consistency.hasTrainingTarget ? `${rate.onTargetWeeks} of last ${rate.totalWeeks} weeks on target` : undefined}
      title="Consistency"
    >
      {consistency === undefined ? (
        <ConsistencyGrid weekGrid={null} />
      ) : (
        <>
          <ConsistencyGrid weekGrid={consistency.weekGrid} />
          <View style={styles.consistencyFooter}>
            <ReedText tone="muted" variant="caption">
              {formatOnTargetRun(consistency.currentOnTargetWeekRun)}
            </ReedText>
            <Pressable
              accessibilityLabel={isHelperVisible ? 'Hide consistency explanation' : 'Show consistency explanation'}
              onPress={() => setIsHelperVisible(value => !value)}
              style={({ pressed }) => [styles.infoButton, getTapScaleStyle(pressed)]}
            >
              <Ionicons color={String(theme.colors.inkMuted)} name="information-circle-outline" size={18} />
            </Pressable>
          </View>
          {isHelperVisible ? (
            <View style={[styles.consistencyHelper, { borderTopColor: theme.colors.line }]}>
              <ReedText tone="muted" variant="caption">{consistency.helperLine}</ReedText>
            </View>
          ) : null}
        </>
      )}
    </ProgressSection>
  );
}

// The last twelve weeks as columns, oldest to the left; each column is Monday to Sunday top to
// bottom and a filled cell is a day with logged training. `null` renders the empty skeleton.
function ConsistencyGrid({ weekGrid }: { weekGrid: ProfileConsistencyResult['weekGrid'] | null }) {
  const { theme } = useReedTheme();
  const columns = weekGrid ?? Array.from({ length: CONSISTENCY_WEEK_COUNT }, () => null);

  return (
    <View>
      <View style={styles.consistencyGrid}>
        {columns.map((week, weekIndex) => {
          const isCurrentWeek = weekIndex === columns.length - 1;
          return (
            <View key={week?.weekStartAt ?? weekIndex} style={styles.consistencyColumn}>
              {Array.from({ length: 7 }, (_, dayIndex) => {
                const day = week?.days[dayIndex];
                return (
                  <View
                    key={dayIndex}
                    accessibilityLabel={day ? formatConsistencyDayLabel(day) : undefined}
                    style={[
                      styles.consistencyCell,
                      {
                        backgroundColor: getConsistencyCellFill({
                          active: Boolean(day?.active),
                          activeFill: String(isCurrentWeek ? theme.colors.accentInk : theme.colors.accent),
                          isFuture: day?.isFuture ?? true,
                          shellColor: String(theme.colors.surfaceHigh),
                        }),
                        opacity: day
                          ? getConsistencyCellOpacity({
                            active: day.active,
                            activityCount: day.activityCount,
                            isFuture: day.isFuture,
                          })
                          : 0.42,
                      },
                    ]}
                  />
                );
              })}
            </View>
          );
        })}
      </View>
      <View style={styles.consistencyAxis}>
        <ReedText tone="muted" variant="micro">{CONSISTENCY_WEEK_COUNT} weeks ago</ReedText>
        <ReedText tone="muted" variant="micro">This week</ReedText>
      </View>
    </View>
  );
}

function TrainingProgressExpansion() {
  const [period, setPeriod] = useState<ProfilePeriod>('week');
  const [progressMetric, setProgressMetric] = useState<ProgressMetric>('sets');
  const periodRange = useProgressPeriod(period);
  const progressSummary = useQuery(api.trainingKnowledge.summarizeWindow, {
    windowEndAt: periodRange.current.endAt,
    windowStartAt: periodRange.current.startAt,
  });
  const previousProgressSummary = useQuery(api.trainingKnowledge.summarizeWindow, {
    windowEndAt: periodRange.previous.endAt,
    windowStartAt: periodRange.previous.startAt,
  });

  return (
    <ProgressSection meta={formatPeriodRangeLabel(period, periodRange.current)} title="Training">
      <TrainingProgressPanel
        metric={progressMetric}
        onChangeMetric={setProgressMetric}
        onChangePeriod={setPeriod}
        period={period}
        previousSummary={previousProgressSummary}
        summary={progressSummary}
      />
    </ProgressSection>
  );
}

function TrainingProgressPanel({
  metric,
  onChangeMetric,
  onChangePeriod,
  period,
  previousSummary,
  summary,
}: {
  metric: ProgressMetric;
  onChangeMetric: (metric: ProgressMetric) => void;
  onChangePeriod: (period: ProfilePeriod) => void;
  period: ProfilePeriod;
  previousSummary: TrainingWindowSummary | undefined;
  summary: TrainingWindowSummary | undefined;
}) {
  const { theme } = useReedTheme();
  const { isCompact } = useBreakpoint();
  const work = summary?.work;
  const previousWork = previousSummary?.work;
  const groups = useMemo(
    () => [...(work?.groups ?? [])].filter(group => getProgressMetricValue(group, metric) > 0)
      .sort((left, right) => getProgressMetricValue(right, metric) - getProgressMetricValue(left, metric)),
    [metric, work?.groups],
  );
  const totalMetric = groups.reduce((sum, group) => sum + getProgressMetricValue(group, metric), 0);
  const shareByGroup = useMemo(
    () => getNormalizedShareByGroup(groups, metric),
    [groups, metric],
  );
  const splitColors = [String(theme.colors.accent), String(theme.colors.dataWarm)];
  const chartSegments = groups.map((group, index) => ({
    color: splitColors[index] ?? String(theme.colors.inkMuted),
    id: group.groupId,
    percent: shareByGroup.get(group.groupId) ?? 0,
  }));
  return (
    <>
      <PeriodControl onChange={onChangePeriod} value={period} />

      {summary === undefined ? (
        <ProgressSkeleton />
      ) : !work || summary.activityCount === 0 ? (
        <View style={styles.emptyProgress}>
          <ReedText variant="bodyStrong">No training here yet</ReedText>
          <ReedText tone="muted" variant="caption">Start a session or quick log a set. This area will turn into your progress view.</ReedText>
        </View>
      ) : (
        <>
          <View style={styles.progressMetricRow}>
            <ProgressMetricTile label="Sets" value={formatWholeNumber(work.totalSets)} />
            <ProgressMetricTile label="Reps" value={formatWholeNumber(work.totalReps)} />
            <ProgressMetricTile label="Load" value={formatVolume(work.totalVolume)} />
          </View>

          <SegmentedControl<ProgressMetric>
            compact
            onChange={onChangeMetric}
            options={[
              { label: 'Sets', value: 'sets' },
              { label: 'Reps', value: 'reps' },
              { label: 'Load', value: 'load' },
            ]}
            style={styles.periodControl}
            value={metric}
            variant="card"
          />

          <View style={[styles.trainingVisualRow, isCompact && styles.trainingVisualRowCompact]}>
            <AnalyticsDonut
              centerPrimary={formatMetricSummaryValue(metric, totalMetric)}
              centerPrimaryStyle={styles.progressDonutValue}
              centerSecondary={metric === 'load' ? 'load' : metric}
              containerStyle={styles.progressDonutContainer}
              emptyColor={String(theme.colors.surfaceHigh)}
              segments={chartSegments}
              size={104}
              strokeWidth={12}
              wrapStyle={styles.progressDonutWrap}
            />

            <View style={styles.muscleLegend}>
              {groups.slice(0, 5).map((group, index) => (
                <View key={group.groupId} style={styles.muscleLegendRow}>
                  <View style={[styles.legendDot, { backgroundColor: splitColors[index] ?? theme.colors.inkMuted }]} />
                  <ReedText style={styles.legendLabel} variant="body">{group.label}</ReedText>
                  <ReedText tone="muted" variant="caption">{formatMetricLegendValue(metric, getProgressMetricValue(group, metric))}</ReedText>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.periodNote, { borderTopColor: theme.colors.line }]}>
            <ReedText tone="muted" variant="caption">{formatPeriodComparison(work, previousWork, metric)}</ReedText>
          </View>

          {summary.byExercise.length > 0 ? (
            <View style={[styles.topExerciseStack, { borderTopColor: theme.colors.line }]}>
              <ReedText tone="muted" variant="caption">Top exercises</ReedText>
              {summary.byExercise.slice(0, 3).map(exercise => (
                <View key={exercise.exerciseCatalogId} style={styles.topExerciseRow}>
                  <ReedText variant="body" style={styles.topExerciseName} numberOfLines={1}>{exercise.exerciseName}</ReedText>
                  <ReedText tone="muted" variant="caption">{exercise.setCount} sets</ReedText>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </>
  );
}

function PeriodControl({ onChange, value }: { onChange: (period: ProfilePeriod) => void; value: ProfilePeriod }) {
  return (
    <SegmentedControl<ProfilePeriod>
      compact
      onChange={period => {
        if (period !== value) {
          haptics.selection();
        }
        onChange(period);
      }}
      options={[
        { label: 'Week', value: 'week' },
        { label: '30D', value: '30d' },
        { label: '90D', value: '90d' },
      ]}
      style={styles.periodControl}
      value={value}
      variant="card"
    />
  );
}

function ProgressMetricTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.progressMetricTile}>
      <ReedText
        adjustsFontSizeToFit
        minimumFontScale={0.76}
        numberOfLines={1}
        variant="title"
        style={styles.progressMetricText}
      >
        {value}
      </ReedText>
      <ReedText
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        numberOfLines={1}
        tone="muted"
        variant="caption"
        style={styles.progressMetricText}
      >
        {label}
      </ReedText>
    </View>
  );
}

export function formatCurrentWeekRange() {
  const week = getCurrentWeekBounds(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  return formatWeekRange(week.startAt, week.endAt);
}

function formatConsistencyDayLabel(day: ProfileConsistencyResult['weekGrid'][number]['days'][number]) {
  const count = day.activityCountIsCapped
    ? 'at least 128 activities'
    : `${day.activityCount} logged ${day.activityCount === 1 ? 'activity' : 'activities'}`;
  return `${day.date}: ${count}`;
}

function formatOnTargetRun(run: number) {
  if (run === 0) return 'Not on a run of on-target weeks yet';
  return `${run} ${run === 1 ? 'week' : 'weeks'} on target in a row`;
}

function formatWeekRange(weekStartAt: number, weekEndAt: number) {
  const formatter = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
  });
  const weekStart = new Date(weekStartAt);
  const weekEndDisplay = new Date(weekEndAt - 1);
  return `${formatter.format(weekStart)} – ${formatter.format(weekEndDisplay)}`;
}

function formatPeriodRangeLabel(period: ProfilePeriod, range: { endAt: number; startAt: number }) {
  if (period === 'week') {
    return formatWeekRange(range.startAt, range.endAt);
  }

  return period === '30d' ? 'Last 30 days' : 'Last 90 days';
}

function formatCoachNote(
  trainingProfile: StoredTrainingProfile['trainingProfile'] | null,
  bodyWeight: { observedAt: number; unit?: string; value: number } | null,
  summary: TrainingWindowSummary | undefined,
  consistency: ProfileConsistencyResult | undefined,
) {
  if (!trainingProfile) {
    const base = {
      lead: 'Build the profile first.',
      body: 'Add goals, body data, and your training setup so coaching can become specific instead of generic.',
    };
    if (consistency) {
      return withConsistencyNote(base, consistency);
    }

    return base;
  }

  const answers = trainingProfile.onboarding;
  const primaryGoalLabel = answers?.values[0] ? VALUE_LABELS[answers.values[0]] : answers ? rankedPractices(answers)[0]?.label ?? 'Training' : 'Training';
  const target = answers ? startingWeeklyTarget(answers) : null;
  const weekly = target === null ? 'no days scheduled yet' : weeklyActiveDaysProse(target);

  if (summary === undefined) {
    const base = {
      lead: `${primaryGoalLabel} is the priority.`,
      body: `I am checking this week's training against your goal of ${weekly} before calling the next move.`,
    };
    if (consistency) {
      return withConsistencyNote(base, consistency);
    }

    return base;
  }

  if (summary.activityCount > 0) {
    const activeDays = consistency?.currentWeek.activeDays ?? getActiveDayCount(summary.recentActivities);
    const topGroup = [...summary.work.groups].sort((left, right) => right.setCount - left.setCount)[0];
    const workLine = topGroup && topGroup.setCount > 0
      ? `${topGroup.label.toLowerCase()} has taken the most work`
      : `${formatWholeNumber(summary.work.totalSets)} sets are logged`;
    const base = {
      lead: `${activeDays} active ${activeDays === 1 ? 'day' : 'days'} this week.`,
      body: `${workLine}. Keep the next session pointed at ${primaryGoalLabel.toLowerCase()} and avoid adding noise just to fill the week.`,
    };
    if (consistency) {
      return withConsistencyNote(base, consistency);
    }

    return base;
  }

  if (bodyWeight) {
    const base = {
      lead: `${formatBodyMetric(bodyWeight)} bodyweight is logged.`,
      body: `Now anchor it with training data. One clean session is enough for Reed to start comparing work against your goal of ${weekly}.`,
    };
    if (consistency) {
      return withConsistencyNote(base, consistency);
    }

    return base;
  }

  const base = {
    lead: `${primaryGoalLabel} is set.`,
    body: `Log bodyweight and one training session next. That gives Reed enough signal to turn this note into real coaching.`,
  };
  if (consistency) {
    return withConsistencyNote(base, consistency);
  }

  return base;
}

function withConsistencyNote(
  note: { body: string; lead: string },
  consistency: ProfileConsistencyResult,
) {
  return {
    lead: consistency.summaryLine,
    body: `${consistency.subline} ${note.body}`,
  };
}

function getProgressMetricValue(group: TrainingWindowGroup, metric: ProgressMetric) {
  if (metric === 'load') {
    return group.volume;
  }
  if (metric === 'reps') {
    return group.reps;
  }
  return group.setCount;
}

function formatMetricSummaryValue(metric: ProgressMetric, value: number) {
  if (metric === 'load') {
    return formatWeeklyVolume(value);
  }

  return formatWholeNumber(value);
}

function formatMetricLegendValue(metric: ProgressMetric, value: number) {
  if (metric === 'load') {
    return formatWeeklyVolume(value);
  }
  if (metric === 'reps') {
    return `${formatWholeNumber(value)} reps`;
  }
  return `${formatWholeNumber(value)} sets`;
}

function getActiveDayCount(activities: TrainingWindowSummary['recentActivities']) {
  const activeDays = new Set<string>();
  for (const activity of activities) {
    activeDays.add(formatDate(activity.loggedAt));
  }
  return activeDays.size;
}

function getNormalizedShareByGroup(groups: TrainingWindowGroup[], metric: ProgressMetric) {
  const shares = new Map<string, number>();
  const positive = groups
    .map(group => ({ group, value: getProgressMetricValue(group, metric) }))
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
  const needed = Math.max(0, 100 - ranked.reduce((sum, row) => sum + row.floor, 0));
  const byRemainder = [...ranked].sort(
    (left, right) => right.fraction - left.fraction || right.value - left.value || left.groupId.localeCompare(right.groupId),
  );

  for (let index = 0; index < needed; index += 1) {
    byRemainder[index % byRemainder.length].floor += 1;
  }

  for (const row of ranked) {
    shares.set(row.groupId, row.floor);
  }
  return shares;
}

function formatPeriodComparison(
  work: TrainingWindowSummary['work'],
  previousWork: TrainingWindowSummary['work'] | undefined,
  metric: ProgressMetric,
) {
  if (!previousWork) {
    return 'Comparison loads after the previous range is available.';
  }

  const currentValue = getWorkMetricValue(work, metric);
  const previousValue = getWorkMetricValue(previousWork, metric);
  const label = metric === 'load' ? 'load' : metric;
  if (previousValue <= 0 && currentValue > 0) {
    return `No ${label} in the previous range.`;
  }
  if (currentValue <= 0 && previousValue <= 0) {
    return `No ${label} in either range yet.`;
  }

  const change = Math.round(((currentValue - previousValue) / previousValue) * 100);
  if (change === 0) {
    return `${label[0].toUpperCase()}${label.slice(1)} is level with the previous range.`;
  }

  return `${change > 0 ? '+' : ''}${change}% ${label} vs previous range.`;
}

function getWorkMetricValue(work: TrainingWindowSummary['work'], metric: ProgressMetric) {
  if (metric === 'load') {
    return work.totalVolume;
  }
  if (metric === 'reps') {
    return work.totalReps;
  }
  return work.totalSets;
}

function formatWholeNumber(value: number) {
  return Math.round(value).toLocaleString('en');
}

function formatVolume(value: number) {
  return `${Math.round(value).toLocaleString('en')} kg`;
}

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { api } from '@/convex/_generated/api';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { buildCompleteOnboardingPayload } from '@/components/onboarding/step-review';
import type { OnboardingBaseStep } from '@/components/onboarding/types';
import { AnalyticsDonut } from '@/components/ui/analytics-donut';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { getGlassControlTokens, SCREEN_CONTENT_HORIZONTAL_MARGIN } from '@/components/ui/glass-material';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { createTiming, getTapScaleStyle, reedMotion, runReedLayoutAnimation } from '@/design/motion';
import { useBreakpoint } from '@/design/use-breakpoint';
import { useReedTheme } from '@/design/provider';
import { reedRadii, workoutSemanticPalette } from '@/design/system';
import { formatWeeklyVolume } from '@/domains/workout/weekly-muscle-stats';
import {
  getConsistencyCellFill,
  getConsistencyCellOpacity,
  getConsistencyGaugeSegmentFill,
  getConsistencyGaugeSegmentOpacity,
} from './profile/consistency-presenter';
import { draftFromTrainingProfile, SettingsSurface, type StoredTrainingProfile } from './settings-surface';

const goalLabels: Record<string, string> = {
  build_muscle: 'Build muscle',
  get_stronger: 'Get stronger',
  improve_conditioning: 'Improve conditioning',
  master_skill: 'Master a skill',
  move_without_pain: 'Move without pain',
  support_sport: 'Support sport',
};

const weeklySessionLabels: Record<string, string> = {
  four_plus: '4+ days/week',
  one_to_two: '1–2 days/week',
  two_to_four: '2–4 days/week',
};

const equipmentLabels: Record<string, string> = {
  calisthenics_park: 'park',
  crowded_gym: 'crowded gym',
  full_gym: 'gym',
  home_equipment: 'home',
  no_fixed_equipment: 'minimal equipment',
};

const constraintLabels: Record<string, string> = {
  heart: 'heart',
  hip: 'hip',
  knee: 'knee',
  lower_back: 'lower back',
  lungs: 'lungs',
  neck: 'neck',
  other: 'other',
  shoulder: 'shoulder',
  wrist_elbow: 'wrist/elbow',
};

const bodyMetricLabels: Record<string, string> = {
  body_fat_percent: 'Body fat',
  body_weight: 'Bodyweight',
  resting_heart_rate: 'Resting heart rate',
  skeletal_muscle_mass: 'Skeletal muscle',
};

const trainingAgeLabels: Record<string, string> = {
  over_18_months: '18+ months',
  six_to_18_months: '6-18 months',
  starting: 'Starting',
  under_6_months: 'Under 6 months',
};

const durationLabels: Record<string, string> = {
  fortyfive_to_75: '45-75 min',
  over_75: '75+ min',
  under_45: 'Under 45 min',
};

const effortLabels: Record<string, string> = {
  easy: 'Easy',
  hard: 'Hard',
  moderate: 'Moderate',
};

const recoveryLabels: Record<string, string> = {
  fragile: 'Fragile',
  mixed: 'Mixed',
  solid: 'Solid',
};

const trainingStyleLabels: Record<string, string> = {
  calisthenics: 'Calisthenics',
  cardio: 'Cardio',
  classic_gym: 'Classic gym',
  mobility_rehab: 'Mobility / rehab',
  sport_support: 'Sport support',
};

const anchorLabels: Record<string, string> = {
  bench_press: 'Bench',
  deadlift: 'Deadlift',
  dip: 'Dip',
  overhead_press: 'Overhead press',
  pull_up: 'Pull-up',
  push_up: 'Push-up',
  run_1km: '1K run',
  run_5km: '5K run',
  squat: 'Squat',
  stair_test: 'Stairs',
};

const goalDetailLabels: Record<string, string> = {
  bench: 'bench',
  deadlift: 'deadlift',
  overhead_press: 'overhead press',
  squat: 'squat',
  weighted_pull_up: 'weighted pull-up',
};
const consistencyWeekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

type ProfileDetailKind = 'body' | 'goal' | 'training';
type ProfilePeriod = '30d' | '90d' | 'week';
type BodyWeightPoint = {
  _id: string;
  observedAt: number;
  source: 'manual' | 'onboarding';
  unit: 'kg' | 'percent' | 'bpm';
  value: number;
};
type ProgressMetric = 'load' | 'reps' | 'sets';
type TrainingWindowGroup = {
  groupId: string;
  label: string;
  reps: number;
  setCount: number;
  volume: number;
};
type TrainingWindowSummary = {
  activityCount: number;
  byExercise: Array<{
    exerciseCatalogId: string;
    exerciseName: string;
    lastLoggedAt: number;
    setCount: number;
  }>;
  recentActivities: Array<{
    exerciseCatalogId: string;
    exerciseName: string;
    loggedAt: number;
    source: 'live_session' | 'quick_log';
    summary: string;
  }>;
  work: {
    groups: TrainingWindowGroup[];
    totalReps: number;
    totalSets: number;
    totalVolume: number;
  };
};
type RecordHighlightsResult = {
  highlights: Array<{
    displayValue: string;
    evidence: { loggedAt: number };
    exerciseCatalogId: string;
    exerciseName: string;
    kind: string;
    label: string;
    summary: string;
  }>;
};
type ProfileConsistencyResult = {
  currentOnTargetWeekRun: number;
  currentWeek: {
    activeDays: number;
    isOnTarget: boolean;
    remainingActiveDays: number;
    targetActiveDays: number;
    weekEndAt: number;
    weekStartAt: number;
  };
  weekGrid: Array<{
    days: Array<{
      activityCount: number;
      active: boolean;
      date: string;
      dayStartAt: number;
      isFuture: boolean;
      weekStartAt: number;
    }>;
    weekStartAt: number;
  }>;
  hasTrainingTarget: boolean;
  helperLine: string;
  recentOnTargetRate: {
    onTargetWeeks: number;
    percent: number;
    totalWeeks: number;
  };
  subline: string;
  summaryLine: string;
  target: {
    label: string;
    targetActiveDays: number;
  } | null;
};

type ProfileSurfaceProps = {
  displayName: string;
  onEditingProfileChange?: (isEditing: boolean) => void;
};

export function ProfileSurface({ displayName, onEditingProfileChange }: ProfileSurfaceProps) {
  const { theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);
  const viewerTrainingProfile = useQuery(api.profiles.viewerTrainingProfile, {});
  const bodyWeightTrend = useQuery(api.profiles.bodyWeightTrend, { rangeDays: 90 });
  const updateTrainingProfile = useMutation(api.profiles.updateTrainingProfile);
  const upsertTodayBodyWeight = useMutation(api.profiles.upsertTodayBodyWeight);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWeightSheetOpen, setIsWeightSheetOpen] = useState(false);
  const [activeDetail, setActiveDetail] = useState<ProfileDetailKind | null>(null);
  const [editStep, setEditStep] = useState<OnboardingBaseStep | null>(null);
  const [period, setPeriod] = useState<ProfilePeriod>('week');
  const [progressMetric, setProgressMetric] = useState<ProgressMetric>('sets');
  const periodRange = useMemo(() => getProfilePeriodRange(period), [period]);
  const progressSummary = useQuery(api.trainingKnowledge.summarizeWindow, {
    windowEndAt: periodRange.current.endAt,
    windowStartAt: periodRange.current.startAt,
  });
  const previousProgressSummary = useQuery(api.trainingKnowledge.summarizeWindow, {
    windowEndAt: periodRange.previous.endAt,
    windowStartAt: periodRange.previous.startAt,
  });
  const recordHighlights = useQuery(api.trainingKnowledge.getRecordHighlights, { limit: 3 });
  const consistency = useQuery(api.trainingKnowledge.getConsistency, {});
  const profileInsight = useQuery(api.profileInsight.getCurrent, {});
  const ensureProfileInsight = useMutation(api.profileInsight.ensureFresh);

  const trainingProfile = viewerTrainingProfile?.trainingProfile ?? null;
  const bodyWeight = viewerTrainingProfile?.latestBodyMetrics?.find((metric: { metricKey: string }) => metric.metricKey === 'body_weight') ?? null;
  const editDraft = useMemo(() => {
    if (!viewerTrainingProfile) {
      return null;
    }

    return draftFromTrainingProfile(viewerTrainingProfile as StoredTrainingProfile, displayName);
  }, [displayName, viewerTrainingProfile]);
  useEffect(() => {
    void ensureProfileInsight({ clientNow: Date.now() });
  }, [ensureProfileInsight]);

  const coachNote = useMemo(
    () => profileInsight?.content
      ? { lead: '', body: profileInsight.content }
      : formatCoachNote(trainingProfile, bodyWeight, progressSummary, consistency),
    [bodyWeight, consistency, profileInsight?.content, progressSummary, trainingProfile],
  );

  if (isSettingsOpen) {
    return (
      <View style={styles.fullscreenPanel}>
        <SettingsSurface onBack={() => setIsSettingsOpen(false)} onEditingProfileChange={onEditingProfileChange} />
      </View>
    );
  }

  if (editStep && editDraft) {
    return (
      <View style={styles.fullscreenPanel}>
        <OnboardingFlow
          backPlacement="header"
          cancelLabel="Close"
          includeConsent={false}
          initialDraft={editDraft}
          initialStep={editStep}
          onCancel={() => {
            setEditStep(null);
            onEditingProfileChange?.(false);
          }}
          onComplete={() => {
            setEditStep(null);
            onEditingProfileChange?.(false);
          }}
          onDecline={() => {
            setEditStep(null);
            onEditingProfileChange?.(false);
          }}
          onSaveProfile={async draft => {
            await updateTrainingProfile(buildCompleteOnboardingPayload(draft));
          }}
          reviewContinueLabel="Save changes"
        />
      </View>
    );
  }

  return (
    <>
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: 132,
          paddingHorizontal: SCREEN_CONTENT_HORIZONTAL_MARGIN,
          paddingTop: theme.spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <ScreenHeader
        variant="identity"
        action={{
          accessibilityLabel: 'Open settings',
          iconName: 'settings-outline',
          onPress: () => setIsSettingsOpen(true),
        }}
      >
        <ReedText variant="title">Profile</ReedText>
      </ScreenHeader>

      {viewerTrainingProfile === undefined ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={String(theme.colors.accentPrimary)} />
          <ReedText tone="muted">Loading profile.</ReedText>
        </View>
      ) : (
        <View style={styles.sectionStack}>
          <CoachNoteCard note={coachNote} />

          <ConsistencySurface consistency={consistency} />

          <BodyWeightSurface
            latestWeight={bodyWeight}
            onLogWeight={() => setIsWeightSheetOpen(true)}
            series={bodyWeightTrend}
          />

          <ProgressSurface
            metric={progressMetric}
            onChangeMetric={setProgressMetric}
            onChangePeriod={setPeriod}
            period={period}
            previousSummary={previousProgressSummary}
            range={periodRange.current}
            summary={progressSummary}
          />
          <BestEffortsSurface recordHighlights={recordHighlights} />

          <View style={styles.profileAccordion}>
            <ProfileAccordionItem
              activeDetail={activeDetail}
              detail="body"
              icon="body-outline"
              label="Body"
              onEdit={step => {
                setEditStep(step);
                onEditingProfileChange?.(true);
              }}
              onToggle={() => {
                runReedLayoutAnimation(reedMotion.durations.mode);
                setActiveDetail(activeDetail === 'body' ? null : 'body');
              }}
              primary={bodyWeight ? `${formatMetric(bodyWeight.value)} ${bodyWeight.unit}` : 'Add bodyweight'}
              profileData={viewerTrainingProfile}
              secondary={bodyWeight ? `Logged ${formatDate(bodyWeight.observedAt)}` : 'Log weight for better estimates.'}
            />
            <ProfileAccordionItem
              activeDetail={activeDetail}
              detail="goal"
              icon="flag-outline"
              label="Goals"
              onEdit={step => {
                setEditStep(step);
                onEditingProfileChange?.(true);
              }}
              onToggle={() => {
                runReedLayoutAnimation(reedMotion.durations.mode);
                setActiveDetail(activeDetail === 'goal' ? null : 'goal');
              }}
              primary={formatRankedGoalLine(trainingProfile?.rankedGoals ?? [])}
              profileData={viewerTrainingProfile}
              secondary={formatGoalFocusLine(trainingProfile)}
            />
            <ProfileAccordionItem
              activeDetail={activeDetail}
              detail="training"
              icon="finger-print-outline"
              label="Training setup"
              onEdit={step => {
                setEditStep(step);
                onEditingProfileChange?.(true);
              }}
              onToggle={() => {
                runReedLayoutAnimation(reedMotion.durations.mode);
                setActiveDetail(activeDetail === 'training' ? null : 'training');
              }}
              primary={formatTrainingReality(trainingProfile)}
              profileData={viewerTrainingProfile}
              secondary={formatConstraints(trainingProfile?.constraints.areas ?? [])}
            />
          </View>
        </View>
      )}
    </ScrollView>
    <BodyWeightLogSheet
      latestWeight={bodyWeight}
      onClose={() => setIsWeightSheetOpen(false)}
      onSave={async valueKg => {
        const now = Date.now();
        const bounds = getLocalDayBounds(now);
        await upsertTodayBodyWeight({
          dayEndAt: bounds.endAt,
          dayStartAt: bounds.startAt,
          observedAt: now,
          valueKg,
        });
      }}
      visible={isWeightSheetOpen}
    />
    </>
  );
}

function ProfileAccordionItem({
  activeDetail,
  detail,
  icon,
  label,
  onEdit,
  onToggle,
  primary,
  profileData,
  secondary,
}: {
  activeDetail: ProfileDetailKind | null;
  detail: ProfileDetailKind;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onEdit: (step: OnboardingBaseStep) => void;
  onToggle: () => void;
  primary: string;
  profileData: StoredTrainingProfile | null | undefined;
  secondary: string;
}) {
  const isOpen = activeDetail === detail;

  return (
    <View>
      <LivingFact
        icon={icon}
        isOpen={isOpen}
        label={label}
        onPress={onToggle}
        primary={primary}
        secondary={secondary}
      />
      {isOpen ? (
        <AccordionDetailReveal>
          <ProfileDetailSurface
            detail={detail}
            embedded
            onBack={onToggle}
            onEdit={onEdit}
            profileData={profileData}
          />
        </AccordionDetailReveal>
      ) : null}
    </View>
  );
}

function AccordionDetailReveal({ children }: { children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    createTiming(progress, 1, reedMotion.durations.mode, undefined, true).start();
  }, [progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [reedMotion.distances.expandContentY, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function CoachNoteCard({ note }: { note: { body: string; lead: string } }) {
  return (
    <GlassSurface contentStyle={styles.coachNoteContent} style={styles.coachNoteSurface}>
      <ReedText variant="body" style={styles.coachNoteBody}>
        {note.lead ? <ReedText variant="bodyStrong">{note.lead}</ReedText> : null}
        {note.lead ? ' ' : ''}
        {note.body}
      </ReedText>
      <ReedText tone="muted" variant="caption" style={styles.coachNoteSignoff}>
        Reed
      </ReedText>
    </GlassSurface>
  );
}

function ConsistencySurface({ consistency }: { consistency: ProfileConsistencyResult | undefined }) {
  const { theme } = useReedTheme();
  const [isHelperVisible, setIsHelperVisible] = useState(false);

  return (
    <GlassSurface contentStyle={styles.consistencyContent} style={styles.consistencySurface}>
      <View style={styles.consistencyHeader}>
        <StreakDesignShelf consistency={consistency} />
      </View>

      <View style={styles.consistencyGridHeader}>
        <ReedText tone="muted" variant="caption">Last 12 weeks</ReedText>
        <Pressable
          accessibilityLabel={isHelperVisible ? 'Hide consistency explanation' : 'Show consistency explanation'}
          onPress={() => setIsHelperVisible(value => !value)}
          style={({ pressed }) => [
            styles.infoButton,
            getTapScaleStyle(pressed),
          ]}
        >
          <Ionicons color={String(theme.colors.textMuted)} name="information-circle-outline" size={18} />
        </Pressable>
      </View>

      {consistency === undefined ? (
        <ConsistencySkeleton />
      ) : (
        <>
          <ConsistencyGrid weekGrid={consistency.weekGrid} />

          {isHelperVisible ? (
            <View style={[styles.consistencyHelper, { borderTopColor: theme.colors.controlBorder }]}>
              <ReedText tone="muted" variant="caption">{consistency.helperLine}</ReedText>
            </View>
          ) : null}
        </>
      )}
    </GlassSurface>
  );
}

function ConsistencySkeleton() {
  const { theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);

  return (
    <View style={styles.consistencySkeleton}>
      <View style={styles.consistencyGrid}>
        {consistencyWeekdayLabels.map((label, dayIndex) => (
          <View key={`${label}:${dayIndex}`} style={styles.consistencyGridRow}>
            <ReedText tone="muted" variant="caption" style={styles.consistencyDayLabel}>
              {label}
            </ReedText>
            {Array.from({ length: 12 }, (_, weekIndex) => (
              <View
                key={weekIndex}
                style={[
                  styles.consistencyCell,
                  {
                    backgroundColor: glassControls.shellBackgroundColor,
                    borderColor: glassControls.shellBorderColor,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function StreakDesignShelf({ consistency }: { consistency: ProfileConsistencyResult | undefined }) {
  const streakWeeks = consistency?.currentOnTargetWeekRun ?? 0;
  const isLoading = consistency === undefined;

  return (
    <View style={styles.streakDesignShelf}>
      <StreakRailDesign isLoading={isLoading} streakWeeks={streakWeeks} />
    </View>
  );
}

function StreakRailDesign({ isLoading, streakWeeks }: { isLoading: boolean; streakWeeks: number }) {
  const { theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);
  const filled = Math.min(streakWeeks, 8);

  return (
    <View style={styles.streakRailDesign}>
      <View style={styles.streakRailHeader}>
        <ReedText variant="bodyStrong">Consistency level</ReedText>
        <ReedText tone="muted" variant="label">{isLoading ? '-' : `${filled}/8 weeks`}</ReedText>
      </View>
      <View style={styles.streakRail}>
        {Array.from({ length: 8 }, (_, index) => (
          <View
            key={index}
            style={[
              styles.streakRailSegment,
              {
                backgroundColor: getConsistencyGaugeSegmentFill({
                  accentColor: String(theme.colors.accentPrimary),
                  filled,
                  index,
                  isLoading,
                  shellColor: String(glassControls.shellBackgroundColor),
                }),
                borderColor: !isLoading && index === filled - 1 ? theme.colors.accentPrimary : 'transparent',
                opacity: !isLoading && index < filled ? getConsistencyGaugeSegmentOpacity(index) : 0.72,
                transform: [{ scaleY: !isLoading && index === filled - 1 ? 1.15 : 1 }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function ConsistencyGrid({ weekGrid }: { weekGrid: ProfileConsistencyResult['weekGrid'] }) {
  const { theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);

  return (
    <View style={styles.consistencyGridWrap}>
      <View style={styles.consistencyGrid}>
        {consistencyWeekdayLabels.map((label, dayIndex) => (
          <View key={`${label}:${dayIndex}`} style={styles.consistencyGridRow}>
            <ReedText tone="muted" variant="caption" style={styles.consistencyDayLabel}>
              {label}
            </ReedText>
            {weekGrid.map(week => {
              const day = week.days[dayIndex];
              return (
                <View
                  key={`${week.weekStartAt}:${dayIndex}`}
                  accessibilityLabel={`${day.date}: ${day.activityCount} logged ${day.activityCount === 1 ? 'activity' : 'activities'}`}
                  style={[
                    styles.consistencyCell,
                    {
                      backgroundColor: getConsistencyCellFill({
                        active: day.active,
                        isFuture: day.isFuture,
                        activeFill: String(theme.colors.successText),
                        shellColor: String(glassControls.shellBackgroundColor),
                      }),
                      borderColor: day.active ? 'transparent' : glassControls.shellBorderColor,
                      opacity: getConsistencyCellOpacity({
                        active: day.active,
                        activityCount: day.activityCount,
                        isFuture: day.isFuture,
                      }),
                    },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function BodyWeightSurface({
  latestWeight,
  onLogWeight,
  series,
}: {
  latestWeight: { observedAt: number; unit?: string; value: number } | null;
  onLogWeight: () => void;
  series: BodyWeightPoint[] | undefined;
}) {
  const { theme } = useReedTheme();
  const trend = useMemo(() => summarizeBodyWeightTrend(series ?? []), [series]);
  const hasSeries = (series?.length ?? 0) >= 2;

  return (
    <GlassSurface contentStyle={styles.bodyWeightContent} style={styles.bodyWeightSurface}>
      <View style={styles.bodyWeightHeader}>
        <View style={styles.bodyWeightHeaderCopy}>
          <ReedText variant="section">Bodyweight</ReedText>
          <ReedText tone="muted" variant="caption">Trend signal, not a daily verdict.</ReedText>
        </View>
        <Pressable
          accessibilityLabel="Log bodyweight"
          onPress={onLogWeight}
          style={({ pressed }) => [
            styles.weightLogButton,
            { backgroundColor: theme.colors.accentPrimary },
            getTapScaleStyle(pressed),
          ]}
        >
          <Ionicons color={String(theme.colors.accentPrimaryText)} name="add" size={18} />
          <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="caption">Log</ReedText>
        </Pressable>
      </View>

      <View style={styles.bodyWeightReadoutRow}>
        <View style={styles.bodyWeightReadout}>
          <ReedText style={styles.bodyWeightValue} variant="display">
            {latestWeight ? formatMetric(latestWeight.value) : '—'}
          </ReedText>
          <ReedText tone="muted" variant="label">kg now</ReedText>
        </View>
        <View style={styles.bodyWeightTrendCopy}>
          <ReedText variant="bodyStrong">{trend.summary}</ReedText>
          <ReedText tone="muted" variant="caption">{latestWeight ? `Last logged ${formatDate(latestWeight.observedAt)}` : 'One quick log starts the trend.'}</ReedText>
        </View>
      </View>

      {series === undefined ? (
        <ProgressSkeleton />
      ) : hasSeries ? (
        <BodyWeightChart points={series} />
      ) : (
        <View style={[styles.bodyWeightEmptyChart, { borderColor: theme.colors.controlBorder }]}>
          <ReedText variant="bodyStrong">No trend yet</ReedText>
          <ReedText tone="muted" variant="caption">Log a few mornings. Reed will smooth the noise into a useful line.</ReedText>
        </View>
      )}
    </GlassSurface>
  );
}

function BodyWeightChart({ points }: { points: BodyWeightPoint[] }) {
  const { theme } = useReedTheme();
  const width = 320;
  const height = 136;
  const paddingX = 10;
  const paddingY = 22;
  const values = points.map(point => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = Math.max(1, maxValue - minValue);
  const startAt = points[0]?.observedAt ?? Date.now();
  const endAt = points[points.length - 1]?.observedAt ?? startAt;
  const timeSpan = Math.max(1, endAt - startAt);
  const coords = points.map(point => {
    const x = paddingX + ((point.observedAt - startAt) / timeSpan) * (width - paddingX * 2);
    const y = paddingY + (1 - ((point.value - minValue) / valueSpan)) * (height - paddingY * 2);
    return { ...point, x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const averageY = paddingY + (1 - ((average - minValue) / valueSpan)) * (height - paddingY * 2);
  const first = coords[0];
  const latest = coords[coords.length - 1];
  const peak = coords.reduce((best, point) => point.value > best.value ? point : best, coords[0]);
  const valueLabels = dedupeChartLabels([
    { label: `${formatMetric(peak.value)}kg`, x: peak.x, y: peak.y - 10 },
    { label: `${formatMetric(first.value)}kg`, x: first.x, y: height - 6 },
    { label: `${formatMetric(latest.value)}kg`, x: latest.x, y: height - 6, anchor: 'end' as const },
  ]);
  const averageLabel = { value: `${formatMetric(average)}kg`, label: 'avg', x: width - paddingX, y: Math.max(17, averageY - 7), anchor: 'end' as const };

  return (
    <View style={styles.bodyWeightChartWrap}>
      <Svg height={height} preserveAspectRatio="none" width="100%" viewBox={`0 0 ${width} ${height}`}>
        <Line
          stroke={String(theme.colors.controlBorder)}
          strokeDasharray="5 7"
          strokeWidth={1}
          x1={paddingX}
          x2={width - paddingX}
          y1={averageY}
          y2={averageY}
        />
        <Path d={path} fill="none" stroke={String(theme.colors.accentPrimary)} strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} />
        {coords.map((point, index) => (
          <Circle
            cx={point.x}
            cy={point.y}
            fill={String(index === coords.length - 1 ? theme.colors.accentPrimary : theme.colors.canvasSecondary)}
            key={point._id}
            r={index === coords.length - 1 ? 4.5 : 3}
            stroke={String(theme.colors.accentPrimary)}
            strokeWidth={1.5}
          />
        ))}
        <SvgText
          fill={String(theme.colors.textPrimary)}
          fontFamily="Outfit_800ExtraBold"
          fontSize={10}
          textAnchor={averageLabel.anchor}
          x={Math.min(width - paddingX, Math.max(paddingX, averageLabel.x))}
          y={Math.min(height - 12, Math.max(10, averageLabel.y))}
        >
          {averageLabel.value}
        </SvgText>
        <SvgText
          fill={String(theme.colors.textMuted)}
          fontFamily="Outfit_600SemiBold"
          fontSize={8}
          textAnchor={averageLabel.anchor}
          x={Math.min(width - paddingX, Math.max(paddingX, averageLabel.x))}
          y={Math.min(height - 3, Math.max(18, averageLabel.y + 9))}
        >
          {averageLabel.label}
        </SvgText>
        {valueLabels.map(item => (
          <SvgText
            fill={String(theme.colors.textMuted)}
            fontFamily="Outfit_600SemiBold"
            fontSize={9}
            key={`${item.label}-${item.x.toFixed(1)}-${item.y.toFixed(1)}`}
            textAnchor={item.anchor ?? 'start'}
            x={Math.min(width - paddingX, Math.max(paddingX, item.x))}
            y={Math.min(height - 4, Math.max(10, item.y))}
          >
            {item.label}
          </SvgText>
        ))}
      </Svg>
      <View style={styles.bodyWeightChartLabels}>
        <ReedText tone="muted" variant="caption">{formatDate(startAt)}</ReedText>
        <ReedText tone="muted" variant="caption">{formatDate(endAt)}</ReedText>
      </View>
    </View>
  );
}

function dedupeChartLabels(labels: Array<{ anchor?: 'start' | 'end'; label: string; x: number; y: number }>) {
  const kept: Array<{ anchor?: 'start' | 'end'; label: string; x: number; y: number }> = [];
  for (const label of labels) {
    const overlaps = kept.some(existing => Math.abs(existing.x - label.x) < 34 && Math.abs(existing.y - label.y) < 12);
    if (!overlaps) kept.push(label);
  }
  return kept;
}

function BodyWeightLogSheet({
  latestWeight,
  onClose,
  onSave,
  visible,
}: {
  latestWeight: { observedAt: number; value: number } | null;
  onClose: () => void;
  onSave: (valueKg: number) => Promise<void>;
  visible: boolean;
}) {
  const { theme } = useReedTheme();
  const { height } = useWindowDimensions();
  const [isMounted, setIsMounted] = useState(visible);
  const sheetProgress = useRef(new Animated.Value(0)).current;
  const [weightInput, setWeightInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const parsedWeight = parseOptionalNumber(weightInput);
  const canSave = parsedWeight !== null && parsedWeight >= 25 && parsedWeight <= 300 && !isSaving;
  const translateY = sheetProgress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
  const overlayOpacity = sheetProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      setWeightInput(latestWeight ? formatMetric(latestWeight.value) : '');
      setErrorMessage(null);
      sheetProgress.setValue(0);
      createTiming(sheetProgress, 1, reedMotion.durations.mode + 80).start();
      return;
    }

    if (!isMounted) return;
    createTiming(sheetProgress, 0, reedMotion.durations.mode).start(({ finished }) => {
      if (finished) setIsMounted(false);
    });
  }, [isMounted, latestWeight, sheetProgress, visible]);

  async function handleSave() {
    if (!canSave || parsedWeight === null) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSave(parsedWeight);
      onClose();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function requestClose() {
    createTiming(sheetProgress, 0, reedMotion.durations.mode).start(() => {
      setIsMounted(false);
      onClose();
    });
  }

  if (!isMounted) return null;

  return (
    <Modal animationType="none" onRequestClose={requestClose} transparent visible={isMounted}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetKeyboardView}>
        <Animated.View style={[styles.sheetOverlay, { backgroundColor: theme.colors.overlayScrim, opacity: overlayOpacity }]}>
          <Pressable accessibilityLabel="Close bodyweight logger" onPress={requestClose} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[styles.sheetDock, { transform: [{ translateY }] }]}>
          <GlassSurface contentStyle={styles.weightSheetContent} style={styles.weightSheetSurface}>
            <View style={[styles.weightSheetHandle, { backgroundColor: theme.colors.handleFill }]} />
            <View style={styles.weightSheetHeader}>
              <View style={styles.weightSheetTitleBlock}>
                <ReedText variant="title">Log weight</ReedText>
                <ReedText tone="muted" variant="caption">Today’s value replaces today’s manual log.</ReedText>
              </View>
              <Pressable accessibilityLabel="Close" onPress={requestClose} style={({ pressed }) => [styles.weightSheetClose, getTapScaleStyle(pressed)]}>
                <Ionicons color={String(theme.colors.textMuted)} name="close" size={20} />
              </Pressable>
            </View>
            <View style={styles.weightInputRow}>
              <ReedInput
                autoFocus
                keyboardType="decimal-pad"
                label="Weight"
                onChangeText={setWeightInput}
                placeholder="83.4"
                returnKeyType="done"
                style={styles.weightInput}
                value={weightInput}
              />
              <ReedText style={styles.weightUnitLabel} variant="section">kg</ReedText>
            </View>
            {latestWeight ? (
              <ReedText tone="muted" variant="caption">Last: {formatMetric(latestWeight.value)} kg · {formatDate(latestWeight.observedAt)}</ReedText>
            ) : null}
            {errorMessage ? <ReedText tone="danger" variant="caption">{errorMessage}</ReedText> : null}
            <ReedButton disabled={!canSave} label={isSaving ? 'Saving…' : 'Save'} onPress={handleSave} variant="primary" />
          </GlassSurface>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ProgressSurface({
  metric,
  onChangeMetric,
  onChangePeriod,
  period,
  previousSummary,
  range,
  summary,
}: {
  metric: ProgressMetric;
  onChangeMetric: (metric: ProgressMetric) => void;
  onChangePeriod: (period: ProfilePeriod) => void;
  period: ProfilePeriod;
  previousSummary: TrainingWindowSummary | undefined;
  range: { endAt: number; startAt: number };
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
  const chartSegments = groups.map(group => ({
    color: getCoarseMuscleGroupColor(group.groupId),
    id: group.groupId,
    percent: shareByGroup.get(group.groupId) ?? 0,
  }));
  return (
    <GlassSurface contentStyle={styles.progressContent} style={styles.progressSurface}>
      <View style={styles.progressHeader}>
        <View style={styles.progressHeaderCopy}>
          <ReedText variant="section">Training</ReedText>
          <ReedText tone="muted" variant="caption">{formatPeriodRangeLabel(period, range)}</ReedText>
        </View>
        <PeriodControl onChange={onChangePeriod} value={period} />
      </View>

      {summary === undefined ? (
        <ProgressSkeleton />
      ) : !work || summary.activityCount === 0 ? (
        <View style={styles.emptyProgress}>
          <ReedText variant="bodyStrong">No training here yet</ReedText>
          <ReedText tone="muted" variant="caption">Start a session or quick log a set. This area will turn into your progress view.</ReedText>
        </View>
      ) : (
        <>
          <View style={[styles.progressMetricRow, isCompact && styles.progressMetricRowCompact]}>
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
            variant="pill"
          />

          <View style={[styles.trainingVisualRow, isCompact && styles.trainingVisualRowCompact]}>
            <AnalyticsDonut
              centerPrimary={formatMetricSummaryValue(metric, totalMetric)}
              centerPrimaryStyle={styles.progressDonutValue}
              centerSecondary={metric === 'load' ? 'load' : metric}
              centerSecondaryStyle={styles.progressDonutSubtitle}
              containerStyle={styles.progressDonutContainer}
              segments={chartSegments}
              size={132}
              strokeWidth={16}
              wrapStyle={styles.progressDonutWrap}
            />

            <View style={styles.muscleLegend}>
              {groups.slice(0, 5).map(group => (
                <View key={group.groupId} style={styles.muscleLegendRow}>
                  <View style={[styles.legendDot, { backgroundColor: getCoarseMuscleGroupColor(group.groupId) }]} />
                  <ReedText style={styles.legendLabel} variant="caption">{group.label}</ReedText>
                  <ReedText tone="muted" variant="caption">{formatMetricLegendValue(metric, getProgressMetricValue(group, metric))}</ReedText>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.periodNote, { borderTopColor: theme.colors.controlBorder }]}>
            <ReedText tone="muted" variant="caption">{formatPeriodComparison(work, previousWork, metric)}</ReedText>
          </View>

          {summary.byExercise.length > 0 ? (
            <View style={styles.topExerciseStack}>
              <ReedText tone="muted" variant="label">Top exercises</ReedText>
              {summary.byExercise.slice(0, 3).map(exercise => (
                <View key={exercise.exerciseCatalogId} style={styles.topExerciseRow}>
                  <ReedText variant="caption" style={styles.topExerciseName} numberOfLines={1}>{exercise.exerciseName}</ReedText>
                  <ReedText tone="muted" variant="caption">{exercise.setCount} sets</ReedText>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </GlassSurface>
  );
}

function BestEffortsSurface({
  recordHighlights,
}: {
  recordHighlights: RecordHighlightsResult | undefined;
}) {
  const { theme } = useReedTheme();

  return (
    <GlassSurface contentStyle={styles.bestEffortsContent} style={styles.bestEffortsSurface}>
      <View style={styles.bestEffortsHeader}>
        <View>
          <ReedText variant="section">Personal Records</ReedText>
          <ReedText tone="muted" variant="caption">Your strongest logged sets.</ReedText>
        </View>
        <Ionicons color={String(theme.colors.textMuted)} name="trophy-outline" size={20} />
      </View>

      {recordHighlights === undefined ? (
        <View style={styles.loadingRowInline}>
          <ActivityIndicator color={String(theme.colors.accentPrimary)} size="small" />
          <ReedText tone="muted" variant="caption">Loading best efforts.</ReedText>
        </View>
      ) : recordHighlights.highlights.length === 0 ? (
        <View style={styles.emptyProgress}>
          <ReedText variant="bodyStrong">No best efforts yet</ReedText>
          <ReedText tone="muted" variant="caption">Log a few comparable sets and your strongest efforts will appear here.</ReedText>
        </View>
      ) : (
        <View style={styles.bestEffortList}>
          {recordHighlights.highlights.slice(0, 4).map(record => (
            <View key={`${record.exerciseCatalogId}:${record.kind}`} style={[styles.bestEffortRow, { borderTopColor: theme.colors.controlBorder }]}>
              <View style={styles.recordCopy}>
                <ReedText variant="bodyStrong" numberOfLines={1}>{record.exerciseName}</ReedText>
                <ReedText tone="muted" variant="caption">{record.label} · {record.summary}</ReedText>
              </View>
              <View style={styles.recordValue}>
                <ReedText variant="bodyStrong">{record.displayValue}</ReedText>
                <ReedText tone="muted" variant="caption">{formatDate(record.evidence.loggedAt)}</ReedText>
              </View>
            </View>
          ))}
        </View>
      )}
    </GlassSurface>
  );
}

function PeriodControl({ onChange, value }: { onChange: (period: ProfilePeriod) => void; value: ProfilePeriod }) {
  return (
    <SegmentedControl<ProfilePeriod>
      compact
      onChange={onChange}
      options={[
        { label: 'Week', value: 'week' },
        { label: '30D', value: '30d' },
        { label: '90D', value: '90d' },
      ]}
      style={styles.periodControl}
      value={value}
      variant="pill"
    />
  );
}

function ProgressSkeleton() {
  const { theme } = useReedTheme();
  const { isCompact } = useBreakpoint();
  const glassControls = getGlassControlTokens(theme);

  return (
    <View style={styles.progressSkeleton}>
      <View style={[styles.skeletonLine, { backgroundColor: glassControls.shellBackgroundColor }]} />
      <View style={[styles.progressMetricRow, isCompact && styles.progressMetricRowCompact]}>
        {[0, 1, 2].map(index => (
          <View key={index} style={[styles.skeletonMetric, { backgroundColor: glassControls.shellBackgroundColor }]} />
        ))}
      </View>
    </View>
  );
}

function ProgressMetricTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.progressMetricTile}>
      <ReedText variant="bodyStrong" style={styles.progressMetricText}>{value}</ReedText>
      <ReedText tone="muted" variant="label" style={styles.progressMetricText}>{label}</ReedText>
    </View>
  );
}

function ProfileDetailSurface({
  detail,
  embedded = false,
  onBack,
  onEdit,
  profileData,
}: {
  detail: ProfileDetailKind;
  embedded?: boolean;
  onBack: () => void;
  onEdit: (step: OnboardingBaseStep) => void;
  profileData: StoredTrainingProfile | null | undefined;
}) {
  const { theme } = useReedTheme();

  if (!profileData) {
    return (
      <GlassSurface contentStyle={styles.detailContent} style={styles.detailSurface}>
        {embedded ? null : <DetailHeader onBack={onBack} title="Profile" />}
        <ReedText tone="muted">Finish your profile to see this.</ReedText>
      </GlassSurface>
    );
  }

  if (detail === 'body') {
    const bodyMetrics = new Map(profileData.latestBodyMetrics.map(metric => [metric.metricKey, metric]));
    const baseline = profileData.trainingProfile.baseline;
    const missing = ['body_fat_percent', 'skeletal_muscle_mass', 'resting_heart_rate']
      .filter(key => !bodyMetrics.has(key))
      .map(key => bodyMetricLabels[key]);

    return (
      <GlassSurface contentStyle={styles.detailContent} style={styles.detailSurface}>
        {embedded ? null : <DetailHeader onBack={onBack} title="Body" />}
        <View style={styles.detailLead}>
          <ReedText variant="section">{formatBodyStatusLead(bodyMetrics)}</ReedText>
          <ReedText tone="muted" variant="caption">
            Weight changes bodyweight exercises and load estimates.
          </ReedText>
        </View>
        <View style={styles.factGrid}>
          <FactTile label="Height" value={`${formatMetric(baseline.heightCm)} cm`} />
          <FactTile label="Recovery" value={recoveryLabels[baseline.recoveryQuality] ?? baseline.recoveryQuality} />
          <FactTile label="Body fat" value={formatBodyMetric(bodyMetrics.get('body_fat_percent'))} />
          <FactTile label="Muscle" value={formatBodyMetric(bodyMetrics.get('skeletal_muscle_mass'))} />
          <FactTile label="Resting HR" value={formatBodyMetric(bodyMetrics.get('resting_heart_rate'))} />
          <FactTile label="Age basis" value={formatBirthYear(baseline.birthYear)} />
        </View>
        <PlainHint
          icon="pulse-outline"
          title={missing.length > 0 ? 'Useful to add' : 'Body data added'}
          body={missing.length > 0 ? missing.join(' · ') : 'Weight, composition, and recovery are recorded.'}
        />
        <ReedButton label="Log body data" onPress={() => onEdit('baseline')} variant="secondary" />
      </GlassSurface>
    );
  }

  if (detail === 'goal') {
    const goals = profileData.trainingProfile.rankedGoals;
    const primary = goals[0];
    const primaryDetail = primary ? profileData.trainingProfile.goalDetails[primary] : null;

    return (
      <GlassSurface contentStyle={styles.detailContent} style={styles.detailSurface}>
        {embedded ? null : <DetailHeader onBack={onBack} title="Goals" />}
        <View style={styles.detailLead}>
          <ReedText variant="section">{formatRankedGoalLine(goals)}</ReedText>
          <ReedText tone="muted" variant="caption">
            The first goal wins when training has to be simplified.
          </ReedText>
        </View>
        <View style={styles.rankStack}>
          {goals.length === 0 ? (
            <ReedText tone="muted">Set one to three goals so Reed has a direction.</ReedText>
          ) : goals.map((goal, index) => (
            <View key={goal} style={[styles.rankRow, { borderTopColor: index === 0 ? 'transparent' : theme.colors.controlBorder }]}>
              <ReedText tone="muted" variant="label">{String(index + 1).padStart(2, '0')}</ReedText>
              <View style={styles.rankCopy}>
                <ReedText variant="bodyStrong">{goalLabels[goal] ?? goal}</ReedText>
                <ReedText tone="muted" variant="caption">{formatGoalDetail(profileData.trainingProfile.goalDetails[goal])}</ReedText>
              </View>
            </View>
          ))}
        </View>
        <PlainHint
          icon="flag-outline"
          title={primaryDetail?.focusAreas?.length ? 'Direction' : 'Add direction'}
          body={primaryDetail?.focusAreas?.length ? primaryDetail.focusAreas.map(formatGoalToken).join(' · ') : 'Pick long-term lifts, skills, or conditioning work.'}
        />
        <ReedButton
          label="Open goals"
          onPress={() => router.push('/(app)/goals')}
          variant="secondary"
        />
        {profileData.trainingProfile.userNotes ? (
          <View style={[styles.notesBlock, { borderColor: theme.colors.controlBorder }]}>
            <ReedText tone="muted" variant="label">Notes</ReedText>
            <ReedText variant="caption">{profileData.trainingProfile.userNotes}</ReedText>
          </View>
        ) : null}
        <ReedButton label="Change goals" onPress={() => onEdit('priorities')} variant="secondary" />
      </GlassSurface>
    );
  }

  const reality = profileData.trainingProfile.trainingReality;
  const constraints = profileData.trainingProfile.constraints;

  return (
    <GlassSurface contentStyle={styles.detailContent} style={styles.detailSurface}>
      {embedded ? null : <DetailHeader onBack={onBack} title="Training setup" />}
      <View style={styles.detailLead}>
        <ReedText variant="section">{formatTrainingReality(profileData.trainingProfile)}</ReedText>
        <ReedText tone="muted" variant="caption">
          Schedule, equipment, and limits shape what workouts should look like.
        </ReedText>
      </View>
      <View style={styles.factGrid}>
        <FactTile label="Experience" value={trainingAgeLabels[reality.trainingAge] ?? reality.trainingAge} />
        <FactTile label="Session length" value={durationLabels[reality.sessionDuration] ?? reality.sessionDuration} />
        <FactTile label="Effort" value={effortLabels[reality.effort] ?? reality.effort} />
        <FactTile label="Styles" value={formatList(reality.trainingStyles.map(formatTrainingStyle), 2)} />
      </View>
      <View style={styles.detailList}>
        <DetailLine label="Equipment" value={formatList(reality.equipmentAccess.map(formatEquipment), 4)} />
        <DetailLine label="Constraints" value={formatConstraintDetails(constraints)} />
        <DetailLine label="Strength anchors" value={formatStrengthAnchors(profileData.latestStrengthBenchmarks)} />
        <DetailLine label="Cardio anchors" value={formatCardioAnchors(profileData.latestCardioBenchmarks)} />
      </View>
      <PlainHint
        icon="finger-print-outline"
        title="Keep this current"
        body="Update this when your schedule, equipment, or constraints change."
      />
      <View style={styles.actionRow}>
        <View style={styles.actionButton}>
          <ReedButton label="Change setup" onPress={() => onEdit('training-reality')} variant="secondary" />
        </View>
        <View style={styles.actionButton}>
          <ReedButton label="Change tests" onPress={() => onEdit('performance-anchors')} variant="ghost" />
        </View>
      </View>
    </GlassSurface>
  );
}

function DetailHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <ScreenHeader
      backAccessibilityLabel="Back to profile"
      onBack={onBack}
      title={title}
      variant="detail"
    />
  );
}

function FactTile({ label, value }: { label: string; value: string }) {
  const { theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);

  return (
    <View
      style={[
        styles.factTile,
        {
          backgroundColor: glassControls.shellBackgroundColor,
          borderColor: theme.colors.controlBorder,
        },
      ]}
    >
      <ReedText tone="muted" variant="label">{label}</ReedText>
      <ReedText variant="bodyStrong" numberOfLines={1}>{value}</ReedText>
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  const { theme } = useReedTheme();

  return (
    <View style={[styles.detailLine, { borderTopColor: theme.colors.controlBorder }]}>
      <ReedText tone="muted" variant="label">{label}</ReedText>
      <ReedText variant="caption" style={styles.detailLineValue}>{value}</ReedText>
    </View>
  );
}

function PlainHint({ body, icon, title }: { body: string; icon: keyof typeof Ionicons.glyphMap; title: string }) {
  const { theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);

  return (
    <View
      style={[
        styles.insightStrip,
        {
          backgroundColor: glassControls.shellBackgroundColor,
          borderColor: glassControls.shellBorderColor,
        },
      ]}
    >
      <Ionicons color={String(theme.colors.textMuted)} name={icon} size={18} />
      <View style={styles.insightCopy}>
        <ReedText variant="caption">{title}</ReedText>
        <ReedText tone="muted" variant="caption">{body}</ReedText>
      </View>
    </View>
  );
}

function LivingFact({
  icon,
  isOpen,
  label,
  onPress,
  primary,
  secondary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  isOpen?: boolean;
  label: string;
  onPress: () => void;
  primary: string;
  secondary: string;
}) {
  const { theme } = useReedTheme();

  return (
    <Pressable
      accessibilityLabel={`Open ${label.toLowerCase()} details`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.livingFact,
        { borderBottomColor: theme.colors.controlBorder },
        getTapScaleStyle(pressed),
      ]}
    >
      <View style={styles.rowIconWrap}>
        <Ionicons color={String(theme.colors.textMuted)} name={icon} size={18} />
      </View>
      <View style={styles.rowCopy}>
        <ReedText tone="muted" variant="label">{label}</ReedText>
        <ReedText variant="bodyStrong">{primary}</ReedText>
        <ReedText tone="muted" variant="caption">{secondary}</ReedText>
      </View>
      <View style={styles.updateHint}>
        <Ionicons
          color={String(theme.colors.textMuted)}
          name="chevron-forward"
          size={14}
          style={isOpen ? styles.updateHintOpen : null}
        />
      </View>
    </Pressable>
  );
}

function getCurrentWeekBounds() {
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const daysSinceMonday = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return {
    endAt: weekEnd.getTime(),
    startAt: weekStart.getTime(),
  };
}

function getLocalDayBounds(timestamp: number) {
  const start = new Date(timestamp);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { endAt: end.getTime(), startAt: start.getTime() };
}

function summarizeBodyWeightTrend(points: BodyWeightPoint[]) {
  const sorted = [...points].sort((left, right) => left.observedAt - right.observedAt);
  if (sorted.length < 2) {
    return { deltaKg: null, summary: 'Needs a few logs' };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const medianGapDays = getMedianBodyLogGapDays(sorted);
  const latestAgeDays = Math.floor((Date.now() - last.observedAt) / (24 * 60 * 60 * 1000));

  if (latestAgeDays >= 21) {
    return { deltaKg: null, summary: `Last logged ${formatDate(last.observedAt)}` };
  }

  if (sorted.length >= 6 && medianGapDays <= 3) {
    return summarizeBodyAverageShift(sorted, 3);
  }

  if (sorted.length >= 4 && medianGapDays <= 8) {
    return summarizeBodyAverageShift(sorted, 2);
  }

  const deltaKg = roundDisplay(last.value - first.value);
  if (sorted.length === 2) {
    return { deltaKg, summary: `${formatBodyDelta(deltaKg)} since ${formatDate(first.observedAt)}` };
  }

  return { deltaKg, summary: `${formatBodyDelta(deltaKg)} since ${formatDate(first.observedAt)}` };
}

function summarizeBodyAverageShift(points: BodyWeightPoint[], windowSize: number) {
  const recent = points.slice(-windowSize);
  const prior = points.slice(-windowSize * 2, -windowSize);
  const deltaKg = roundDisplay(averageBodyWeight(recent) - averageBodyWeight(prior));
  if (Math.abs(deltaKg) < 0.2) {
    return { deltaKg, summary: 'Holding steady' };
  }
  return { deltaKg, summary: `${formatBodyDelta(deltaKg)} recently` };
}

function getMedianBodyLogGapDays(points: BodyWeightPoint[]) {
  const gaps = points
    .slice(1)
    .map((point, index) => (point.observedAt - points[index].observedAt) / (24 * 60 * 60 * 1000))
    .sort((left, right) => left - right);
  return gaps[Math.floor(gaps.length / 2)] ?? Number.POSITIVE_INFINITY;
}

function averageBodyWeight(points: BodyWeightPoint[]) {
  return points.reduce((sum, point) => sum + point.value, 0) / Math.max(1, points.length);
}

function formatBodyDelta(deltaKg: number) {
  if (Math.abs(deltaKg) < 0.2) return 'stable';
  return `${deltaKg > 0 ? '+' : ''}${formatMetric(deltaKg)} kg`;
}

function formatBodyTrendWindow(startAt: number, endAt: number) {
  const daySpan = Math.max(0, Math.round((endAt - startAt) / (24 * 60 * 60 * 1000)));
  if (daySpan === 0) {
    return 'today';
  }
  if (daySpan === 1) {
    return 'since yesterday';
  }
  if (daySpan < 14) {
    return `over ${daySpan} days`;
  }
  const weekSpan = Math.round(daySpan / 7);
  if (weekSpan < 8) {
    return `over ${weekSpan} weeks`;
  }
  return `over ${daySpan} days`;
}

function roundDisplay(value: number) {
  return Math.round(value * 10) / 10;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Could not save. Try again.';
}

function getProfilePeriodRange(period: ProfilePeriod) {
  const now = Date.now();
  if (period === 'week') {
    const current = getCurrentWeekBounds();
    const duration = current.endAt - current.startAt;
    return {
      current,
      previous: {
        endAt: current.startAt,
        startAt: current.startAt - duration,
      },
    };
  }

  const days = period === '30d' ? 30 : 90;
  const duration = days * 24 * 60 * 60 * 1000;
  return {
    current: {
      endAt: now,
      startAt: now - duration,
    },
    previous: {
      endAt: now - duration,
      startAt: now - duration * 2,
    },
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

function formatPeriodRangeLabel(period: ProfilePeriod, range: { endAt: number; startAt: number }) {
  if (period === 'week') {
    return formatWeekRange(range.startAt, range.endAt);
  }

  return period === '30d' ? 'Last 30 days' : 'Last 90 days';
}

function formatRankedGoalLine(goals: string[]) {
  if (goals.length === 0) {
    return 'Set goals';
  }

  return goals.slice(0, 3).map((goal, index) => `${index + 1}. ${goalLabels[goal] ?? goal}`).join(' · ');
}

function formatGoalStack(goals: string[]) {
  if (goals.length === 0) {
    return 'Set goals';
  }

  const [primary, ...secondary] = goals;
  const primaryLabel = primary ? goalLabels[primary] ?? primary : 'Training';
  if (secondary.length === 0) {
    return `${primaryLabel} first`;
  }

  return `${primaryLabel} first · ${secondary.slice(0, 2).map(goal => goalLabels[goal] ?? goal).join(' · ')}`;
}

function formatGoalFocusLine(trainingProfile: { goalDetails: Record<string, { customDetail?: string | null; detail?: string | null; focusAreas?: string[] }>; rankedGoals: string[] } | null) {
  if (!trainingProfile || trainingProfile.rankedGoals.length === 0) {
    return 'Pick what matters most.';
  }

  const details = trainingProfile.rankedGoals
    .flatMap(goal => {
      const detail = trainingProfile.goalDetails[goal];
      if (!detail) return [];
      const raw = [
        detail.detail === 'other' ? detail.customDetail : detail.detail,
        ...(detail.focusAreas ?? []),
      ].filter(Boolean);
      return raw.map(value => formatGoalToken(String(value)));
    });
  const unique = Array.from(new Set(details));
  return unique.length ? unique.slice(0, 4).join(' · ') : 'Add target lifts, skills, or conditioning work.';
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

  const primaryGoal = trainingProfile.rankedGoals[0];
  const primaryGoalLabel = primaryGoal ? goalLabels[primaryGoal] ?? primaryGoal : 'Training';
  const weekly = weeklySessionLabels[trainingProfile.trainingReality.weeklySessions] ?? 'your current rhythm';

  if (summary === undefined) {
    const base = {
      lead: `${primaryGoalLabel} is the priority.`,
      body: `I am checking this week's training against your ${weekly.toLowerCase()} setup before calling the next move.`,
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
      body: `Now anchor it with training data. One clean session is enough for Reed to start comparing work against your ${weekly.toLowerCase()} target.`,
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

function formatMetric(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatBodyMetric(metric: { unit?: string; value: number } | undefined) {
  if (!metric) {
    return 'Not set';
  }

  const unit = metric.unit === 'percent' ? '%' : metric.unit ?? '';
  return `${formatMetric(metric.value)}${unit === '%' ? unit : unit ? ` ${unit}` : ''}`;
}

function formatBodyStatusLead(metrics: Map<string, { unit?: string; value: number }>) {
  const weight = metrics.get('body_weight');
  if (!weight) {
    return 'No bodyweight yet';
  }

  return `${formatBodyMetric(weight)} bodyweight`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(new Date(timestamp));
}

function formatBirthYear(year: number) {
  return `Born ${year}`;
}

function formatGoalDetail(detail: { customDetail?: string | null; detail?: string | null; focusAreas?: string[] } | null | undefined) {
  if (!detail) {
    return 'No specific detail yet.';
  }

  const parts = [
    detail.detail === 'other' ? detail.customDetail : detail.detail ? formatGoalToken(detail.detail) : null,
    ...(detail.focusAreas ?? []).slice(0, 3).map(formatGoalToken),
  ].filter(Boolean);

  const uniqueParts = Array.from(new Set(parts));
  return uniqueParts.length ? uniqueParts.join(' · ') : 'No specific detail yet.';
}

function formatGoalToken(value: string) {
  return goalDetailLabels[value] ?? value.replaceAll('_', ' ');
}

function formatTrainingStyle(value: string) {
  return trainingStyleLabels[value] ?? value.replaceAll('_', ' ');
}

function formatEquipment(value: string) {
  return equipmentLabels[value] ?? value.replaceAll('_', ' ');
}

function formatList(values: string[], limit: number) {
  if (values.length === 0) {
    return 'Not set';
  }

  const visible = values.slice(0, limit);
  const suffix = values.length > limit ? ` +${values.length - limit}` : '';
  return `${visible.join(' · ')}${suffix}`;
}

function formatConstraintDetails(constraints: {
  areas: string[];
  details: Record<string, { customDetail?: string | null; severity?: string | null; timing?: string | null }>;
}) {
  if (constraints.areas.length === 0) {
    return 'No constraints recorded';
  }

  return constraints.areas.slice(0, 3).map(area => {
    const detail = constraints.details[area];
    const severity = detail?.severity ? `/${detail.severity}` : '';
    return `${constraintLabels[area] ?? area}${severity}`;
  }).join(' · ');
}

function formatStrengthAnchors(anchors: Array<{ anchorKey: string; loadKg?: number | null; reps: number }>) {
  if (anchors.length === 0) {
    return 'No anchors recorded';
  }

  return anchors.slice(0, 3).map(anchor => {
    const label = anchorLabels[anchor.anchorKey] ?? anchor.anchorKey;
    return anchor.loadKg == null ? `${label} ${anchor.reps}` : `${label} ${formatMetric(anchor.loadKg)} kg x ${anchor.reps}`;
  }).join(' · ');
}

function formatCardioAnchors(anchors: Array<{ anchorKey: string; distanceMeters?: number | null; durationSeconds?: number | null; floors?: number | null }>) {
  if (anchors.length === 0) {
    return 'No anchors recorded';
  }

  return anchors.slice(0, 3).map(anchor => {
    const label = anchorLabels[anchor.anchorKey] ?? anchor.anchorKey;
    if (anchor.floors != null) {
      return `${label} ${anchor.floors} floors`;
    }
    if (anchor.durationSeconds != null) {
      return `${label} ${formatDuration(anchor.durationSeconds)}`;
    }
    return label;
  }).join(' · ');
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatTrainingReality(trainingProfile: { trainingReality: { equipmentAccess: string[]; weeklySessions: string } } | null) {
  if (!trainingProfile) {
    return 'Not set yet';
  }

  const weekly = weeklySessionLabels[trainingProfile.trainingReality.weeklySessions] ?? 'Training rhythm set';
  const equipment = trainingProfile.trainingReality.equipmentAccess
    .slice(0, 2)
    .map(item => equipmentLabels[item] ?? item)
    .join(' + ');
  return equipment ? `${weekly} · ${equipment}` : weekly;
}

function formatConstraints(areas: string[]) {
  if (areas.length === 0) {
    return 'No constraints recorded.';
  }

  return areas.slice(0, 3).map(area => constraintLabels[area] ?? area).join(' · ');
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

const styles = StyleSheet.create({
  content: {
    gap: 28,
  },
  fullscreenPanel: {
    flex: 1,
  },
  actionButton: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bodyWeightChartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  bodyWeightChartWrap: {
    gap: 4,
  },
  bodyWeightContent: {
    gap: 16,
    padding: 20,
  },
  bodyWeightEmptyChart: {
    borderRadius: reedRadii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    minHeight: 120,
    justifyContent: 'center',
    padding: 14,
  },
  bodyWeightHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  bodyWeightHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  bodyWeightReadout: {
    minWidth: 112,
  },
  bodyWeightReadoutRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 18,
  },
  bodyWeightSurface: {
    marginTop: 8,
  },
  bodyWeightTrendCopy: {
    flex: 1,
    gap: 3,
    paddingBottom: 7,
  },
  bodyWeightValue: {
    letterSpacing: -1.4,
  },
  bestEffortList: {
    gap: 0,
  },
  bestEffortRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  bestEffortsContent: {
    gap: 14,
  },
  bestEffortsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bestEffortsSurface: {
    marginTop: 10,
  },
  coachNoteBody: {
    flexShrink: 1,
  },
  coachNoteContent: {
    gap: 12,
    padding: 18,
  },
  coachNoteSignoff: {
    alignSelf: 'flex-end',
  },
  coachNoteSurface: {
    marginBottom: 4,
  },
  consistencyCell: {
    aspectRatio: 1,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
  },
  consistencyContent: {
    gap: 16,
    padding: 20,
  },
  consistencyDayLabel: {
    height: 16,
    width: 16,
    lineHeight: 16,
    textAlign: 'right',
  },
  consistencyGrid: {
    flex: 1,
    gap: 5,
  },
  consistencyGridHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  consistencyGridWrap: {
    flexDirection: 'row',
    width: '100%',
  },
  consistencyHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
  },
  consistencyHelper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  consistencySkeleton: {
    gap: 14,
  },
  consistencySurface: {
    marginBottom: 4,
  },
  consistencyGridRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  detailContent: {
    gap: 16,
  },
  detailLead: {
    gap: 6,
  },
  detailLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingVertical: 12,
  },
  detailLineValue: {
    flexShrink: 1,
  },
  detailList: {
    gap: 0,
  },
  detailSurface: {
    marginTop: 12,
  },
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  factTile: {
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
    minHeight: 72,
    padding: 12,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 80,
  },
  loadingRowInline: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 42,
  },
  identityStatement: {
    gap: 8,
    marginBottom: 8,
    paddingTop: 6,
  },
  infoButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  emptyProgress: {
    gap: 5,
    minHeight: 96,
    justifyContent: 'center',
  },
  insightCopy: {
    flex: 1,
    gap: 2,
  },
  insightStrip: {
    alignItems: 'flex-start',
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  livingFact: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    minHeight: 88,
    paddingVertical: 16,
  },
  recordCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  recordValue: {
    alignItems: 'flex-end',
    gap: 2,
  },
  notesBlock: {
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  profileAccordion: {
    marginTop: 10,
  },
  legendDot: {
    borderRadius: reedRadii.pill,
    height: 8,
    width: 8,
  },
  legendLabel: {
    flex: 1,
  },
  muscleLegend: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  muscleLegendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  periodNote: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  periodControl: {
    minWidth: 316,
    width: '100%',
  },
  progressContent: {
    gap: 16,
  },
  progressDonutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDonutSubtitle: {
    textTransform: 'uppercase',
  },
  progressDonutValue: {
    textAlign: 'center',
  },
  progressDonutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressHeader: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 12,
    justifyContent: 'space-between',
  },
  progressHeaderCopy: {
    alignSelf: 'stretch',
    gap: 2,
    minWidth: 0,
  },
  progressMetricRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressMetricTile: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
  },
  progressMetricText: {
    textAlign: 'center',
  },
  progressSkeleton: {
    gap: 14,
  },
  progressSurface: {
    marginTop: 12,
  },
  rankCopy: {
    flex: 1,
    gap: 2,
  },
  rankRow: {
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  rankStack: {
    gap: 0,
  },
  skeletonLine: {
    borderRadius: reedRadii.pill,
    height: 42,
  },
  skeletonMetric: {
    borderRadius: reedRadii.lg,
    flex: 1,
    height: 58,
  },
  streakDesignShelf: {
    flex: 1,
    width: '100%',
  },
  streakRail: {
    flexDirection: 'row',
    gap: 5,
    height: 18,
    width: '100%',
  },
  streakRailDesign: {
    gap: 10,
    width: '100%',
  },
  streakRailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakRailSegment: {
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    flex: 1,
  },
  root: {
    flex: 1,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowIconWrap: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 30,
  },
  sheetDock: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  sheetKeyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFill,
  },
  sectionStack: {
    gap: 8,
  },
  topExerciseName: {
    flex: 1,
  },
  topExerciseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  topExerciseStack: {
    gap: 8,
  },
  trainingVisualRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
  },
  weightInput: {
    fontSize: 34,
    fontWeight: '800',
    minHeight: 74,
  },
  weightInputRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
  },
  weightLogButton: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    flexDirection: 'row',
    gap: 4,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  weightSheetClose: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  weightSheetContent: {
    gap: 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  weightSheetHandle: {
    alignSelf: 'center',
    borderRadius: reedRadii.pill,
    height: 4,
    width: 42,
  },
  weightSheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  weightSheetSurface: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  weightSheetTitleBlock: {
    flex: 1,
    gap: 4,
  },
  weightUnitLabel: {
    paddingBottom: 17,
  },
  updateHint: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: 20,
  },
  updateHintOpen: {
    transform: [{ rotate: '90deg' }],
  },
  progressMetricRowCompact: {
    flexDirection: 'column',
  },
  trainingVisualRowCompact: {
    flexDirection: 'column',
  },
});

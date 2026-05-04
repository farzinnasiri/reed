import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ReedText } from '@/components/ui/reed-text';
import { getGlassControlTokens } from '@/components/ui/glass-material';
import { GlassSurface } from '@/components/ui/glass-surface';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { SettingsSurface } from './settings-surface';

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

type ProfileSurfaceProps = {
  displayName: string;
  onEditingProfileChange?: (isEditing: boolean) => void;
};

export function ProfileSurface({ displayName, onEditingProfileChange }: ProfileSurfaceProps) {
  const { theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);
  const viewerTrainingProfile = useQuery(api.profiles.viewerTrainingProfile, {});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekRange = useMemo(() => getProfileWeekRange(weekOffset), [weekOffset]);
  const weeklyStats = useQuery(api.homeStats.getWeeklyMuscleStats, {
    weekEndAt: weekRange.weekEndAt,
    weekStartAt: weekRange.weekStartAt,
  });
  const recordHighlights = useQuery(api.trainingKnowledge.getRecordHighlights, { limit: 3 });

  const trainingProfile = viewerTrainingProfile?.trainingProfile ?? null;
  const bodyWeight = viewerTrainingProfile?.latestBodyMetrics?.find(metric => metric.metricKey === 'body_weight') ?? null;
  const primaryGoal = trainingProfile?.rankedGoals[0] ?? null;
  const contextLine = useMemo(() => {
    if (!trainingProfile) {
      return 'Reed is still learning your training context';
    }

    const weekly = weeklySessionLabels[trainingProfile.trainingReality.weeklySessions] ?? 'training rhythm set';
    return `${goalLabels[primaryGoal ?? ''] ?? 'Training'} · ${weekly}`;
  }, [primaryGoal, trainingProfile]);

  if (isSettingsOpen) {
    return (
      <View style={styles.fullscreenPanel}>
        <SettingsSurface onBack={() => setIsSettingsOpen(false)} onEditingProfileChange={onEditingProfileChange} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: 132,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <ReedText variant="title">{displayName || 'Profile'}</ReedText>
          <ReedText tone="muted">{contextLine}</ReedText>
        </View>
        <Pressable
          accessibilityLabel="Open settings"
          onPress={() => setIsSettingsOpen(true)}
          style={({ pressed }) => [
            styles.iconButton,
            {
              backgroundColor: glassControls.shellBackgroundColor,
              borderColor: glassControls.shellBorderColor,
            },
            getTapScaleStyle(pressed),
          ]}
        >
          <Ionicons color={String(theme.colors.textPrimary)} name="settings-outline" size={18} />
        </Pressable>
      </View>

      {viewerTrainingProfile === undefined ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={String(theme.colors.accentPrimary)} />
          <ReedText tone="muted">Reading your profile.</ReedText>
        </View>
      ) : (
        <View style={styles.sectionStack}>
          <ProfileRow
            icon="body-outline"
            label="Body"
            primary={bodyWeight ? `${formatMetric(bodyWeight.value)} ${bodyWeight.unit}` : 'Add bodyweight'}
            secondary={bodyWeight ? `Last updated ${formatDate(bodyWeight.observedAt)}` : 'Make bodyweight work more accurate.'}
          />

          <ProfileRow
            icon="flag-outline"
            label="Goal"
            primary={primaryGoal ? goalLabels[primaryGoal] ?? primaryGoal : 'Complete training profile'}
            secondary={formatGoalPriorities(trainingProfile?.rankedGoals ?? [])}
          />

          <ProfileRow
            icon="finger-print-outline"
            label="Training profile"
            primary={formatTrainingReality(trainingProfile)}
            secondary={formatConstraints(trainingProfile?.constraints.areas ?? [])}
          />

          <GlassSurface contentStyle={styles.weeklyContent} style={styles.recordsSurface}>
            <View style={styles.recordsHeader}>
              <View>
                <ReedText variant="bodyStrong">Training week</ReedText>
                <ReedText tone="muted" variant="caption">{formatWeekRange(weekRange.weekStartAt, weekRange.weekEndAt)}</ReedText>
              </View>
              <View style={styles.weekStepper}>
                <Pressable
                  accessibilityLabel="Previous week"
                  onPress={() => setWeekOffset(current => current - 1)}
                  style={({ pressed }) => [styles.weekStepButton, getTapScaleStyle(pressed)]}
                >
                  <Ionicons color={String(theme.colors.textMuted)} name="chevron-back" size={16} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Next week"
                  disabled={weekOffset === 0}
                  onPress={() => setWeekOffset(current => Math.min(0, current + 1))}
                  style={({ pressed }) => [styles.weekStepButton, { opacity: weekOffset === 0 ? 0.35 : 1 }, getTapScaleStyle(pressed, weekOffset === 0)]}
                >
                  <Ionicons color={String(theme.colors.textMuted)} name="chevron-forward" size={16} />
                </Pressable>
              </View>
            </View>
            <View
              style={[
                styles.weeklySummaryCard,
                {
                  backgroundColor: glassControls.shellBackgroundColor,
                  borderColor: glassControls.shellBorderColor,
                },
              ]}
            >
              <ProfileMetric label="Sets" value={weeklyStats ? formatWholeNumber(weeklyStats.totalSets) : '—'} />
              <ProfileMetric label="Reps" value={weeklyStats ? formatWholeNumber(weeklyStats.totalReps) : '—'} />
              <ProfileMetric label="Load" value={weeklyStats ? formatVolume(weeklyStats.totalVolume) : '—'} />
            </View>
            <WeekRail activeOffset={weekOffset} onSelect={setWeekOffset} />
          </GlassSurface>

          <GlassSurface contentStyle={styles.recordsContent} style={styles.recordsSurface}>
            <View style={styles.recordsHeader}>
              <View>
                <ReedText variant="bodyStrong">Records</ReedText>
                <ReedText tone="muted" variant="caption">Best efforts Reed can compare cleanly.</ReedText>
              </View>
              <Ionicons color={String(theme.colors.textMuted)} name="trophy-outline" size={18} />
            </View>
            <View style={styles.recordRows}>
              {recordHighlights === undefined ? (
                <View style={styles.loadingRowInline}>
                  <ActivityIndicator color={String(theme.colors.accentPrimary)} size="small" />
                  <ReedText tone="muted" variant="caption">Reading records.</ReedText>
                </View>
              ) : recordHighlights.highlights.length === 0 ? (
                <ReedText tone="muted" variant="caption">Log a few comparable sets and records will appear here.</ReedText>
              ) : recordHighlights.highlights.map(record => (
                <View key={`${record.exerciseCatalogId}:${record.kind}`} style={[styles.recordRow, { borderBottomColor: theme.colors.controlBorder }]}>
                  <View style={styles.recordCopy}>
                    <ReedText variant="caption">{record.exerciseName}</ReedText>
                    <ReedText tone="muted" variant="label">{record.label}</ReedText>
                  </View>
                  <View style={styles.recordValue}>
                    <ReedText variant="caption">{record.displayValue}</ReedText>
                    <ReedText tone="muted" variant="label">{record.summary}</ReedText>
                  </View>
                </View>
              ))}
            </View>
          </GlassSurface>
        </View>
      )}
    </ScrollView>
  );
}

function ProfileRow({
  icon,
  label,
  primary,
  secondary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary: string;
  secondary: string;
}) {
  const { theme } = useReedTheme();

  return (
    <Pressable
      accessibilityLabel={`Open ${label.toLowerCase()} details`}
      style={({ pressed }) => [
        styles.profileRow,
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
    </Pressable>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileMetric}>
      <ReedText variant="bodyStrong">{value}</ReedText>
      <ReedText tone="muted" variant="label">{label}</ReedText>
    </View>
  );
}

function WeekRail({ activeOffset, onSelect }: { activeOffset: number; onSelect: (offset: number) => void }) {
  const { theme } = useReedTheme();
  const offsets = [-5, -4, -3, -2, -1, 0];

  return (
    <View style={styles.weekRail}>
      {offsets.map(offset => {
        const isActive = offset === activeOffset;
        const range = getProfileWeekRange(offset);
        return (
          <Pressable
            accessibilityLabel={`Show week of ${formatWeekRange(range.weekStartAt, range.weekEndAt)}`}
            key={offset}
            onPress={() => onSelect(offset)}
            style={({ pressed }) => [
              styles.weekRailItem,
              {
                backgroundColor: isActive ? theme.colors.controlActiveFill : 'transparent',
                borderColor: isActive ? theme.colors.controlActiveBorder : theme.colors.controlBorder,
              },
              getTapScaleStyle(pressed),
            ]}
          >
            <ReedText tone={isActive ? 'default' : 'muted'} variant="caption">{offset === 0 ? 'This' : `${Math.abs(offset)}w`}</ReedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function getProfileWeekRange(weekOffset: number) {
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const daysSinceMonday = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday + weekOffset * 7);
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

function formatVolume(value: number) {
  return `${Math.round(value).toLocaleString('en')} kg`;
}

function formatMetric(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(new Date(timestamp));
}

function formatGoalPriorities(goals: string[]) {
  if (goals.length === 0) {
    return 'Set priorities so Reed can adapt.';
  }

  return goals.slice(1, 4).map(goal => goalLabels[goal] ?? goal).join(' · ') || 'Primary goal set.';
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

const styles = StyleSheet.create({
  content: {
    gap: 28,
  },
  fullscreenPanel: {
    flex: 1,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
  profileRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    minHeight: 84,
    paddingVertical: 14,
  },
  recordCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  recordRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  recordValue: {
    alignItems: 'flex-end',
    gap: 2,
  },
  recordRows: {
    gap: 2,
  },
  recordsContent: {
    gap: 14,
  },
  recordsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profileMetric: {
    flex: 1,
    gap: 3,
  },
  recordsSurface: {
    marginTop: 4,
  },
  root: {
    flex: 1,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  rowIconWrap: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 30,
  },
  sectionStack: {
    gap: 8,
  },
  weeklyContent: {
    gap: 14,
  },
  weeklySummaryCard: {
    borderRadius: reedRadii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  weekRail: {
    flexDirection: 'row',
    gap: 8,
  },
  weekRailItem: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  weekStepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  weekStepButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 36,
  },
});

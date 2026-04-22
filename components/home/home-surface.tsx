import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle, runReedLayoutAnimation } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { formatWeeklyVolume } from '@/domains/workout/weekly-muscle-stats';
import { getFirstName, pickHomeGreeting } from './home-greetings';

type HomeSurfaceProps = {
  displayName: string;
  hasActiveSession: boolean;
  onOpenWorkout: () => void;
};

export function HomeSurface({
  displayName,
  hasActiveSession,
  onOpenWorkout,
}: HomeSurfaceProps) {
  const { theme } = useReedTheme();
  const startSession = useMutation(api.liveSessions.start);
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [headline] = useState(() => pickHomeGreeting());

  const weekRange = getCurrentWeekRange();
  const weeklyStats = useQuery(api.homeStats.getWeeklyMuscleStats, {
    weekEndAt: weekRange.weekEndAt,
    weekStartAt: weekRange.weekStartAt,
  });

  const firstName = getFirstName(displayName);
  const weekLabel = formatWeekRange(
    weeklyStats?.weekStartAt ?? weekRange.weekStartAt,
    weeklyStats?.weekEndAt ?? weekRange.weekEndAt,
  );
  const breakdownGroups = weeklyStats?.groups ?? [];

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
        <ReedText tone="muted" variant="bodyStrong">
          Hey, {firstName}
        </ReedText>
        <ReedText variant="title">{headline}</ReedText>
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
            <ReedText style={styles.startButtonLabel} variant="section">
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
                backgroundColor: theme.colors.controlFill,
                borderColor: theme.colors.controlBorder,
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
                  backgroundColor: theme.colors.controlFill,
                  borderColor: theme.colors.controlBorder,
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
              breakdownGroups.length === 0 ? (
                <View style={styles.emptyState}>
                  <ReedText tone="muted">
                    No sets logged this week yet. Start a session to populate your muscle board.
                  </ReedText>
                </View>
              ) : (
                <View
                  style={[
                    styles.breakdownList,
                    {
                      borderColor: theme.colors.controlBorder,
                    },
                  ]}
                >
                  {breakdownGroups.map((group, index) => (
                    <View
                      key={group.groupId}
                      style={[
                        styles.breakdownRow,
                        index < breakdownGroups.length - 1
                          ? {
                              borderBottomColor: theme.colors.controlBorder,
                            }
                          : null,
                      ]}
                    >
                      <View style={styles.breakdownRowContent}>
                        <View
                          style={[
                            styles.breakdownIconShell,
                            {
                              backgroundColor: theme.colors.controlFill,
                              borderColor: theme.colors.controlBorder,
                            },
                          ]}
                        >
                          <Ionicons
                            color={String(theme.colors.accentPrimary)}
                            name={getMuscleGroupIconName(group.groupId)}
                            size={20}
                          />
                        </View>
                        <View style={styles.breakdownCopy}>
                          <ReedText variant="bodyStrong">{group.label}</ReedText>
                          <ReedText tone="muted">
                            {formatWholeNumber(group.reps)} reps
                            {'  •  '}
                            {formatWeeklyVolume(group.volume)}
                            {'  •  '}
                            {formatSetCount(group.setCount)}
                          </ReedText>
                        </View>
                      </View>
                    </View>
                  ))}
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

type MetricDisplay = {
  unit?: string;
  value: string;
};

function getMuscleGroupIconName(groupId: string): React.ComponentProps<typeof Ionicons>['name'] {
  if (groupId === 'arms') {
    return 'barbell-outline';
  }

  if (groupId === 'shoulders') {
    return 'triangle-outline';
  }

  if (groupId === 'chest') {
    return 'body-outline';
  }

  if (groupId === 'back') {
    return 'shirt-outline';
  }

  if (groupId === 'cardio') {
    return 'heart-outline';
  }

  if (groupId === 'legs') {
    return 'walk-outline';
  }

  if (groupId === 'core') {
    return 'ellipse-outline';
  }

  return 'fitness-outline';
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

function formatSetCount(value: number) {
  return `${value} ${value === 1 ? 'set' : 'sets'}`;
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
    color: '#f8fafc',
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
  breakdownList: {
    borderTopWidth: 1,
    gap: 0,
    paddingTop: 8,
  },
  breakdownRow: {
    borderBottomWidth: 1,
    gap: 3,
    minHeight: 60,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  breakdownRowContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  breakdownIconShell: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  breakdownCopy: {
    flex: 1,
    gap: 3,
  },
  emptyState: {
    minHeight: 80,
    justifyContent: 'center',
  },
});

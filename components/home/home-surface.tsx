import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { formatWeeklyVolume } from '@/domains/workout/weekly-muscle-stats';

const VISIBLE_GROUP_LIMIT = 6;

type HomeSurfaceProps = {
  hasActiveSession: boolean;
  onOpenWorkout: () => void;
};

export function HomeSurface({
  hasActiveSession,
  onOpenWorkout,
}: HomeSurfaceProps) {
  const { theme } = useReedTheme();
  const startSession = useMutation(api.liveSessions.start);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const weekRange = getCurrentWeekRange();
  const weeklyStats = useQuery(api.homeStats.getWeeklyMuscleStats, {
    weekEndAt: weekRange.weekEndAt,
    weekStartAt: weekRange.weekStartAt,
  });

  const visibleGroups = (weeklyStats?.groups ?? []).slice(0, VISIBLE_GROUP_LIMIT);
  const maxSetCount = Math.max(1, ...visibleGroups.map(group => group.setCount));
  const overflowCount = Math.max(0, (weeklyStats?.groups.length ?? 0) - visibleGroups.length);
  const weekLabel = formatWeekRange(
    weeklyStats?.weekStartAt ?? weekRange.weekStartAt,
    weeklyStats?.weekEndAt ?? weekRange.weekEndAt,
  );

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
        <ReedText variant="label">This Week</ReedText>
        <ReedText variant="title">Weekly Muscle Load</ReedText>
        <ReedText tone="muted">{weekLabel}</ReedText>
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
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(66, 188, 255, 0.96)',
              'rgba(26, 132, 255, 0.96)',
            ]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.startButtonFill}
          >
            <ReedText
              style={styles.startButtonLabel}
              variant="section"
            >
              {isStarting ? 'Starting...' : hasActiveSession ? 'Continue Session' : 'Start Session'}
            </ReedText>
          </LinearGradient>
        </Pressable>

        {startError ? (
          <ReedText tone="danger">{startError}</ReedText>
        ) : null}
      </GlassSurface>

      <GlassSurface style={styles.card}>
        <View style={styles.cardHeader}>
          <ReedText variant="section">Muscle Group Totals</ReedText>
          <ReedText tone="muted">Sets, reps, and load volume aggregated from Monday to Sunday.</ReedText>
        </View>

        {weeklyStats === undefined ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={String(theme.colors.accentPrimary)} />
            <ReedText tone="muted">Preparing weekly breakdown...</ReedText>
          </View>
        ) : (
          <>
            <View style={styles.totalsRow}>
              <MetricChip
                label="Sets"
                value={formatWholeNumber(weeklyStats.totalSets)}
              />
              <MetricChip
                label="Reps"
                value={formatWholeNumber(weeklyStats.totalReps)}
              />
              <MetricChip
                label="Volume"
                value={formatWeeklyVolume(weeklyStats.totalVolume)}
              />
            </View>

            {visibleGroups.length === 0 ? (
              <View style={styles.emptyState}>
                <ReedText tone="muted">
                  No sets logged this week yet. Start a session to populate your muscle board.
                </ReedText>
              </View>
            ) : (
              <View style={styles.groupList}>
                {visibleGroups.map(group => {
                  const ratio = Math.max(0.08, group.setCount / maxSetCount);
                  return (
                    <View key={group.groupId} style={styles.groupRow}>
                      <View style={styles.groupRowHeader}>
                        <ReedText variant="bodyStrong">{group.label}</ReedText>
                        <ReedText tone="muted">{group.setCount} sets</ReedText>
                      </View>
                      <View style={styles.groupDetailRow}>
                        <ReedText tone="muted">{formatWholeNumber(group.reps)} reps</ReedText>
                        <ReedText tone="muted">{formatWeeklyVolume(group.volume)}</ReedText>
                      </View>
                      <View
                        style={[
                          styles.groupTrack,
                          { backgroundColor: theme.colors.controlFill, borderColor: theme.colors.controlBorder },
                        ]}
                      >
                        <LinearGradient
                          colors={[
                            'rgba(56, 189, 248, 0.95)',
                            'rgba(14, 165, 233, 0.95)',
                          ]}
                          end={{ x: 1, y: 0.5 }}
                          start={{ x: 0, y: 0.5 }}
                          style={[styles.groupFill, { width: `${Math.round(ratio * 100)}%` }]}
                        />
                      </View>
                    </View>
                  );
                })}

                {overflowCount > 0 ? (
                  <ReedText tone="muted">+{overflowCount} more groups logged this week.</ReedText>
                ) : null}
              </View>
            )}
          </>
        )}
      </GlassSurface>
    </ScrollView>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  const { theme } = useReedTheme();

  return (
    <View
      style={[
        styles.metricChip,
        {
          backgroundColor: theme.colors.controlFill,
          borderColor: theme.colors.controlBorder,
        },
      ]}
    >
      <ReedText tone="muted" variant="label">
        {label}
      </ReedText>
      <ReedText variant="bodyStrong">{value}</ReedText>
    </View>
  );
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
    borderRadius: 30,
    marginHorizontal: 2,
  },
  cardHeader: {
    gap: 4,
  },
  startButtonShell: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  startButtonFill: {
    alignItems: 'center',
    borderRadius: 999,
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
    minHeight: 80,
  },
  totalsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricChip: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 1,
    minHeight: 74,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emptyState: {
    minHeight: 92,
    justifyContent: 'center',
  },
  groupList: {
    gap: 12,
  },
  groupRow: {
    gap: 5,
  },
  groupRowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupTrack: {
    borderRadius: 999,
    borderWidth: 1,
    height: 10,
    overflow: 'hidden',
  },
  groupFill: {
    borderRadius: 999,
    height: '100%',
    minWidth: 8,
  },
});

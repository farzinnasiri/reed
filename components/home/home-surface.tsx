import Ionicons from '@expo/vector-icons/Ionicons';
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
import { getGlassControlTokens, SCREEN_CONTENT_HORIZONTAL_MARGIN } from '@/components/ui/glass-material';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle, runReedLayoutAnimation } from '@/design/motion';
import { useBreakpoint } from '@/design/use-breakpoint';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { formatWeeklyVolume } from '@/domains/workout/weekly-muscle-stats';
import { GoalsHomeCard } from './goals-home-card';
import { ProfileDashboardCards, TrainingProgressExpansion } from './profile-surface';
import { QuickLogSheet } from './quick-log-sheet';

type HomeSurfaceProps = {
  dockReservedSpace: number;
  hasActiveSession: boolean;
  homeHeadline: string;
  onOpenGoals: () => void;
  onOpenWorkout: () => void;
};

export function HomeSurface({
  dockReservedSpace,
  hasActiveSession,
  homeHeadline,
  onOpenGoals,
  onOpenWorkout,
}: HomeSurfaceProps) {
  const { theme } = useReedTheme();
  const { isCompact, width } = useBreakpoint();
  const useCompactHeadline = isCompact || width < 430;
  const startSession = useMutation(api.liveSessions.start);
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
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
          paddingBottom: dockReservedSpace + theme.spacing.xl,
          paddingHorizontal: SCREEN_CONTENT_HORIZONTAL_MARGIN,
          paddingTop: theme.spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <View style={styles.header}>
        <ReedText
          ellipsizeMode="tail"
          numberOfLines={1}
          style={[styles.headerHeadline, useCompactHeadline && styles.headerHeadlineCompact]}
          variant="title"
        >
          {homeHeadline}
        </ReedText>
      </View>

      <GlassSurface style={styles.card}>
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
              {isStarting ? 'Starting...' : hasActiveSession ? 'Continue Session' : 'Start Instant Session'}
            </ReedText>
          </View>
        </Pressable>

        {startError ? <ReedText tone="danger">{startError}</ReedText> : null}

        <ReedButton
          accessibilityLabel="Open quick log"
          elevated={false}
          label="Quick Log"
          onPress={() => setIsQuickLogOpen(true)}
          variant="secondary"
        />
      </GlassSurface>

      <QuickLogSheet onClose={() => setIsQuickLogOpen(false)} visible={isQuickLogOpen} />

      <ProfileDashboardCards />

      <GoalsHomeCard onOpenGoals={onOpenGoals} />

      <GlassSurface style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.weeklyHeaderCopy}>
            <ReedText variant="section">Training</ReedText>
            <ReedText tone="muted">{weekLabel}</ReedText>
          </View>
          <Pressable
            accessibilityLabel={isBreakdownExpanded ? 'Hide muscle load breakdown' : 'Show muscle load breakdown'}
            onPress={toggleBreakdown}
            style={({ pressed }) => [
              styles.expandButton,
              getTapScaleStyle(pressed),
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
            <View style={styles.summaryStrip}>
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
                label="Load"
                value={formatVolumeDisplay(weeklyStats.totalVolume)}
              />
            </View>

            {isBreakdownExpanded ? <TrainingProgressExpansion /> : null}
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
        <ReedText
          adjustsFontSizeToFit
          minimumFontScale={0.68}
          numberOfLines={1}
          style={styles.summaryValue}
          variant="title"
        >
          {value.value}
        </ReedText>
        {value.unit ? (
          <ReedText numberOfLines={1} style={styles.summaryValueUnit} tone="muted" variant="section">
            {value.unit}
          </ReedText>
        ) : null}
      </View>
      <ReedText adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} tone="muted" variant="label">
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
    gap: 16,
  },
  header: {
    gap: 4,
    paddingHorizontal: 4,
  },
  headerHeadline: {
    fontSize: 21,
    lineHeight: 26,
  },
  headerHeadlineCompact: {
    fontSize: 19,
    lineHeight: 24,
  },
  card: {
    borderRadius: reedRadii.xl,
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
    height: 44,
    justifyContent: 'center',
    width: 44,
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
    flexDirection: 'row',
    paddingVertical: 8,
  },
  summaryMetric: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
    position: 'relative',
  },
  summaryValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
    maxWidth: '100%',
    minWidth: 0,
  },
  summaryValue: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  summaryValueUnit: {
    flexShrink: 0,
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 2,
  },
  summaryDivider: {
    bottom: 8,
    position: 'absolute',
    right: 0,
    top: 8,
    width: 1,
  },
});

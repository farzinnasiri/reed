import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { blurActiveElementOnWeb } from '@/components/ui/focus';
import { getTapScaleStyle, runReedLayoutAnimation } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { CreateGoalSheet } from './profile/goals-surface';
import { ProgressRow, getProgressRatio, getProgressSlices, type TrainingTarget } from './target-progress';

type GoalsHomeCardProps = {
  onOpenGoals: () => void;
};

export function GoalsHomeCard({ onOpenGoals }: GoalsHomeCardProps) {
  const { theme } = useReedTheme();
  const targets = useQuery(api.trainingTargets.list, { includeArchived: false });
  const refreshActiveTargets = useMutation(api.trainingTargets.refreshActive);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const hasRequestedRefresh = useRef(false);
  const summary = useMemo(() => summarizeTargets(targets ?? []), [targets]);

  useEffect(() => {
    if (targets === undefined || hasRequestedRefresh.current) {
      return;
    }

    hasRequestedRefresh.current = true;
    void refreshActiveTargets({});
  }, [refreshActiveTargets, targets]);

  function toggleExpanded() {
    runReedLayoutAnimation();
    setIsExpanded(current => !current);
  }

  function openCreateGoal() {
    blurActiveElementOnWeb();
    setIsCreating(true);
  }

  function closeCreateGoal() {
    blurActiveElementOnWeb();
    setIsCreating(false);
  }

  function openGoals() {
    blurActiveElementOnWeb();
    onOpenGoals();
  }

  return (
    <GlassSurface style={styles.card}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityLabel="Open goals"
          onPress={openGoals}
          style={({ pressed }) => [styles.headerPressable, getTapScaleStyle(pressed)]}
        >
          <View style={styles.headerCopy}>
            <ReedText variant="section">Goals</ReedText>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Add goal"
            onPress={openCreateGoal}
            style={({ pressed }) => [styles.iconButton, getTapScaleStyle(pressed)]}
          >
            <Ionicons color={String(theme.colors.accentPrimary)} name="add" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel={isExpanded ? 'Collapse goals' : 'Expand goals'}
            onPress={toggleExpanded}
            style={({ pressed }) => [styles.iconButton, getTapScaleStyle(pressed)]}
          >
            <Ionicons color={String(theme.colors.textPrimary)} name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} />
          </Pressable>
        </View>
      </View>

      {targets === undefined ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={String(theme.colors.accentPrimary)} />
          <ReedText tone="muted">Loading goals.</ReedText>
        </View>
      ) : (
        <>
          <View style={styles.summaryStrip}>
            <GoalSummary label="Active" value={summary.active} />
            <GoalSummary label="Achieved" value={summary.completed} />
            <GoalSummary label="Missed" value={summary.missed} />
          </View>

          {summary.activeTargets.length === 0 ? (
            <Pressable onPress={openCreateGoal} style={({ pressed }) => [styles.emptyState, { borderColor: theme.colors.controlBorder }, getTapScaleStyle(pressed)]}>
              <ReedText variant="bodyStrong">Set one concrete target</ReedText>
              <ReedText tone="muted" variant="caption">A deadline, a metric, and Reed tracks the rest.</ReedText>
            </Pressable>
          ) : (
            <View style={styles.previewStack}>
              {(isExpanded ? summary.activeTargets : summary.activeTargets.slice(0, 1)).map(target => (
                <HomeGoalRow key={target._id} target={target} />
              ))}
            </View>
          )}

          {isExpanded ? (
            <Pressable onPress={openGoals} style={({ pressed }) => [styles.openFullList, getTapScaleStyle(pressed)]}>
              <ReedText style={{ color: theme.colors.accentPrimary }} variant="caption">Open full goals list</ReedText>
              <Ionicons color={String(theme.colors.accentPrimary)} name="arrow-forward" size={14} />
            </Pressable>
          ) : null}
        </>
      )}

      <CreateGoalSheet visible={isCreating} onClose={closeCreateGoal} />
    </GlassSurface>
  );
}

function GoalSummary({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryItem}>
      <ReedText variant="title" style={styles.summaryValue}>{value}</ReedText>
      <ReedText tone="muted" variant="label">{label}</ReedText>
    </View>
  );
}

function HomeGoalRow({ target }: { target: TrainingTarget }) {
  const slices = getProgressSlices(target);
  return (
    <View style={styles.goalPreviewRow}>
      <View style={styles.goalPreviewCopy}>
        <ReedText numberOfLines={1} variant="bodyStrong">{target.title}</ReedText>
      </View>
      <View style={styles.progressStack}>
        {slices.map(slice => (
          <ProgressRow compact key={slice.label} slice={slice} />
        ))}
      </View>
    </View>
  );
}

function summarizeTargets(targets: TrainingTarget[]) {
  const activeTargets = targets
    .filter(target => target.status === 'active')
    .sort((left, right) => getProgressRatio(right) - getProgressRatio(left) || left.endsAt - right.endsAt)
    .slice(0, 3);
  return {
    active: targets.filter(target => target.status === 'active').length,
    activeTargets,
    completed: targets.filter(target => target.status === 'completed').length,
    missed: targets.filter(target => target.status === 'missed').length,
  };
}

const styles = StyleSheet.create({
  card: { borderRadius: reedRadii.xl },
  emptyState: { borderRadius: reedRadii.lg, borderWidth: 1, gap: 4, padding: 14 },
  goalPreviewCopy: { flex: 1, gap: 2, minWidth: 0 },
  goalPreviewRow: { gap: 8 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  headerCopy: { flex: 1, gap: 2 },
  headerPressable: { flex: 1 },
  headerRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  iconButton: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 58 },
  openFullList: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 5, paddingVertical: 4 },
  previewStack: { gap: 12 },
  progressStack: { gap: 8 },
  summaryItem: { alignItems: 'center', flex: 1, gap: 2 },
  summaryStrip: { flexDirection: 'row', paddingVertical: 4 },
  summaryValue: { lineHeight: 30 },
});

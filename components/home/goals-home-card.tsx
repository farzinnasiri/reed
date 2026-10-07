import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ReedText } from '@/components/ui/reed-text';
import { blurActiveElementOnWeb } from '@/components/ui/focus';
import { getTapScaleStyle, runReedLayoutAnimation } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { CreateGoalSheet } from './profile/goals-surface';
import { ProgressSection } from './progress-section';
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
    <ProgressSection
      title="Goals"
      trailing={(
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Add goal"
            onPress={openCreateGoal}
            style={({ pressed }) => [styles.iconButton, getTapScaleStyle(pressed)]}
          >
            <Ionicons color={String(theme.colors.accentInk)} name="add" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel={isExpanded ? 'Collapse goals' : 'Expand goals'}
            onPress={toggleExpanded}
            style={({ pressed }) => [styles.iconButton, getTapScaleStyle(pressed)]}
          >
            <Ionicons color={String(theme.colors.inkSecondary)} name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} />
          </Pressable>
        </View>
      )}
    >
      {targets === undefined ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={String(theme.colors.accent)} />
          <ReedText tone="muted">Loading goals.</ReedText>
        </View>
      ) : (
        <>
          <View style={styles.summaryStrip}>
            <GoalSummary label="Active" value={summary.active} />
            <GoalSummary label="Achieved" value={summary.completed} />
            <GoalSummary label="Missed" value={summary.missed} />
          </View>

          {summary.activeTargets.length > 0 ? (
            <View>
              {(isExpanded ? summary.activeTargets : summary.activeTargets.slice(0, 1)).map((target, index) => (
                <HomeGoalRow isFirst={index === 0} key={target._id} target={target} />
              ))}
            </View>
          ) : null}

          <Pressable onPress={openGoals} style={({ pressed }) => [styles.openFullList, getTapScaleStyle(pressed)]}>
            <ReedText tone="accent" variant="caption">Open full goals list</ReedText>
            <Ionicons color={String(theme.colors.accentInk)} name="arrow-forward" size={14} />
          </Pressable>
        </>
      )}

      <CreateGoalSheet visible={isCreating} onClose={closeCreateGoal} />
    </ProgressSection>
  );
}

function GoalSummary({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryItem}>
      <ReedText variant="title" style={styles.summaryValue}>{value}</ReedText>
      <ReedText tone="muted" variant="caption">{label}</ReedText>
    </View>
  );
}

function HomeGoalRow({ isFirst, target }: { isFirst: boolean; target: TrainingTarget }) {
  const { theme } = useReedTheme();
  const slices = getProgressSlices(target);
  return (
    <View style={[styles.goalPreviewRow, isFirst ? null : { borderTopColor: theme.colors.line, borderTopWidth: 1 }]}>
      <View style={styles.goalPreviewCopy}>
        <ReedText numberOfLines={1} variant="body">{target.title}</ReedText>
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
  goalPreviewCopy: { flex: 1, gap: 2, minWidth: 0 },
  goalPreviewRow: { gap: 8, paddingVertical: 10 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  iconButton: { alignItems: 'center', justifyContent: 'center', padding: 6 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 58 },
  openFullList: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 5, paddingVertical: 4 },
  progressStack: { gap: 8 },
  summaryItem: { alignItems: 'center', flex: 1, gap: 2 },
  summaryStrip: { flexDirection: 'row', paddingVertical: 4 },
  summaryValue: { lineHeight: 30 },
});

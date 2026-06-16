import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { ReedButton } from '@/components/ui/reed-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ScreenHeader } from '@/components/ui/screen-header';
import { blurActiveElementOnWeb } from '@/components/ui/focus';
import { SCREEN_CONTENT_HORIZONTAL_MARGIN } from '@/components/ui/glass-material';
import { getTapScaleStyle, runReedLayoutAnimation } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { CreateGoalSheet } from './profile/goals-surface';
import { ProgressRow, getProgressRatio, getProgressSlices, type TrainingTarget } from './target-progress';

type StatusFilter = 'active' | 'completed' | 'missed';
type SortOrder = 'due' | 'most' | 'newest';

export function GoalsPageSurface({ onBack }: { onBack: () => void }) {
  const { theme } = useReedTheme();
  const targets = useQuery(api.trainingTargets.list, { includeArchived: true });
  const refreshActiveTargets = useMutation(api.trainingTargets.refreshActive);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [sortOrder, setSortOrder] = useState<SortOrder>('due');
  const [isCreating, setIsCreating] = useState(false);
  const hasRequestedRefresh = useRef(false);
  const visibleTargets = useMemo(() => sortTargets((targets ?? []).filter(target => target.status === statusFilter), sortOrder), [sortOrder, statusFilter, targets]);

  useEffect(() => {
    if (targets === undefined || hasRequestedRefresh.current) {
      return;
    }

    hasRequestedRefresh.current = true;
    void refreshActiveTargets({});
  }, [refreshActiveTargets, targets]);

  function openCreateGoal() {
    blurActiveElementOnWeb();
    setIsCreating(true);
  }

  function closeCreateGoal() {
    blurActiveElementOnWeb();
    setIsCreating(false);
  }

  function goBack() {
    blurActiveElementOnWeb();
    onBack();
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: 132, paddingHorizontal: SCREEN_CONTENT_HORIZONTAL_MARGIN, paddingTop: theme.spacing.xl }]}
      showsVerticalScrollIndicator={false}
      style={[styles.root, { backgroundColor: theme.colors.canvas }]}
    >
      <ScreenHeader variant="identity" action={{ accessibilityLabel: 'Create goal', iconName: 'add', onPress: openCreateGoal }}>
        <Pressable onPress={goBack} style={({ pressed }) => [styles.backRow, getTapScaleStyle(pressed)]}>
          <Ionicons color={String(theme.colors.textMuted)} name="chevron-back" size={20} />
          <ReedText variant="title">Goals</ReedText>
        </Pressable>
      </ScreenHeader>

      <GlassSurface style={styles.card}>
        <View style={styles.leadBlock}>
          <ReedText variant="section">Your goals</ReedText>
        </View>
        <SegmentedControl<StatusFilter>
          compact
          onChange={setStatusFilter}
          options={[
            { label: 'Active', value: 'active' },
            { label: 'Done', value: 'completed' },
            { label: 'Missed', value: 'missed' },
          ]}
          value={statusFilter}
        />
        <SegmentedControl<SortOrder>
          compact
          onChange={setSortOrder}
          options={[
            { label: 'Due', value: 'due' },
            { label: 'Progress', value: 'most' },
            { label: 'New', value: 'newest' },
          ]}
          value={sortOrder}
        />
      </GlassSurface>

      {targets === undefined ? (
        <View style={styles.loadingRow}><ActivityIndicator color={String(theme.colors.accentPrimary)} /><ReedText tone="muted">Loading goals.</ReedText></View>
      ) : visibleTargets.length === 0 ? (
        <GlassSurface style={styles.card}><ReedText variant="bodyStrong">No goals here.</ReedText><ReedText tone="muted" variant="caption">Try another filter or create a new measurable goal.</ReedText><ReedButton label="New goal" onPress={openCreateGoal} /></GlassSurface>
      ) : (
        visibleTargets.map(target => <GoalDetailCard key={target._id} target={target} />)
      )}

      <CreateGoalSheet visible={isCreating} onClose={closeCreateGoal} />
    </ScrollView>
  );
}

function GoalDetailCard({ target }: { target: TrainingTarget }) {
  const { theme } = useReedTheme();
  const completeManually = useMutation(api.trainingTargets.completeManually);
  const archive = useMutation(api.trainingTargets.archive);
  const recompute = useMutation(api.trainingTargets.recompute);
  const [isOpen, setIsOpen] = useState(false);
  const progressSlices = getProgressSlices(target);

  function toggle() {
    runReedLayoutAnimation();
    setIsOpen(current => !current);
  }

  return (
    <GlassSurface style={[styles.card, styles.goalCard, target.status === 'archived' && styles.archivedGoalCard]}>
      <Pressable onPress={toggle} style={({ pressed }) => [styles.goalHeader, getTapScaleStyle(pressed)]}>
        <View style={styles.goalHeaderCopy}>
          <View style={styles.goalTitleRow}>
            <ReedText numberOfLines={1} variant="bodyStrong" style={styles.goalTitle}>{target.title}</ReedText>
            <View style={[styles.statusPill, { borderColor: getStatusColor(target.status, theme) }]}>
              <ReedText tone={target.status === 'missed' ? 'danger' : 'muted'} variant="caption">{statusLabel(target.status)}</ReedText>
            </View>
          </View>
          <ReedText numberOfLines={2} tone="muted" variant="caption">{target.previewText}</ReedText>
        </View>
        <Ionicons color={String(theme.colors.textMuted)} name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} />
      </Pressable>

      <View style={styles.goalProgressStack}>
        {progressSlices.map(slice => (
          <ProgressRow key={slice.label} slice={slice} />
        ))}
      </View>
      <View style={styles.metaRow}>
        <ReedText tone="muted" variant="caption">{target.rule.cadence === 'daily' ? 'Daily target' : target.rule.cadence === 'weekly' ? 'Weekly target' : 'Target'}</ReedText>
        <ReedText tone="muted" variant="caption">Due {formatDate(target.endsAt)}</ReedText>
      </View>

      {isOpen ? (
        <View style={styles.detailStack}>
          <View style={[styles.detailBox, { borderColor: theme.colors.controlBorder }]}> 
            <ReedText tone="muted" variant="label">Required</ReedText>
            <ReedText variant="bodyStrong">{target.progressSummary.requiredLabel}</ReedText>
          </View>
          {target.progressSummary.totalPeriods ? (
            <View style={[styles.detailBox, { borderColor: theme.colors.controlBorder }]}> 
              <ReedText tone="muted" variant="label">Periods</ReedText>
              <ReedText variant="bodyStrong">{target.progressSummary.satisfiedPeriods ?? 0}/{target.progressSummary.totalPeriods}</ReedText>
            </View>
          ) : null}
          {target.notes ? (
            <View style={[styles.detailBox, { borderColor: theme.colors.controlBorder }]}> 
              <ReedText tone="muted" variant="label">Notes</ReedText>
              <ReedText variant="caption">{target.notes}</ReedText>
            </View>
          ) : null}
          {target.completionSource ? <ReedText tone="muted" variant="caption">{target.completionSource === 'verified' ? 'Completed from your logs.' : 'Marked complete manually.'}</ReedText> : null}
          <View style={styles.actionRow}>
            {target.status === 'active' ? (
              <IconAction
                accessibilityLabel="Mark goal complete"
                icon="checkmark-done-outline"
                onPress={() => completeManually({ targetId: target._id })}
              />
            ) : null}
            <IconAction
              accessibilityLabel="Recompute goal progress"
              icon="refresh-outline"
              onPress={() => recompute({ targetId: target._id })}
            />
            {target.status !== 'archived' ? (
              <IconAction
                accessibilityLabel="Archive goal"
                icon="archive-outline"
                onPress={() => archive({ targetId: target._id })}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </GlassSurface>
  );
}

function IconAction({ accessibilityLabel, icon, onPress }: { accessibilityLabel: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  const { theme } = useReedTheme();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
      onPress={onPress}
      style={({ pressed }) => [styles.iconAction, getTapScaleStyle(pressed)]}
    >
      <Ionicons color={String(theme.colors.textMuted)} name={icon} size={20} />
    </Pressable>
  );
}

function sortTargets(targets: TrainingTarget[], sortOrder: SortOrder) {
  return [...targets].sort((left, right) => {
    if (sortOrder === 'most') return getProgressRatio(right) - getProgressRatio(left);
    if (sortOrder === 'newest') return right.createdAt - left.createdAt;
    return left.endsAt - right.endsAt;
  });
}

function formatDate(ts: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(ts));
}

function getStatusColor(status: TrainingTarget['status'], theme: ReturnType<typeof useReedTheme>['theme']) {
  if (status === 'active') return theme.colors.accentPrimary;
  if (status === 'completed') return theme.colors.successText;
  if (status === 'missed') return theme.colors.dangerText;
  return theme.colors.textMuted;
}

function statusLabel(status: TrainingTarget['status']) {
  if (status === 'completed') return 'Achieved';
  return status[0].toUpperCase() + status.slice(1);
}

const styles = StyleSheet.create({
  actionRow: { alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row', gap: 16, paddingTop: 2 },
  backRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  card: { borderRadius: reedRadii.xl },
  archivedGoalCard: { opacity: 0.72 },
  content: { gap: 14 },
  detailBox: { borderRadius: reedRadii.lg, borderWidth: 1, gap: 3, padding: 12 },
  detailStack: { gap: 10, paddingTop: 4 },
  goalHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  goalHeaderCopy: { flex: 1, gap: 4, minWidth: 0 },
  goalCard: { overflow: 'hidden' },
  goalProgressStack: { gap: 10 },
  goalTitle: { flex: 1 },
  goalTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  leadBlock: { gap: 3 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 72 },
  metaRow: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  root: { flex: 1 },
  statusPill: { borderRadius: reedRadii.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  iconAction: { alignItems: 'center', justifyContent: 'center', padding: 4 },
});

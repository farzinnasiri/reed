import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle, runReedLayoutAnimation } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { CreateGoalSheet } from './profile/goals-surface';

type GoalsHomeCardProps = {
  onOpenGoals: () => void;
};

type TrainingTarget = NonNullable<ReturnType<typeof useQuery<typeof api.trainingTargets.list>>>[number];

export function GoalsHomeCard({ onOpenGoals }: GoalsHomeCardProps) {
  const { theme } = useReedTheme();
  const targets = useQuery(api.trainingTargets.list, { includeArchived: false });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const summary = useMemo(() => summarizeTargets(targets ?? []), [targets]);

  function toggleExpanded() {
    runReedLayoutAnimation();
    setIsExpanded(current => !current);
  }

  return (
    <GlassSurface style={styles.card}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityLabel="Open goals"
          onPress={onOpenGoals}
          style={({ pressed }) => [styles.headerPressable, getTapScaleStyle(pressed)]}
        >
          <View style={styles.headerCopy}>
            <ReedText variant="section">Goals</ReedText>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Add goal"
            onPress={() => setIsCreating(true)}
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
            <Pressable onPress={() => setIsCreating(true)} style={({ pressed }) => [styles.emptyState, { borderColor: theme.colors.controlBorder }, getTapScaleStyle(pressed)]}>
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
            <Pressable onPress={onOpenGoals} style={({ pressed }) => [styles.openFullList, getTapScaleStyle(pressed)]}>
              <ReedText style={{ color: theme.colors.accentPrimary }} variant="caption">Open full goals list</ReedText>
              <Ionicons color={String(theme.colors.accentPrimary)} name="arrow-forward" size={14} />
            </Pressable>
          ) : null}
        </>
      )}

      <CreateGoalSheet visible={isCreating} onClose={() => setIsCreating(false)} />
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
  const ratio = getProgressRatio(target);
  return (
    <View style={styles.goalPreviewRow}>
      <View style={styles.goalPreviewCopy}>
        <ReedText numberOfLines={1} variant="bodyStrong">{target.title}</ReedText>
        <ReedText numberOfLines={1} tone="muted" variant="caption">{target.progressSummary.currentLabel}</ReedText>
      </View>
      <ProgressGradient ratio={ratio} />
    </View>
  );
}

export function ProgressGradient({ ratio }: { ratio: number }) {
  const { theme } = useReedTheme();
  const clamped = Math.max(0, Math.min(1, ratio));
  const gradient = getProgressGradient(clamped, theme.mode);
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.colors.controlBorder }]}> 
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        end={{ x: 1, y: 0 }}
        start={{ x: 0, y: 0 }}
        style={[styles.progressFill, { width: `${clamped * 100}%` }]}
      />
    </View>
  );
}

function getProgressGradient(ratio: number, mode: 'dark' | 'light'): { colors: [string, string] | [string, string, string]; locations: [number, number] | [number, number, number] } {
  const blue = mode === 'dark' ? '#60a5fa' : '#3b82f6';
  const yellow = mode === 'dark' ? '#fde047' : '#facc15';
  const green = mode === 'dark' ? '#4ade80' : '#22c55e';

  if (ratio <= 0.5) {
    return {
      colors: [blue, mixHex(blue, yellow, ratio / 0.5)],
      locations: [0, 1],
    };
  }

  return {
    colors: [blue, yellow, mixHex(yellow, green, (ratio - 0.5) / 0.5)],
    locations: [0, 0.5 / ratio, 1],
  };
}

function mixHex(from: string, to: string, amount: number) {
  const t = Math.max(0, Math.min(1, amount));
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return `rgb(${Math.round(a.r + (b.r - a.r) * t)}, ${Math.round(a.g + (b.g - a.g) * t)}, ${Math.round(a.b + (b.b - a.b) * t)})`;
}

function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function getProgressRatio(target: TrainingTarget) {
  const progress = target.progressSummary;
  if (progress.totalPeriods && progress.totalPeriods > 0) {
    return (progress.satisfiedPeriods ?? 0) / progress.totalPeriods;
  }
  return progress.required > 0 ? progress.current / progress.required : 0;
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
  progressFill: { borderRadius: reedRadii.pill, height: '100%' },
  progressTrack: { borderRadius: reedRadii.pill, height: 8, overflow: 'hidden' },
  summaryItem: { alignItems: 'center', flex: 1, gap: 2 },
  summaryStrip: { flexDirection: 'row', paddingVertical: 4 },
  summaryValue: { lineHeight: 30 },
});

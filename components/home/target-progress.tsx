import { View, StyleSheet } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { displayedGoalUnit } from '@/domains/goals/target-evaluation';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

export type TrainingTarget = NonNullable<ReturnType<typeof useQuery<typeof api.trainingTargets.list>>>[number];

type GoalProgressSlice = {
  current: number;
  label: string;
  required: number;
  valueLabel: string;
};

export function ProgressRow({ compact = false, slice }: { compact?: boolean; slice: GoalProgressSlice }) {
  return (
    <View style={compact ? styles.progressRowCompact : styles.progressRow}>
      <View style={styles.progressLabelRow}>
        <ReedText tone="muted" variant="caption">{slice.label}</ReedText>
        <ReedText numberOfLines={1} variant="caption">{slice.valueLabel}</ReedText>
      </View>
      <ProgressBar ratio={slice.required > 0 ? slice.current / slice.required : 0} />
    </View>
  );
}

function ProgressBar({ ratio }: { ratio: number }) {
  const { theme } = useReedTheme();
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceHigh }]}>
      <View style={[styles.progressFill, { backgroundColor: theme.colors.accent, width: `${clamped * 100}%` }]} />
    </View>
  );
}

export function getProgressRatio(target: TrainingTarget) {
  const overall = getProgressSlices(target).at(-1);
  return overall && overall.required > 0 ? overall.current / overall.required : 0;
}

export function getProgressSlices(target: TrainingTarget): GoalProgressSlice[] {
  const progress = target.progressSummary;
  const periodUnit = target.rule.cadence === 'daily' ? 'days hit' : target.rule.cadence === 'weekly' ? 'weeks hit' : 'periods complete';
  const overall = progress.overall ?? {
    current: progress.totalPeriods ? progress.satisfiedPeriods ?? 0 : progress.current,
    label: progress.totalPeriods ? 'Goal' : 'Total',
    required: progress.totalPeriods ?? progress.required,
    valueLabel: progress.totalPeriods
      ? `${progress.satisfiedPeriods ?? 0} / ${progress.totalPeriods} ${periodUnit}`
      : progress.currentLabel,
  };

  if (progress.currentPeriod) {
    return [progress.currentPeriod, overall];
  }

  if (progress.totalPeriods) {
    return [
      {
        current: progress.current,
        label: target.rule.cadence === 'daily' ? 'Today' : 'This week',
        required: progress.required,
        valueLabel: `${progress.current} / ${progress.required} ${displayedGoalUnit(target.rule)} ${target.rule.cadence === 'daily' ? 'today' : 'this week'}`,
      },
      overall,
    ];
  }

  return [overall];
}

const styles = StyleSheet.create({
  progressFill: { borderRadius: reedRadii.pill, height: '100%' },
  progressLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  progressRow: { gap: 6 },
  progressRowCompact: { gap: 4 },
  progressTrack: { borderRadius: reedRadii.pill, height: 6, overflow: 'hidden' },
});

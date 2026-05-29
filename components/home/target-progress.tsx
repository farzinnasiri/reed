import { LinearGradient } from 'expo-linear-gradient';
import { View, StyleSheet } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
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
      <ProgressGradient ratio={slice.required > 0 ? slice.current / slice.required : 0} />
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
        end={{ x: 1, y: 0 }}
        locations={gradient.locations}
        start={{ x: 0, y: 0 }}
        style={[styles.progressFill, { width: `${clamped * 100}%` }]}
      />
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
        valueLabel: `${progress.current} / ${progress.required} ${target.rule.thresholdUnit} ${target.rule.cadence === 'daily' ? 'today' : 'this week'}`,
      },
      overall,
    ];
  }

  return [overall];
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
    b: parseInt(value.slice(4, 6), 16),
    g: parseInt(value.slice(2, 4), 16),
    r: parseInt(value.slice(0, 2), 16),
  };
}

const styles = StyleSheet.create({
  progressFill: { borderRadius: reedRadii.pill, height: '100%' },
  progressLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  progressRow: { gap: 6 },
  progressRowCompact: { gap: 4 },
  progressTrack: { borderRadius: reedRadii.pill, height: 8, overflow: 'hidden' },
});

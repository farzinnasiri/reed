import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import { ReedText } from '@/components/ui/reed-text';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedSheet } from '@/components/ui/reed-sheet';
import { DEFAULT_KG } from '@/components/reed/widgets/weight';
import { WeightStepper } from '@/components/reed/widgets/weight-stepper';
import * as haptics from '@/design/haptics';
import { useReedTheme } from '@/design/provider';
import { getTapScaleStyle } from '@/design/motion';
import { getLocalDayBounds } from '@/lib/local-day';
import { ProgressSection } from '../progress-section';
import { useFiveMinuteNow } from '../use-five-minute-now';
import { formatMetric } from '../profile-facts';
import { styles } from './profile.styles';
import { ProgressSkeleton, formatDate } from './progress-presentation';

type BodyWeightPoint = FunctionReturnType<typeof api.profiles.bodyWeightTrend>[number];
type LatestWeight = { observedAt: number; unit?: string; value: number } | null;

export function BodyWeightProgress({ latestWeight }: { latestWeight: LatestWeight }) {
  const series = useQuery(api.profiles.bodyWeightTrend, { rangeDays: 90 });
  const saveWeight = useMutation(api.profiles.upsertTodayBodyWeight);
  const [open, setOpen] = useState(false);
  return (
    <>
      <BodyWeightSurface latestWeight={latestWeight} series={series} onLogWeight={() => setOpen(true)} />
      <BodyWeightLogSheet
        latestWeight={latestWeight}
        visible={open}
        onClose={() => setOpen(false)}
        onSave={async (valueKg) => {
          const now = Date.now();
          const bounds = getLocalDayBounds(now);
          await saveWeight({ dayEndAt: bounds.endAt, dayStartAt: bounds.startAt, observedAt: now, valueKg });
        }}
      />
    </>
  );
}

function BodyWeightSurface({
  latestWeight,
  onLogWeight,
  series,
}: {
  latestWeight: { observedAt: number; unit?: string; value: number } | null;
  onLogWeight: () => void;
  series: BodyWeightPoint[] | undefined;
}) {
  const { theme } = useReedTheme();
  const now = useFiveMinuteNow();
  const trend = useMemo(() => summarizeBodyWeightTrend(series ?? [], now), [now, series]);
  const hasSeries = (series?.length ?? 0) >= 2;

  return (
    <ProgressSection meta="Trend signal, not a daily verdict." title="Bodyweight">
      <View style={styles.bodyWeightReadoutRow}>
        <View style={styles.bodyWeightReadout}>
          <ReedText style={styles.bodyWeightValue} variant="stat">
            {latestWeight ? formatMetric(latestWeight.value) : '—'}
          </ReedText>
          <ReedText tone="muted" variant="caption">
            kg
          </ReedText>
        </View>
        <View style={styles.bodyWeightTrendCopy}>
          <ReedText style={styles.bodyWeightTrendText} variant="bodyStrong">
            {trend.summary}
          </ReedText>
          <ReedText style={styles.bodyWeightTrendText} tone="muted" variant="caption">
            {latestWeight
              ? `Last logged ${formatDate(latestWeight.observedAt)}`
              : 'One quick log starts the trend.'}
          </ReedText>
        </View>
      </View>

      {series === undefined ? (
        <ProgressSkeleton />
      ) : hasSeries ? (
        <BodyWeightChart points={series} />
      ) : (
        <View style={[styles.bodyWeightEmptyChart, { borderColor: theme.colors.lineStrong }]}>
          <ReedText variant="bodyStrong">No trend yet</ReedText>
          <ReedText tone="muted" variant="caption">
            Log a few mornings. Reed will smooth the noise into a useful line.
          </ReedText>
        </View>
      )}

      <Pressable
        accessibilityLabel="Log bodyweight"
        onPress={onLogWeight}
        style={({ pressed }) => [
          styles.weightLogButton,
          { backgroundColor: theme.colors.accentSoft },
          getTapScaleStyle(pressed),
        ]}
      >
        <Ionicons color={String(theme.colors.accentInk)} name="add" size={18} />
        <ReedText tone="accent" variant="bodyStrong">
          Log weight
        </ReedText>
      </Pressable>
    </ProgressSection>
  );
}

function BodyWeightChart({ points }: { points: BodyWeightPoint[] }) {
  const { theme } = useReedTheme();
  const width = 320;
  const height = 136;
  const paddingX = 10;
  const paddingY = 22;
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = Math.max(1, maxValue - minValue);
  const startAt = points[0]?.observedAt ?? 0;
  const endAt = points[points.length - 1]?.observedAt ?? startAt;
  const timeSpan = Math.max(1, endAt - startAt);
  const coords = points.map((point) => {
    const x = paddingX + ((point.observedAt - startAt) / timeSpan) * (width - paddingX * 2);
    const y = paddingY + (1 - (point.value - minValue) / valueSpan) * (height - paddingY * 2);
    return { ...point, x, y };
  });
  const path = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const averageY = paddingY + (1 - (average - minValue) / valueSpan) * (height - paddingY * 2);
  const first = coords[0];
  const latest = coords[coords.length - 1];
  const peak = coords.reduce((best, point) => (point.value > best.value ? point : best), coords[0]);
  const valueLabels = dedupeChartLabels([
    { label: `${formatMetric(peak.value)}kg`, x: peak.x, y: peak.y - 10 },
    { label: `${formatMetric(first.value)}kg`, x: first.x, y: height - 6 },
    { label: `${formatMetric(latest.value)}kg`, x: latest.x, y: height - 6, anchor: 'end' as const },
  ]);
  const averageLabel = {
    value: `${formatMetric(average)}kg`,
    label: 'avg',
    x: width - paddingX,
    y: Math.max(17, averageY - 7),
    anchor: 'end' as const,
  };

  return (
    <View style={styles.bodyWeightChartWrap}>
      <Svg height={height} preserveAspectRatio="none" width="100%" viewBox={`0 0 ${width} ${height}`}>
        <Line
          stroke={String(theme.colors.line)}
          strokeDasharray="5 7"
          strokeWidth={1}
          x1={paddingX}
          x2={width - paddingX}
          y1={averageY}
          y2={averageY}
        />
        <Path
          d={path}
          fill="none"
          stroke={String(theme.colors.accent)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
        />
        {coords.map((point, index) => (
          <Circle
            cx={point.x}
            cy={point.y}
            fill={String(index === coords.length - 1 ? theme.colors.accent : theme.colors.surface)}
            key={point._id}
            r={index === coords.length - 1 ? 4.5 : 3}
            stroke={String(theme.colors.accent)}
            strokeWidth={1.5}
          />
        ))}
        <SvgText
          fill={String(theme.colors.ink)}
          fontFamily="Figtree_600SemiBold"
          fontSize={10}
          textAnchor={averageLabel.anchor}
          x={Math.min(width - paddingX, Math.max(paddingX, averageLabel.x))}
          y={Math.min(height - 12, Math.max(10, averageLabel.y))}
        >
          {averageLabel.value}
        </SvgText>
        <SvgText
          fill={String(theme.colors.inkMuted)}
          fontFamily="Figtree_600SemiBold"
          fontSize={8}
          textAnchor={averageLabel.anchor}
          x={Math.min(width - paddingX, Math.max(paddingX, averageLabel.x))}
          y={Math.min(height - 3, Math.max(18, averageLabel.y + 9))}
        >
          {averageLabel.label}
        </SvgText>
        {valueLabels.map((item) => (
          <SvgText
            fill={String(theme.colors.inkMuted)}
            fontFamily="Figtree_600SemiBold"
            fontSize={9}
            key={`${item.label}-${item.x.toFixed(1)}-${item.y.toFixed(1)}`}
            textAnchor={item.anchor ?? 'start'}
            x={Math.min(width - paddingX, Math.max(paddingX, item.x))}
            y={Math.min(height - 4, Math.max(10, item.y))}
          >
            {item.label}
          </SvgText>
        ))}
      </Svg>
      <View style={styles.bodyWeightChartLabels}>
        <ReedText tone="muted" variant="caption">
          {formatDate(startAt)}
        </ReedText>
        <ReedText tone="muted" variant="caption">
          {formatDate(endAt)}
        </ReedText>
      </View>
    </View>
  );
}

function dedupeChartLabels(labels: Array<{ anchor?: 'start' | 'end'; label: string; x: number; y: number }>) {
  const kept: Array<{ anchor?: 'start' | 'end'; label: string; x: number; y: number }> = [];
  for (const label of labels) {
    const overlaps = kept.some(
      (existing) => Math.abs(existing.x - label.x) < 34 && Math.abs(existing.y - label.y) < 12,
    );
    if (!overlaps) kept.push(label);
  }
  return kept;
}

/**
 * Log weight, as a bottom sheet like the rest of the app and with the same stepper as the weigh-in
 * on home. Saving replaces today's manual log, then the sheet closes.
 */
function BodyWeightLogSheet({
  latestWeight,
  onClose,
  onSave,
  visible,
}: {
  latestWeight: { observedAt: number; value: number } | null;
  onClose: () => void;
  onSave: (valueKg: number) => Promise<void>;
  visible: boolean;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);

  return (
    <ReedSheet open={visible} ref={sheetRef} onDismiss={onClose}>
      <WeightLog latestWeight={latestWeight} onDone={() => sheetRef.current?.dismiss()} onSave={onSave} />
    </ReedSheet>
  );
}

// Mounted only while the sheet is open, so every opening starts from the latest weight.
function WeightLog({ latestWeight, onDone, onSave }: {
  latestWeight: { observedAt: number; value: number } | null;
  onDone: () => void;
  onSave: (valueKg: number) => Promise<void>;
}) {
  const { theme } = useReedTheme();
  const [valueKg, setValueKg] = useState(latestWeight?.value ?? DEFAULT_KG);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function save() {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSave(valueKg);
      haptics.success();
      onDone();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.xs }}>
      <View style={{ gap: theme.spacing.xxs }}>
        <ReedText variant="title">Log weight</ReedText>
        <ReedText tone="muted" variant="caption">Today’s value replaces today’s manual log.</ReedText>
      </View>
      <WeightStepper onChange={setValueKg} valueKg={valueKg} />
      {latestWeight ? (
        <ReedText tone="muted" variant="caption">
          Last: {formatMetric(latestWeight.value)} kg · {formatDate(latestWeight.observedAt)}
        </ReedText>
      ) : null}
      {errorMessage ? <ReedText accessibilityLiveRegion="polite" tone="danger" variant="caption">{errorMessage}</ReedText> : null}
      <ReedButton disabled={isSaving} label={isSaving ? 'Saving…' : 'Save'} onPress={() => void save()} variant="primary" />
    </View>
  );
}

function summarizeBodyWeightTrend(points: BodyWeightPoint[], now: number) {
  const sorted = [...points].sort((left, right) => left.observedAt - right.observedAt);
  if (sorted.length < 2) {
    return { deltaKg: null, summary: 'Needs a few logs' };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const medianGapDays = getMedianBodyLogGapDays(sorted);
  const latestAgeDays = Math.floor((now - last.observedAt) / (24 * 60 * 60 * 1000));

  if (latestAgeDays >= 21) {
    return { deltaKg: null, summary: `Last logged ${formatDate(last.observedAt)}` };
  }

  if (sorted.length >= 6 && medianGapDays <= 3) {
    return summarizeBodyAverageShift(sorted, 3);
  }

  if (sorted.length >= 4 && medianGapDays <= 8) {
    return summarizeBodyAverageShift(sorted, 2);
  }

  const deltaKg = roundDisplay(last.value - first.value);
  if (sorted.length === 2) {
    return { deltaKg, summary: `${formatBodyDelta(deltaKg)} since ${formatDate(first.observedAt)}` };
  }

  return { deltaKg, summary: `${formatBodyDelta(deltaKg)} since ${formatDate(first.observedAt)}` };
}

function summarizeBodyAverageShift(points: BodyWeightPoint[], windowSize: number) {
  const recent = points.slice(-windowSize);
  const prior = points.slice(-windowSize * 2, -windowSize);
  const deltaKg = roundDisplay(averageBodyWeight(recent) - averageBodyWeight(prior));
  if (Math.abs(deltaKg) < 0.2) {
    return { deltaKg, summary: 'Holding steady' };
  }
  return { deltaKg, summary: `${formatBodyDelta(deltaKg)} recently` };
}

function getMedianBodyLogGapDays(points: BodyWeightPoint[]) {
  const gaps = points
    .slice(1)
    .map((point, index) => (point.observedAt - points[index].observedAt) / (24 * 60 * 60 * 1000))
    .sort((left, right) => left - right);
  return gaps[Math.floor(gaps.length / 2)] ?? Number.POSITIVE_INFINITY;
}

function averageBodyWeight(points: BodyWeightPoint[]) {
  return points.reduce((sum, point) => sum + point.value, 0) / Math.max(1, points.length);
}

function formatBodyDelta(deltaKg: number) {
  if (Math.abs(deltaKg) < 0.2) return 'stable';
  return `${deltaKg > 0 ? '+' : ''}${formatMetric(deltaKg)} kg`;
}

function roundDisplay(value: number) {
  return Math.round(value * 10) / 10;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Could not save. Try again.';
}

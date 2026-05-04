import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { AnalyticsDonut } from '@/components/ui/analytics-donut';
import { getGlassScrimTokens } from '@/components/ui/glass-material';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { createTiming, getTapScaleStyle, reedEasing, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { workoutSemanticPalette } from '@/design/system';
import { styles } from './workout-session-insights.styles';
import type { LiveSessionFullInsights, LiveSessionSummary } from './workout-surface.types';
import {
  formatClock,
  formatCompactDistance,
  formatCompactLoad,
  formatCompactMinutes,
  formatCompactNumber,
} from './workout-surface.utils';

type WorkoutSessionInsightsSheetProps = {
  fullInsights: LiveSessionFullInsights;
  isOpen: boolean;
  onClose: () => void;
  summary: LiveSessionSummary;
};

type SessionMaturity = 'early' | 'mature' | 'mid';
type SnapshotTileModel = {
  icon: keyof typeof Ionicons.glyphMap;
  key: string;
  label: string;
  subLabel?: string;
  value: string;
};
type MuscleBreakdownMetric = 'reps' | 'sets' | 'volume';
type MuscleBreakdownRow = {
  groupId: string;
  label: string;
  loadKg: number;
  reps: number;
  setCount: number;
};
type StackedShapeRow = {
  color: string;
  key: string;
  label: string;
  ratio: number;
};
type PrHighlightRow = {
  label: string;
  meta: string;
  type: 'load' | 'output' | 'rep' | 'volume';
  typeLabel: string;
};

const SUMMARY_SHEET_RATIO = 0.58;
const FULL_SHEET_RATIO = 0.92;
const DRAG_START_THRESHOLD_Y = 8;
const COLLAPSED_DRAG_MIN_Y = -140;
const COLLAPSED_DRAG_MAX_Y = 220;
const EXPANDED_DRAG_MIN_Y = -160;
const EXPANDED_DRAG_MAX_Y = 180;
const EXPAND_DRAG_THRESHOLD_Y = -48;
const DISMISS_DRAG_THRESHOLD_Y = 72;

export function WorkoutSessionInsightsSheet({
  fullInsights,
  isOpen,
  onClose,
  summary,
}: WorkoutSessionInsightsSheetProps) {
  const { theme } = useReedTheme();
  const scrim = getGlassScrimTokens(theme);
  const frostedSheetSurfaceStyle = useMemo(
    () => ({
      backgroundColor: theme.mode === 'dark' ? 'rgba(24, 24, 27, 0.76)' : 'rgba(255, 255, 255, 0.72)',
      borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.78)',
    }),
    [theme.mode],
  );
  const { height } = useWindowDimensions();
  const openProgress = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const expandProgress = useRef(new Animated.Value(0)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [muscleMetricMode, setMuscleMetricMode] = useState<MuscleBreakdownMetric>('sets');

  const maturity = useMemo<SessionMaturity>(() => getSessionMaturity(summary.output.completedSets), [summary.output.completedSets]);
  const isEarly = maturity === 'early';

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      requestAnimationFrame(() => {
        createTiming(openProgress, 1, reedMotion.durations.mode, reedEasing.easeOut, false).start();
      });
      return;
    }

    createTiming(openProgress, 0, reedMotion.durations.mode, reedEasing.easeInOut, false).start(({ finished }) => {
      if (!finished) {
        return;
      }
      setIsMounted(false);
      setIsExpanded(false);
      expandProgress.setValue(0);
      dragOffset.setValue(0);
    });
  }, [dragOffset, expandProgress, isOpen, openProgress]);

  useEffect(() => {
    createTiming(expandProgress, isExpanded ? 1 : 0, reedMotion.durations.mode, reedEasing.easeOut, false).start();
  }, [expandProgress, isExpanded]);

  const sheetHeight = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [height * SUMMARY_SHEET_RATIO, height * FULL_SHEET_RATIO],
  });
  const openTranslateY = openProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });
  const overlayOpacity = openProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const panelStyle = useMemo(
    () => ({
      height: sheetHeight,
      transform: [{ translateY: Animated.add(openTranslateY, dragOffset) }],
    }),
    [dragOffset, openTranslateY, sheetHeight],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > DRAG_START_THRESHOLD_Y,
        onPanResponderMove: (_, gestureState) => {
          const nextOffset = isExpanded
            ? Math.max(EXPANDED_DRAG_MIN_Y, Math.min(EXPANDED_DRAG_MAX_Y, gestureState.dy))
            : Math.max(COLLAPSED_DRAG_MIN_Y, Math.min(COLLAPSED_DRAG_MAX_Y, gestureState.dy));
          dragOffset.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gestureState) => {
          // Expanding should require less travel than dismissal, because closing
          // from a half-open sheet is the more destructive gesture.
          const draggedUp = gestureState.dy < EXPAND_DRAG_THRESHOLD_Y;
          const draggedDown = gestureState.dy > DISMISS_DRAG_THRESHOLD_Y;

          if (draggedUp) {
            setIsExpanded(true);
          } else if (draggedDown && isExpanded) {
            setIsExpanded(false);
          } else if (draggedDown) {
            onClose();
          }

          createTiming(dragOffset, 0, reedMotion.durations.standard, reedEasing.easeOut).start();
        },
        onPanResponderTerminate: () => {
          createTiming(dragOffset, 0, reedMotion.durations.standard, reedEasing.easeOut).start();
        },
      }),
    [dragOffset, isExpanded, onClose],
  );

  const snapshotTiles = getSnapshotTiles(summary);
  const modalityBreakdownRows = getModalityBreakdownRows(fullInsights.modalityBreakdown.buckets);
  const coarseMuscleShapeRows = getCoarseMuscleShapeRows(summary);
  const muscleBreakdownRows = useMemo(
    () =>
      [...summary.distribution.byGranularMuscleGroup]
        .filter(group => getMuscleMetricValue(group, muscleMetricMode) > 0)
        .sort((left, right) => {
          const diff = getMuscleMetricValue(right, muscleMetricMode) - getMuscleMetricValue(left, muscleMetricMode);
          if (diff !== 0) {
            return diff;
          }
          return left.label.localeCompare(right.label);
        }),
    [muscleMetricMode, summary.distribution.byGranularMuscleGroup],
  );
  const muscleBreakdownShare = useMemo(
    () => getNormalizedShareByMetric(muscleBreakdownRows, muscleMetricMode),
    [muscleBreakdownRows, muscleMetricMode],
  );
  const muscleBreakdownTotal = useMemo(
    () => muscleBreakdownRows.reduce((sum, row) => sum + getMuscleMetricValue(row, muscleMetricMode), 0),
    [muscleBreakdownRows, muscleMetricMode],
  );
  const muscleBreakdownSegments = useMemo(
    () =>
      muscleBreakdownRows.map(row => ({
        color: getGranularMuscleGroupSemanticColor(row.groupId),
        groupId: row.groupId,
        label: row.label,
        percent: muscleBreakdownShare.get(row.groupId) ?? 0,
        value: getMuscleMetricValue(row, muscleMetricMode),
      })),
    [muscleBreakdownRows, muscleBreakdownShare, muscleMetricMode],
  );
  const prHighlights = getPrHighlights(fullInsights);
  const mostDemandingExercise = summary.highlights.mostDemandingExercise;
  if (!isMounted) {
    return null;
  }

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible={isMounted}>
      <View style={styles.sessionInsightsOverlay}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: scrim.backgroundColor,
              opacity: overlayOpacity,
              pointerEvents: 'none',
            },
          ]}
        />
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />

        <Animated.View style={[styles.sessionInsightsFrame, panelStyle]}>
          <GlassSurface
            contentStyle={styles.sessionInsightsContent}
            style={[styles.sessionInsightsPanel, frostedSheetSurfaceStyle]}
          >
            <View {...panResponder.panHandlers} style={styles.sessionInsightsHandleArea}>
              <View style={styles.sessionInsightsHandle} />
            </View>

            <View style={styles.sessionInsightsHeader}>
              <View style={styles.sessionInsightsHeaderCopy}>
                <ReedText variant="section">Session insights</ReedText>
              </View>

              <View style={styles.sessionInsightsHeaderActions}>
                <Pressable
                  accessibilityLabel={isExpanded ? 'Collapse insights' : 'Expand insights'}
                  onPress={() => setIsExpanded(current => !current)}
                  style={({ pressed }) => [styles.sheetClose, getTapScaleStyle(pressed)]}
                >
                  <Ionicons
                    color={String(theme.colors.textMuted)}
                    name={isExpanded ? 'contract-outline' : 'expand-outline'}
                    size={18}
                  />
                </Pressable>
                <Pressable onPress={onClose} style={({ pressed }) => [styles.sheetClose, getTapScaleStyle(pressed)]}>
                  <Ionicons color={String(theme.colors.textMuted)} name="close" size={18} />
                </Pressable>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.sessionInsightsScrollContent}
              showsVerticalScrollIndicator={false}
              style={styles.sessionInsightsScroll}
            >
              <View style={styles.sessionInsightsSnapshotBlock}>
                <ReedText variant="bodyStrong">Snapshot</ReedText>
                <View style={styles.sessionInsightsSnapshotGrid}>
                  {snapshotTiles.map(tile => (
                    <SnapshotTile
                      key={tile.key}
                      icon={tile.icon}
                      label={tile.label}
                      subLabel={tile.subLabel}
                      value={tile.value}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.sessionInsightsSectionBlock}>
                <ReedText variant="bodyStrong">Session shape</ReedText>
                <ReedText tone="muted" variant="caption">
                  Modality mix
                </ReedText>
                <View
                  style={[
                    styles.sessionInsightsShapeStack,
                    { backgroundColor: theme.colors.controlBorder },
                  ]}
                >
                  {modalityBreakdownRows.length > 0
                    ? modalityBreakdownRows.map(row => (
                        <View
                          key={row.key}
                          style={[
                            styles.sessionInsightsShapeStackSegment,
                            {
                              backgroundColor: row.color,
                              flex: Math.max(row.ratio, 0.0001),
                            },
                          ]}
                        >
                          {row.ratio >= 10 ? (
                            <ReedText style={styles.sessionInsightsShapeStackText} variant="caption">
                              {row.ratio}%
                            </ReedText>
                          ) : null}
                        </View>
                      ))
                    : (
                        <View style={styles.sessionInsightsShapeStackSegmentEmpty}>
                          <ReedText tone="muted" variant="caption">
                            No data
                          </ReedText>
                        </View>
                      )}
                </View>
                <View style={styles.sessionInsightsShapeLegend}>
                  {modalityBreakdownRows.map(row => (
                    <View key={`legend-${row.key}`} style={styles.sessionInsightsShapeLegendItem}>
                      <View style={[styles.sessionInsightsShapeLegendDot, { backgroundColor: row.color }]} />
                      <ReedText style={styles.sessionInsightsShapeLegendText} tone="muted" variant="caption">
                        {row.label} {row.ratio}%
                      </ReedText>
                    </View>
                  ))}
                </View>

                {coarseMuscleShapeRows.length > 0 ? (
                  <>
                    <ReedText tone="muted" variant="caption">
                      Muscle umbrella
                    </ReedText>
                    <View
                      style={[
                        styles.sessionInsightsShapeStack,
                        { backgroundColor: theme.colors.controlBorder },
                      ]}
                    >
                      {coarseMuscleShapeRows.map(row => (
                        <View
                          key={`coarse-shape-${row.key}`}
                          style={[
                            styles.sessionInsightsShapeStackSegment,
                            {
                              backgroundColor: row.color,
                              flex: Math.max(row.ratio, 0.0001),
                            },
                          ]}
                        >
                          {row.ratio >= 12 ? (
                            <ReedText style={styles.sessionInsightsShapeStackText} variant="caption">
                              {row.ratio}%
                            </ReedText>
                          ) : null}
                        </View>
                      ))}
                    </View>
                    <View style={styles.sessionInsightsShapeLegend}>
                      {coarseMuscleShapeRows.map(row => (
                        <View key={`coarse-legend-${row.key}`} style={styles.sessionInsightsShapeLegendItem}>
                          <View style={[styles.sessionInsightsShapeLegendDot, { backgroundColor: row.color }]} />
                          <ReedText style={styles.sessionInsightsShapeLegendText} tone="muted" variant="caption">
                            {row.label} {row.ratio}%
                          </ReedText>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                {isEarly ? (
                  <ReedText tone="muted" variant="caption">
                    Shape will stabilize after a few more logged sets.
                  </ReedText>
                ) : null}
              </View>

              <View style={styles.sessionInsightsSectionBlock}>
                <ReedText variant="bodyStrong">Muscle groups</ReedText>
                <View style={styles.sessionInsightsBreakdownControlsRow}>
                  <View
                    style={[
                      styles.sessionInsightsBreakdownMetricSwitch,
                      {
                        backgroundColor: theme.colors.controlFill,
                        borderColor: theme.colors.controlBorder,
                      },
                    ]}
                  >
                    {(['sets', 'reps', 'volume'] as MuscleBreakdownMetric[]).map(mode => (
                      <Pressable
                        key={mode}
                        onPress={() => setMuscleMetricMode(mode)}
                        style={({ pressed }) => [
                          styles.sessionInsightsBreakdownMetricOption,
                          mode === muscleMetricMode
                            ? { backgroundColor: theme.colors.controlActiveFill }
                            : null,
                          getTapScaleStyle(pressed),
                        ]}
                      >
                        <ReedText
                          style={styles.sessionInsightsBreakdownMetricOptionText}
                          tone={mode === muscleMetricMode ? 'default' : 'muted'}
                          variant="caption"
                        >
                          {mode === 'sets' ? 'Sets' : mode === 'reps' ? 'Reps' : 'Volume'}
                        </ReedText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {muscleBreakdownSegments.length > 0 ? (
                  <View style={styles.sessionInsightsBreakdownRow}>
                    <SessionMuscleDonut
                      segments={muscleBreakdownSegments.map(segment => ({
                        color: segment.color,
                        id: segment.groupId,
                        percent: segment.percent,
                      }))}
                      subtitle={muscleMetricMode === 'sets' ? 'sets' : muscleMetricMode === 'reps' ? 'reps' : 'volume'}
                      value={formatMuscleMetricSummaryValue(muscleMetricMode, muscleBreakdownTotal)}
                    />
                    <View style={styles.sessionInsightsBreakdownLegend}>
                      {muscleBreakdownSegments.slice(0, 6).map(segment => (
                        <View key={`muscle-legend-${segment.groupId}`} style={styles.sessionInsightsBreakdownLegendRow}>
                          <View style={[styles.sessionInsightsBreakdownLegendDot, { backgroundColor: segment.color }]} />
                          <ReedText style={styles.sessionInsightsBreakdownLegendLabel} variant="caption">
                            {segment.label}
                          </ReedText>
                          <ReedText style={styles.sessionInsightsBreakdownLegendValue} tone="muted" variant="caption">
                            {segment.percent}% ({formatMuscleMetricLegendValue(muscleMetricMode, segment.value)})
                          </ReedText>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.sessionInsightsBreakdownEmpty,
                      { borderColor: theme.colors.controlBorder },
                    ]}
                  >
                    <ReedText tone="muted" variant="caption">
                      No muscle group data yet
                    </ReedText>
                  </View>
                )}
              </View>

              {!isEarly ? (
                <View style={styles.sessionInsightsSectionBlock}>
                  <ReedText variant="bodyStrong">Intensity & recovery</ReedText>
                  <View style={styles.sessionInsightsMetricGrid}>
                    <MetricTile label="Avg RPE" value={summary.intensity.averageRpe === null ? '—' : summary.intensity.averageRpe.toFixed(1)} />
                    <MetricTile label="Max RPE" value={summary.intensity.highestRpe === null ? '—' : summary.intensity.highestRpe.toFixed(1)} />
                    <MetricTile label="Avg rest" value={summary.recovery.averageRestSeconds === null ? '—' : formatClock(summary.recovery.averageRestSeconds)} />
                    <MetricTile label="Total rest" value={summary.recovery.totalRestSeconds > 0 ? formatCompactMinutes(summary.recovery.totalRestSeconds) : '—'} />
                  </View>
                </View>
              ) : null}

              <View style={styles.sessionInsightsSectionBlock}>
                <ReedText variant="bodyStrong">Highlights</ReedText>
                <View
                  style={[
                    styles.sessionInsightsHighlightsSummaryShell,
                    {
                      backgroundColor: theme.colors.controlFill,
                      borderColor: theme.colors.controlBorder,
                    },
                  ]}
                >
                  <View style={styles.sessionInsightsHighlightsSummaryCell}>
                    <Ionicons color="#d97706" name="trophy-outline" size={15} />
                    <ReedText style={styles.sessionInsightsHighlightsSummaryLabel} tone="muted" variant="caption">
                      PRs
                    </ReedText>
                    <ReedText style={styles.sessionInsightsHighlightsSummaryValue} variant="section">
                      {summary.highlights.prCount}
                    </ReedText>
                  </View>

                  <View
                    style={[
                      styles.sessionInsightsHighlightsSummaryDivider,
                      { backgroundColor: theme.colors.controlBorder },
                    ]}
                  />

                  <View style={styles.sessionInsightsHighlightsSummaryCell}>
                    <Ionicons color="#f59e0b" name="star-outline" size={15} />
                    <ReedText style={styles.sessionInsightsHighlightsSummaryLabel} tone="muted" variant="caption">
                      Near PRs
                    </ReedText>
                    <ReedText style={styles.sessionInsightsHighlightsSummaryValue} variant="section">
                      {summary.highlights.nearPrCount}
                    </ReedText>
                  </View>

                  <View
                    style={[
                      styles.sessionInsightsHighlightsSummaryDivider,
                      { backgroundColor: theme.colors.controlBorder },
                    ]}
                  />

                  <View style={styles.sessionInsightsHighlightsSummaryCell}>
                    <Ionicons color="#ea580c" name="flame-outline" size={15} />
                    <ReedText style={styles.sessionInsightsHighlightsSummaryLabel} tone="muted" variant="caption">
                      Most demanding
                    </ReedText>
                    <ReedText
                      numberOfLines={1}
                      style={styles.sessionInsightsHighlightsSummaryMostDemanding}
                      variant="bodyStrong"
                    >
                      {mostDemandingExercise?.exerciseName ?? '—'}
                    </ReedText>
                    {mostDemandingExercise ? (
                      <ReedText
                        numberOfLines={1}
                        style={styles.sessionInsightsHighlightsSummaryMostDemandingMeta}
                        tone="muted"
                        variant="caption"
                      >
                        ({mostDemandingExercise.averageRpe.toFixed(1)} RPE)
                      </ReedText>
                    ) : null}
                  </View>
                </View>

                {isExpanded ? (
                  prHighlights.length > 0 ? (
                    <View style={styles.sessionInsightsList}>
                      {prHighlights.map(entry => (
                        <View
                          key={`pr-${entry.label}-${entry.typeLabel}`}
                          style={styles.sessionInsightsHighlightRow}
                        >
                          <View style={styles.sessionInsightsListCopy}>
                            <ReedText variant="bodyStrong">{entry.label}</ReedText>
                            <ReedText tone="muted" variant="caption">
                              {entry.meta}
                            </ReedText>
                          </View>
                          <ReedText
                            style={[
                              styles.sessionInsightsHighlightTypeText,
                              {
                                color: getPrTypeColor(entry.type),
                              },
                            ]}
                            variant="caption"
                          >
                            {entry.typeLabel}
                          </ReedText>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <ReedText tone="muted" variant="caption">
                      PR highlights will appear as this session hits prior records.
                    </ReedText>
                  )
                ) : null}
              </View>

              {isExpanded ? (
                <>
                  <View style={styles.sessionInsightsSectionBlock}>
                    <ReedText variant="bodyStrong">Intensity analysis</ReedText>
                    <View style={styles.sessionInsightsStatList}>
                      <MetricRow
                        label="Average RPE"
                        value={fullInsights.intensityAnalysis.averageRpe === null ? '—' : fullInsights.intensityAnalysis.averageRpe.toFixed(1)}
                      />
                      <MetricRow
                        label="Highest RPE"
                        value={fullInsights.intensityAnalysis.highestRpe === null ? '—' : fullInsights.intensityAnalysis.highestRpe.toFixed(1)}
                      />
                      <MetricRow
                        label="Density"
                        value={fullInsights.exerciseMap.setsPerHour === null ? '—' : `${formatCompactNumber(fullInsights.exerciseMap.setsPerHour)} sets/h`}
                      />
                    </View>
                  </View>

                  <View style={styles.sessionInsightsSectionBlock}>
                    <ReedText variant="bodyStrong">Recovery analysis</ReedText>
                    <View style={styles.sessionInsightsStatList}>
                      <MetricRow
                        label="Longest rest"
                        value={fullInsights.recoveryAnalysis.longestRestSeconds ? formatClock(fullInsights.recoveryAnalysis.longestRestSeconds) : '—'}
                      />
                      <MetricRow
                        label="Shortest rest"
                        value={fullInsights.recoveryAnalysis.shortestRestSeconds ? formatClock(fullInsights.recoveryAnalysis.shortestRestSeconds) : '—'}
                      />
                      <MetricRow
                        label="Average rest"
                        value={fullInsights.recoveryAnalysis.averageRestSeconds ? formatClock(fullInsights.recoveryAnalysis.averageRestSeconds) : '—'}
                      />
                    </View>
                  </View>
                </>
              ) : null}
            </ScrollView>
          </GlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

function getPrHighlights(fullInsights: LiveSessionFullInsights) {
  const rows: PrHighlightRow[] = fullInsights.performance.prExercises.map(name => {
    const topSet = fullInsights.performance.topSets.find(entry => entry.exerciseName === name);
    const summary = topSet?.summary ?? 'Peak set in this session';
    const type = getSimplePrType(summary);
    return {
      label: name,
      meta: summary,
      type,
      typeLabel: getSimplePrTypeLabel(type),
    };
  });

  return rows.slice(0, 8);
}

function getSimplePrType(summary: string): PrHighlightRow['type'] {
  const normalized = summary.toLowerCase();

  if ((normalized.includes('x') || normalized.includes('×')) && normalized.includes('kg')) {
    return 'volume';
  }

  if (normalized.includes('kg')) {
    return 'load';
  }

  if (normalized.includes('rep')) {
    return 'rep';
  }

  return 'output';
}

function getSimplePrTypeLabel(type: PrHighlightRow['type']) {
  switch (type) {
    case 'volume':
      return 'Volume PR';
    case 'load':
      return 'Load PR';
    case 'rep':
      return 'Rep PR';
    default:
      return 'Output PR';
  }
}

function getPrTypeColor(type: PrHighlightRow['type']) {
  switch (type) {
    case 'volume':
      return workoutSemanticPalette.prTypes.volume;
    case 'load':
      return workoutSemanticPalette.prTypes.load;
    case 'rep':
      return workoutSemanticPalette.prTypes.rep;
    default:
      return workoutSemanticPalette.prTypes.output;
  }
}

function getSessionMaturity(completedSets: number): SessionMaturity {
  if (completedSets < 3) {
    return 'early';
  }
  if (completedSets < 10) {
    return 'mid';
  }
  return 'mature';
}

function getBreakdownColor(bucketKey: LiveSessionFullInsights['modalityBreakdown']['buckets'][number]['key']) {
  switch (bucketKey) {
    case 'load':
      return workoutSemanticPalette.modalities.load;
    case 'holds':
      return workoutSemanticPalette.modalities.holds;
    case 'cardio':
      return workoutSemanticPalette.modalities.cardio;
    default:
      return workoutSemanticPalette.modalities.neutral;
  }
}

function getSnapshotTiles(summary: LiveSessionSummary) {
  const tiles: SnapshotTileModel[] = [
    {
      icon: 'barbell-outline',
      key: 'sets',
      label: 'Sets',
      value: `${summary.output.completedSets}`,
    },
    {
      icon: 'speedometer-outline',
      key: 'avg',
      label: 'Avg RPE',
      value: summary.intensity.averageRpe === null ? '—' : summary.intensity.averageRpe.toFixed(1),
    },
    {
      icon: 'time-outline',
      key: 'rest',
      label: 'Total rest',
      value: summary.recovery.totalRestSeconds > 0 ? formatClock(summary.recovery.totalRestSeconds) : '—',
    },
  ];

  const outputTile: SnapshotTileModel =
    summary.output.totalLoadKg > 0
      ? {
          icon: 'bag-handle-outline' as const,
          key: 'load',
          label: 'Load (kg)',
          value: Math.round(summary.output.totalLoadKg).toLocaleString('en-US'),
        }
      : summary.output.totalDistanceKm > 0
        ? {
            icon: 'walk-outline' as const,
            key: 'distance',
            label: 'Distance (km)',
            value: formatCompactNumber(summary.output.totalDistanceKm, 1),
          }
        : summary.output.totalHoldSeconds > 0
          ? {
              icon: 'timer-outline' as const,
              key: 'hold',
              label: 'Hold',
              value: formatCompactMinutes(summary.output.totalHoldSeconds),
            }
          : {
              icon: 'pulse-outline' as const,
              key: 'output',
              label: 'Output',
              value: '—',
            };

  return [tiles[0], outputTile, tiles[1], tiles[2]];
}

function getModalityBreakdownRows(
  buckets: LiveSessionFullInsights['modalityBreakdown']['buckets'],
): StackedShapeRow[] {
  const byKey = new Map(buckets.map(bucket => [bucket.key, bucket]));
  const ordered: StackedShapeRow[] = [
    {
      color: getBreakdownColor('load'),
      key: 'load',
      label: 'Strength',
      ratio: byKey.get('load')?.ratio ?? 0,
    },
    {
      color: getBreakdownColor('holds'),
      key: 'holds',
      label: 'Holds',
      ratio: byKey.get('holds')?.ratio ?? 0,
    },
    {
      color: getBreakdownColor('cardio'),
      key: 'cardio',
      label: 'Cardio',
      ratio: byKey.get('cardio')?.ratio ?? 0,
    },
  ];

  const visible = ordered.filter(row => row.ratio > 0);
  if (visible.length === 0) {
    return ordered;
  }

  return [...visible].sort((left, right) => right.ratio - left.ratio);
}

function getCoarseMuscleShapeRows(summary: LiveSessionSummary): StackedShapeRow[] {
  const baseRows = summary.distribution.byMuscleGroup
    .filter(group => group.groupId !== 'other' && group.setCount > 0)
    .sort((left, right) => right.setCount - left.setCount)
    .map(group => ({
      color: getCoarseMuscleGroupSemanticColor(group.groupId),
      key: group.groupId,
      label: group.label,
      setCount: group.setCount,
    }));
  const normalized = getNormalizedPercentagesByCount(baseRows);

  return baseRows.map(row => ({
    color: row.color,
    key: row.key,
    label: row.label,
    ratio: normalized.get(row.key) ?? 0,
  }));
}

function getCoarseMuscleGroupSemanticColor(groupId: string) {
  if (groupId === 'arms') {
    return workoutSemanticPalette.muscleGroups.arms;
  }

  if (groupId === 'back') {
    return workoutSemanticPalette.muscleGroups.back;
  }

  if (groupId === 'cardio') {
    return workoutSemanticPalette.muscleGroups.cardio;
  }

  if (groupId === 'chest') {
    return workoutSemanticPalette.muscleGroups.chest;
  }

  if (groupId === 'core') {
    return workoutSemanticPalette.muscleGroups.core;
  }

  if (groupId === 'legs') {
    return workoutSemanticPalette.muscleGroups.legs;
  }

  if (groupId === 'shoulders') {
    return workoutSemanticPalette.muscleGroups.shoulders;
  }

  return workoutSemanticPalette.muscleGroups.other;
}

function getGranularMuscleGroupSemanticColor(groupId: string) {
  if (groupId === 'adductors') {
    return workoutSemanticPalette.granularMuscleGroups.adductors;
  }

  if (groupId === 'biceps') {
    return workoutSemanticPalette.granularMuscleGroups.biceps;
  }

  if (groupId === 'calves') {
    return workoutSemanticPalette.granularMuscleGroups.calves;
  }

  if (groupId === 'cardio') {
    return workoutSemanticPalette.granularMuscleGroups.cardio;
  }

  if (groupId === 'chest') {
    return workoutSemanticPalette.granularMuscleGroups.chest;
  }

  if (groupId === 'core') {
    return workoutSemanticPalette.granularMuscleGroups.core;
  }

  if (groupId === 'forearms') {
    return workoutSemanticPalette.granularMuscleGroups.forearms;
  }

  if (groupId === 'glutes') {
    return workoutSemanticPalette.granularMuscleGroups.glutes;
  }

  if (groupId === 'hamstrings') {
    return workoutSemanticPalette.granularMuscleGroups.hamstrings;
  }

  if (groupId === 'lats') {
    return workoutSemanticPalette.granularMuscleGroups.lats;
  }

  if (groupId === 'quads') {
    return workoutSemanticPalette.granularMuscleGroups.quads;
  }

  if (groupId === 'shoulders') {
    return workoutSemanticPalette.granularMuscleGroups.shoulders;
  }

  if (groupId === 'traps') {
    return workoutSemanticPalette.granularMuscleGroups.traps;
  }

  if (groupId === 'triceps') {
    return workoutSemanticPalette.granularMuscleGroups.triceps;
  }

  if (groupId === 'upperBack') {
    return workoutSemanticPalette.granularMuscleGroups.upperBack;
  }

  return workoutSemanticPalette.granularMuscleGroups.other;
}

function getMuscleMetricValue(row: MuscleBreakdownRow, mode: MuscleBreakdownMetric) {
  if (mode === 'sets') {
    return row.setCount;
  }

  if (mode === 'reps') {
    return row.reps;
  }

  return row.loadKg;
}

function formatMuscleMetricSummaryValue(mode: MuscleBreakdownMetric, value: number) {
  if (mode === 'volume') {
    return `${Math.round(value).toLocaleString('en-US')} kg`;
  }

  return Math.round(value).toLocaleString('en-US');
}

function formatMuscleMetricLegendValue(mode: MuscleBreakdownMetric, value: number) {
  if (mode === 'sets') {
    return `${Math.round(value).toLocaleString('en-US')} sets`;
  }

  if (mode === 'reps') {
    return `${Math.round(value).toLocaleString('en-US')} reps`;
  }

  return `${Math.round(value).toLocaleString('en-US')} kg`;
}

function getNormalizedShareByMetric(rows: MuscleBreakdownRow[], mode: MuscleBreakdownMetric) {
  const normalized = new Map<string, number>();
  const withIds = rows
    .map(row => ({
      id: row.groupId,
      value: getMuscleMetricValue(row, mode),
    }))
    .filter(row => row.id.length > 0 && row.value > 0);

  if (withIds.length === 0) {
    return normalized;
  }

  const total = withIds.reduce((sum, row) => sum + row.value, 0);
  const ranked = withIds.map(row => {
    const raw = (row.value / total) * 100;
    const floor = Math.floor(raw);
    return {
      floor,
      fraction: raw - floor,
      id: row.id,
      value: row.value,
    };
  });

  let distributed = ranked.reduce((sum, row) => sum + row.floor, 0);
  const needed = Math.max(0, 100 - distributed);
  const remainderSorted = [...ranked].sort(
    (left, right) => right.fraction - left.fraction || right.value - left.value || left.id.localeCompare(right.id),
  );

  for (let index = 0; index < needed; index += 1) {
    const target = remainderSorted[index % remainderSorted.length];
    target.floor += 1;
    distributed += 1;
    if (distributed >= 100) {
      break;
    }
  }

  for (const row of ranked) {
    normalized.set(row.id, row.floor);
  }

  return normalized;
}

function getNormalizedPercentagesByCount(rows: Array<{ groupId?: string; key?: string; setCount: number }>) {
  const normalized = new Map<string, number>();
  const withIds = rows
    .map(row => ({
      id: row.groupId ?? row.key ?? '',
      value: row.setCount,
    }))
    .filter(row => row.id.length > 0 && row.value > 0);

  if (withIds.length === 0) {
    return normalized;
  }

  const total = withIds.reduce((sum, row) => sum + row.value, 0);
  const ranked = withIds.map(row => {
    const raw = (row.value / total) * 100;
    const floor = Math.floor(raw);
    return {
      floor,
      fraction: raw - floor,
      id: row.id,
      value: row.value,
    };
  });

  let distributed = ranked.reduce((sum, row) => sum + row.floor, 0);
  const needed = Math.max(0, 100 - distributed);
  const remainderSorted = [...ranked].sort(
    (left, right) => right.fraction - left.fraction || right.value - left.value || left.id.localeCompare(right.id),
  );

  for (let index = 0; index < needed; index += 1) {
    const target = remainderSorted[index % remainderSorted.length];
    target.floor += 1;
    distributed += 1;
    if (distributed >= 100) {
      break;
    }
  }

  for (const row of ranked) {
    normalized.set(row.id, row.floor);
  }

  return normalized;
}

function SessionMuscleDonut({
  segments,
  subtitle,
  value,
}: {
  segments: Array<{ color: string; id: string; percent: number }>;
  subtitle: string;
  value: string;
}) {
  return (
    <AnalyticsDonut
      centerPrimary={value}
      centerPrimaryStyle={styles.sessionInsightsBreakdownDonutValue}
      centerSecondary={subtitle}
      centerSecondaryStyle={styles.sessionInsightsBreakdownDonutSubtitle}
      containerStyle={styles.sessionInsightsBreakdownChart}
      segments={segments}
      size={124}
      strokeWidth={14}
      wrapStyle={styles.sessionInsightsBreakdownDonutWrap}
    />
  );
}

function SnapshotTile({
  icon,
  label,
  subLabel,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subLabel?: string;
  value: string;
}) {
  const { theme } = useReedTheme();

  return (
    <View
      style={[
        styles.sessionInsightsSnapshotTile,
        {
          backgroundColor: theme.colors.controlFill,
          borderColor: theme.colors.controlBorder,
        },
      ]}
    >
      <Ionicons color={String(theme.colors.textMuted)} name={icon} size={16} />
      <View style={{ width: '100%', alignItems: 'center' }}>
        <ReedText
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          numberOfLines={1}
          style={styles.sessionInsightsSnapshotValue}
          variant="section"
        >
          {value}
        </ReedText>
      </View>
      <ReedText style={styles.sessionInsightsSnapshotLabel} tone="muted" variant="caption">
        {label}
      </ReedText>
      {subLabel ? (
        <ReedText style={styles.sessionInsightsSnapshotSubLabel} tone="muted" variant="caption">
          {subLabel}
        </ReedText>
      ) : null}
    </View>
  );
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.sessionInsightsMetricRow}>
      <ReedText tone="muted" variant="caption">
        {label}
      </ReedText>
      <ReedText variant="bodyStrong">{value}</ReedText>
    </View>
  );
}

function MetricTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { theme } = useReedTheme();

  return (
    <View
      style={[
        styles.sessionInsightsMetricTile,
        {
          backgroundColor: theme.colors.controlFill,
          borderColor: theme.colors.controlBorder,
        },
      ]}
    >
      <ReedText tone="muted" variant="caption">
        {label}
      </ReedText>
      <ReedText variant="section">{value}</ReedText>
    </View>
  );
}

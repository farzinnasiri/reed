import { StyleSheet } from 'react-native';
import { reedRadii } from '@/design/system';

export const styles = StyleSheet.create({
  bodyWeightReadout: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 4,
  },
  bodyWeightReadoutRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'space-between',
  },
  bodyWeightTrendCopy: {
    flex: 1,
    gap: 2,
  },
  bodyWeightTrendText: {
    textAlign: 'right',
  },
  bodyWeightValue: {
    fontSize: 34,
    lineHeight: 38,
  },
  coachNote: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 8,
    paddingHorizontal: 6,
    paddingTop: 8,
  },
  coachNoteBody: {
    flex: 1,
    paddingTop: 3,
  },
  coachNoteMore: {
    alignSelf: 'flex-start',
    paddingTop: 4,
  },
  consistencyAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  consistencyCell: {
    borderRadius: 3,
    height: 8,
  },
  consistencyColumn: {
    flex: 1,
    gap: 3,
  },
  consistencyFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  consistencyGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  consistencyHelper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  periodNote: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  topExerciseStack: {
    borderTopWidth: 1,
    gap: 8,
    paddingTop: 12,
  },
  weightLogButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: reedRadii.pill,
    flexDirection: 'row',
    gap: 6,
    height: 38,
    paddingHorizontal: 15,
  },

  bodyWeightChartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  bodyWeightChartWrap: {
    gap: 4,
  },
  bodyWeightEmptyChart: {
    borderRadius: reedRadii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    minHeight: 120,
    justifyContent: 'center',
    padding: 14,
  },
  infoButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  emptyProgress: {
    gap: 5,
    minHeight: 96,
    justifyContent: 'center',
  },
  legendDot: {
    borderRadius: reedRadii.pill,
    height: 8,
    width: 8,
  },
  legendLabel: {
    flex: 1,
  },
  muscleLegend: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  muscleLegendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  periodControl: {
    minWidth: 0,
    width: '100%',
  },
  progressDonutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDonutValue: {
    textAlign: 'center',
  },
  progressDonutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressMetricRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressMetricTile: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
  },
  progressMetricText: {
    textAlign: 'center',
  },
  progressSkeleton: {
    gap: 14,
  },
  skeletonLine: {
    borderRadius: reedRadii.pill,
    height: 42,
  },
  skeletonMetric: {
    borderRadius: reedRadii.lg,
    flex: 1,
    height: 58,
  },
  topExerciseName: {
    flex: 1,
  },
  topExerciseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  trainingVisualRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
  },
  trainingVisualRowCompact: {
    flexDirection: 'column',
  },
});

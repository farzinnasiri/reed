import { StyleSheet } from 'react-native';
import { reedRadii } from '@/design/system';

export const styles = StyleSheet.create({
  sessionInsightsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  sessionInsightsFrame: {
    minHeight: 320,
  },
  sessionInsightsPanel: {
    flex: 1,
  },
  sessionInsightsContent: {
    flex: 1,
    gap: 12,
    minHeight: 0,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sessionInsightsHandleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
    paddingTop: 2,
  },
  sessionInsightsHandle: {
    backgroundColor: 'rgba(148, 163, 184, 0.55)',
    borderRadius: reedRadii.pill,
    height: 4,
    width: 44,
  },
  sessionInsightsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionInsightsHeaderCopy: {
    gap: 2,
  },
  sessionInsightsHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sessionInsightsScroll: {
    flex: 1,
    minHeight: 0,
  },
  sessionInsightsScrollContent: {
    gap: 14,
    paddingBottom: 18,
  },
  sessionInsightsSectionBlock: {
    gap: 10,
  },
  sessionInsightsSectionCard: {
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 10,
  },
  sessionInsightsSection: {
    gap: 10,
  },
  sessionInsightsSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionInsightsSectionTitleWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sessionInsightsMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sessionInsightsSnapshotBlock: {
    gap: 10,
  },
  sessionInsightsSnapshotGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  sessionInsightsSnapshotTile: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 102,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  sessionInsightsSnapshotValue: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 19.4,
    letterSpacing: -0.35,
    lineHeight: 22.6,
    marginTop: 8,
    textAlign: 'center',
  },
  sessionInsightsSnapshotLabel: {
    fontFamily: 'Outfit_600SemiBold',
    lineHeight: 16,
    marginTop: 6,
    textAlign: 'center',
  },
  sessionInsightsSnapshotSubLabel: {
    fontSize: 11,
    lineHeight: 13,
    marginTop: 1,
    textAlign: 'center',
  },
  sessionInsightsMetricTile: {
    borderRadius: reedRadii.md,
    borderWidth: 1,
    gap: 4,
    minWidth: '47%',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sessionInsightsStatList: {
    gap: 8,
  },
  sessionInsightsShapeGroupTitle: {
    marginTop: 2,
  },
  sessionInsightsShapeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sessionInsightsShapeChip: {
    borderRadius: reedRadii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sessionInsightsShapeChipText: {
    fontFamily: 'Outfit_600SemiBold',
  },
  sessionInsightsShapeStack: {
    borderRadius: reedRadii.pill,
    flexDirection: 'row',
    height: 18,
    overflow: 'hidden',
  },
  sessionInsightsShapeStackSegment: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  sessionInsightsShapeStackSegmentEmpty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  sessionInsightsShapeStackText: {
    color: '#f8fafc',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    lineHeight: 12,
  },
  sessionInsightsShapeLegend: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  sessionInsightsShapeLegendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  sessionInsightsShapeLegendDot: {
    borderRadius: reedRadii.pill,
    height: 9,
    width: 9,
  },
  sessionInsightsShapeLegendText: {
    fontFamily: 'Outfit_600SemiBold',
  },
  sessionInsightsMuscleGroupList: {
    gap: 8,
  },
  sessionInsightsMuscleGroupRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  sessionInsightsMuscleGroupLabel: {
    minWidth: 82,
  },
  sessionInsightsMuscleGroupTrack: {
    borderRadius: reedRadii.pill,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  sessionInsightsMuscleGroupFill: {
    borderRadius: reedRadii.pill,
    height: '100%',
    minWidth: 0,
  },
  sessionInsightsMuscleGroupValue: {
    minWidth: 58,
    textAlign: 'right',
  },
  sessionInsightsShapeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sessionInsightsShapeItem: {
    gap: 2,
    minWidth: '22%',
  },
  sessionInsightsShapeLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  sessionInsightsBreakdownRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  sessionInsightsBreakdownControlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  sessionInsightsBreakdownMetricSwitch: {
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  sessionInsightsBreakdownMetricOption: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 58,
    paddingHorizontal: 10,
  },
  sessionInsightsBreakdownMetricOptionText: {
    fontFamily: 'Outfit_600SemiBold',
  },
  sessionInsightsBreakdownChart: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 128,
  },
  sessionInsightsBreakdownDonutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sessionInsightsBreakdownDonutCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  sessionInsightsBreakdownDonutValue: {
    textAlign: 'center',
  },
  sessionInsightsBreakdownDonutSubtitle: {
    marginTop: -1,
    textTransform: 'capitalize',
  },
  sessionInsightsBreakdownEmpty: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    height: 84,
    justifyContent: 'center',
    minWidth: 84,
  },
  sessionInsightsBreakdownLegend: {
    flex: 1,
    gap: 6,
  },
  sessionInsightsBreakdownLegendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  sessionInsightsBreakdownLegendDot: {
    borderRadius: reedRadii.pill,
    height: 8,
    width: 8,
  },
  sessionInsightsBreakdownLegendLabel: {
    flex: 1,
  },
  sessionInsightsBreakdownLegendValue: {
    minWidth: 36,
    textAlign: 'right',
  },
  sessionInsightsMetricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 22,
  },
  sessionInsightsChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sessionInsightsChip: {
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sessionInsightsList: {
    gap: 10,
  },
  sessionInsightsHighlightsSummaryShell: {
    alignItems: 'stretch',
    borderRadius: reedRadii.md,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  sessionInsightsHighlightsSummaryCell: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 92,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  sessionInsightsHighlightsSummaryDivider: {
    alignSelf: 'stretch',
    width: 1,
  },
  sessionInsightsHighlightsSummaryLabel: {
    fontFamily: 'Outfit_600SemiBold',
    marginTop: 4,
    textAlign: 'center',
  },
  sessionInsightsHighlightsSummaryValue: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 30,
    letterSpacing: -0.4,
    lineHeight: 34,
    marginTop: 2,
    textAlign: 'center',
  },
  sessionInsightsHighlightsSummaryMostDemanding: {
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
  },
  sessionInsightsHighlightsSummaryMostDemandingMeta: {
    marginTop: 1,
    textAlign: 'center',
    width: '100%',
  },
  sessionInsightsListRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  sessionInsightsListCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  sessionInsightsHighlightRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  sessionInsightsHighlightTypeText: {
    fontFamily: 'Outfit_600SemiBold',
    minWidth: 76,
    textAlign: 'right',
  },
  sheetClose: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
});

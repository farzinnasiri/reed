import { StyleSheet } from 'react-native';
import { reedRadii, SCREEN_CHROME_HORIZONTAL_MARGIN, SCREEN_CONTENT_HORIZONTAL_MARGIN } from '@/design/system';
import { styles as shared } from './workout-shared.styles';

export const styles = StyleSheet.create({
  ...shared,
  timelinePage: {
    flex: 1,
    gap: 16,
    paddingBottom: 0,
    paddingHorizontal: SCREEN_CONTENT_HORIZONTAL_MARGIN,
    paddingTop: 2,
  },
  timelineRailScroll: {
    flex: 1,
    minHeight: 0,
  },
  timelineRailContentDocked: {
    gap: 12,
    paddingBottom: 128,
    paddingTop: 8,
  },
  timelineLineItem: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 96,
  },
  timelineRailColumn: {
    alignItems: 'center',
    position: 'relative',
    width: 26,
  },
  timelineRailSegmentTop: {
    borderRadius: reedRadii.pill,
    height: 8,
    left: 12,
    position: 'absolute',
    top: 0,
    width: 2,
    zIndex: 1,
  },
  timelineRailSegmentBottom: {
    borderRadius: reedRadii.pill,
    bottom: 0,
    left: 12,
    position: 'absolute',
    top: 36,
    width: 2,
    zIndex: 1,
  },
  timelineNodeMarkerFixed: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    borderWidth: 2,
    height: 26,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 8,
    width: 26,
    zIndex: 2,
  },
  // DESIGN.md → Card: `surface`, radius 26, no border, padding 16 / 18 / 18.
  timelineLineCopy: {
    borderRadius: reedRadii.card,
    flex: 1,
    gap: 8,
    marginBottom: 4,
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 16,
  },
  timelineLineHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  timelineLineTitle: {
    flex: 1,
  },
  timelineLineTitleStack: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  timelineRowActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  timelineActionButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  timelineBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  timelineSetCountInline: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  timelineSetList: {
    gap: 12,
    marginLeft: 0,
    marginTop: 8,
    paddingBottom: 2,
    paddingLeft: 8,
  },
  timelineSetBlock: {
    gap: 4,
    overflow: 'hidden',
    position: 'relative',
    borderRadius: reedRadii.sm,
  },
  timelineSetFlash: {
    ...StyleSheet.absoluteFill,
    borderRadius: reedRadii.sm,
  },
  timelineSetRowContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 36,
  },
  timelineSetPressable: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  timelineSetDot: {
    borderRadius: reedRadii.pill,
    height: 8,
    width: 8,
  },
  timelineRestRow: {
    paddingBottom: 2,
    paddingLeft: 16,
  },
  timelineSetDeleteButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  timelineEmpty: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    minHeight: 240,
    paddingVertical: 28,
  },
  // The dock is the home dock's shape: chrome-gutter sides, canvas behind, one 52px row.
  dock: {
    bottom: 0,
    left: 0,
    paddingHorizontal: SCREEN_CHROME_HORIZONTAL_MARGIN,
    paddingTop: 8,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  dockRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dockFill: {
    flex: 1,
  },
  dockIcon: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  dockWide: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
  },
  finishSheet: {
    gap: 12,
    paddingTop: 4,
  },
  finishCopy: {
    gap: 4,
    paddingBottom: 8,
  },
});

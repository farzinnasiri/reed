import { StyleSheet } from 'react-native';
import { reedRadii, SCREEN_CONTENT_HORIZONTAL_MARGIN } from '@/design/system';
import { styles as shared } from './workout-shared.styles';

export const styles = StyleSheet.create({
  ...shared,
  startState: {
    flex: 1,
  },
  startStateScroll: {
    gap: 24,
    paddingBottom: 132,
    paddingHorizontal: SCREEN_CONTENT_HORIZONTAL_MARGIN,
  },
  startTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  startTitle: {
    flex: 1,
  },
  startHeroSurface: {
    marginTop: 2,
  },
  startHeroContent: {
    gap: 0,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  startHeroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  // DESIGN.md → session button: a 56px accent circle.
  startHeroButton: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  startCopy: {
    flex: 1,
    gap: 4,
  },
  startHistory: {
    gap: 12,
    marginTop: 2,
  },
  startHistoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trainingShelf: {
    gap: 12,
  },
  loadingInline: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
  },
  sessionHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sessionPageControl: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 4,
  },
  sessionPagerButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sessionPaginationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  quickLogDayList: {
    gap: 0,
  },
  quickLogDayBlock: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  quickLogEntries: {
    gap: 10,
    paddingLeft: 66,
    paddingTop: 4,
  },
  quickLogEntryRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  quickLogEntryDot: {
    borderRadius: 3,
    height: 6,
    marginTop: 6,
    width: 6,
  },
  quickLogEntryCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  rows: {
    gap: 0,
  },
  historyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 72,
    paddingVertical: 12,
  },
  historyRowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  historyMark: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  liveDot: {
    borderRadius: reedRadii.pill,
    height: 12,
    width: 12,
  },
});

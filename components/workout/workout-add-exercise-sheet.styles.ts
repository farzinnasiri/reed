import { StyleSheet } from 'react-native';
import { reedRadii } from '@/design/system';

export const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    gap: 12,
    minHeight: 0,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sheetTitle: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  browseContent: {
    gap: 16,
  },
  resultsHeader: {
    paddingBottom: 8,
  },
  loadingSpacer: {
    height: 24,
  },
  dock: {
    gap: 4,
    paddingTop: 4,
  },
  filterSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  filterSummaryLine: {
    flex: 1,
  },
  searchShell: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15.5,
    lineHeight: 20,
    padding: 0,
  },
  searchDivider: {
    alignSelf: 'stretch',
    marginVertical: 12,
    width: 1,
  },
  searchFilterButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
  },
  searchFilterBadge: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    justifyContent: 'center',
    minHeight: 20,
    minWidth: 20,
    paddingHorizontal: 5,
  },
  footer: {
    gap: 8,
    paddingTop: 4,
  },
  footerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  footerPrimary: {
    flex: 1,
  },
  catalogSection: {
    gap: 8,
  },
  catalogList: {
    gap: 0,
  },
  catalogRow: {
    alignItems: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  catalogRowPressable: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  catalogRowCopy: {
    flex: 1,
    gap: 2,
  },
  catalogActionButton: {
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
    width: 44,
  },
  filterSectionBlock: {
    gap: 12,
  },
  filterSectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterSectionHeaderCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  filterSearchShell: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  filterSearchInput: {
    flex: 1,
    fontSize: 15.5,
    lineHeight: 20,
    padding: 0,
  },
  filterOptionsList: {
    gap: 8,
  },
  filterOptionRow: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterOptionLabel: {
    flex: 1,
    paddingRight: 10,
  },
  filterTreeGroup: {
    gap: 6,
  },
  filterTreeParentToggle: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minHeight: 32,
  },
  filterTreeCount: {
    paddingHorizontal: 4,
  },
  filterTreeDisclosure: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    width: 44,
  },
  filterTreeChildren: {
    gap: 6,
    paddingLeft: 14,
  },
  filterTreeChildRow: {
    alignItems: 'center',
    borderRadius: reedRadii.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
});

import { StyleSheet } from 'react-native';
import { reedRadii } from '@/design/system';
import { styles as shared } from './workout-shared.styles';

export const styles = StyleSheet.create({
  ...shared,
  navButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  // The Pulse's shape: a 52px pill (grows a little when it carries a second line of tokens).
  statusStripShell: {
    borderRadius: reedRadii.card,
    minHeight: 52,
  },
  statusStripContent: {
    gap: 0,
    justifyContent: 'center',
    minHeight: 52,
    paddingBottom: 4,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  statusStripRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  statusStripNavButton: {
    height: 44,
    width: 44,
  },
  statusStripMetrics: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 0,
  },
  statusStripCenter: {
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    minWidth: 0,
    width: '100%',
  },
  statusStripCenterSingle: {
    gap: 0,
  },
  statusStripPrimaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minWidth: 0,
    width: '100%',
  },
  statusStripSegment: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 4,
    minHeight: 22,
    minWidth: 0,
  },
  statusStripValue: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
  },
  statusStripDot: {
    borderRadius: reedRadii.pill,
    height: 3,
    width: 3,
  },
  statusStripMicroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 0,
    justifyContent: 'center',
    maxWidth: '100%',
    minHeight: 18,
  },
  statusStripMicroToken: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    minWidth: 0,
  },
  statusStripMicroDot: {
    borderRadius: reedRadii.pill,
    height: 3,
    marginHorizontal: 8,
    width: 3,
  },
  statusStripMicroText: {
    fontFamily: 'Figtree_600SemiBold',
    fontSize: 15,
    lineHeight: 18,
  },
});

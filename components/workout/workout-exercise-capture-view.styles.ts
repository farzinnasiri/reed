import { StyleSheet } from 'react-native';
import { reedRadii, reedTheme } from '@/design/system';
import { styles as shared } from './workout-shared.styles';

export const styles = StyleSheet.create({
  ...shared,
  captureHeader: {
    flexWrap: 'wrap',
    rowGap: reedTheme.spacing.xs,
    marginBottom: reedTheme.spacing.xs,
  },
  captureActions: {
    width: '100%',
  },
  returnToCurrent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: reedTheme.spacing.xxs,
    minHeight: 44,
  },
  cardHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: reedTheme.spacing.xs,
  },
  warmupChip: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: reedTheme.spacing.xs,
    flex: 1,
  },
  captureFoot: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: reedTheme.spacing.xs,
  },
  afterSet: {
    alignSelf: 'stretch',
  },
  metricsStack: {
    flex: 1,
    minHeight: 0,
    gap: reedTheme.spacing.xs,
  },
  unilateralSwitchRow: {
    alignSelf: 'center',
    marginBottom: 8,
    maxWidth: 210,
    minWidth: 160,
  },
});

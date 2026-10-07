import { StyleSheet } from 'react-native';
import { reedRadii } from '@/design/system';
import { styles as shared } from './workout-shared.styles';

export const styles = StyleSheet.create({
  ...shared,
  cardHeaderActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  warmupChip: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
  },
  metricsStack: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingBottom: 4,
    paddingTop: 4,
  },
  metricsStackSingle: {
    justifyContent: 'center',
    paddingBottom: 0,
    paddingTop: 0,
  },
  metricsStackPair: {
    gap: 20,
    justifyContent: 'flex-start',
    paddingTop: 12,
  },
  metricsStackTriple: {
    gap: 12,
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  metricsStackDense: {
    gap: 12,
    justifyContent: 'flex-start',
    paddingBottom: 0,
    paddingTop: 2,
  },
  modifierControlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  unilateralSwitchRow: {
    alignSelf: 'center',
    marginBottom: 8,
    maxWidth: 210,
    minWidth: 160,
  },
});

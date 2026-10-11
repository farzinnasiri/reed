import { StyleSheet } from 'react-native';
import { reedRadii, reedTheme } from '@/design/system';
import { styles as shared } from './workout-shared.styles';

export const styles = StyleSheet.create({
  ...shared,
  restBody: {
    alignItems: 'center',
    flex: 1,
    minHeight: 0,
    gap: 20,
    justifyContent: 'center',
    paddingBottom: 8,
    paddingTop: 8,
  },
  restChoices: {
    alignSelf: 'stretch',
    gap: reedTheme.spacing.xs,
  },
  restActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: reedTheme.spacing.xs,
    justifyContent: 'flex-end',
  },
  timerButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  restSteps: {
    flexDirection: 'row',
    gap: 8,
  },
  restStep: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 84,
    paddingHorizontal: 16,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  presetChip: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 16,
  },
});

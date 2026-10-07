import { StyleSheet } from 'react-native';
import { SCREEN_CONTENT_HORIZONTAL_MARGIN } from '@/design/system';
import { styles as shared } from './workout-shared.styles';

export const styles = StyleSheet.create({
  ...shared,
  // The card shares the timeline's edge; the bottom clears the home indicator (see the page for the inset).
  exercisePage: {
    flex: 1,
    gap: 12,
    paddingHorizontal: SCREEN_CONTENT_HORIZONTAL_MARGIN,
    paddingTop: 2,
  },
  exerciseTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 32,
  },
  exerciseTitle: {
    textAlign: 'center',
  },
  cardArea: {
    flex: 1,
    minHeight: 0,
  },
  cardPlaceholder: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});

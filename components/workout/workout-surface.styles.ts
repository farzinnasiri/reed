import { StyleSheet } from 'react-native';
import { SCREEN_CHROME_HORIZONTAL_MARGIN } from '@/design/system';
import { styles as shared } from './workout-shared.styles';

export const styles = StyleSheet.create({
  ...shared,
  root: {
    flex: 1,
    minHeight: 0,
  },
  activeWorkoutShell: {
    flex: 1,
    minHeight: 0,
  },
  activeWorkoutPage: {
    flex: 1,
    marginTop: 8,
    minHeight: 0,
    overflow: 'hidden',
  },
  loadingState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingTop: 36,
  },
  // Same place and width as the home Pulse (DESIGN.md: chrome sits at `chrome-gutter`), so moving
  // between home and a session keeps the strip where it was.
  statusStripFloating: {
    left: SCREEN_CHROME_HORIZONTAL_MARGIN,
    position: 'absolute',
    right: SCREEN_CHROME_HORIZONTAL_MARGIN,
    zIndex: 10,
  },
});

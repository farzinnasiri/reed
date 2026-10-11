import { StyleSheet } from 'react-native';
import { reedRadii } from '@/design/system';
import { styles as shared } from './workout-shared.styles';

export const styles = StyleSheet.create({
  ...shared,
  trainingShelf: { gap: 12 },
  loadingInline: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
  },
  startButton: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  startButtonCopy: { flex: 1, minWidth: 0 },
});

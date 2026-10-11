import { StyleSheet } from 'react-native';
import { SCREEN_CONTENT_HORIZONTAL_MARGIN, reedTheme } from '@/design/system';
import { styles as shared } from './workout-shared.styles';

export const styles = StyleSheet.create({
  ...shared,
  // The card shares the timeline's edge; the bottom clears the home indicator (see the page for the inset).
  exercisePage: {
    flex: 1,
    gap: 8,
    paddingHorizontal: SCREEN_CONTENT_HORIZONTAL_MARGIN,
    paddingTop: 2,
  },
  exerciseTopRow: {
    gap: reedTheme.spacing.sm,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    // Aligned with the card's own content inset, so the circle and the Set label frame the card.
    paddingHorizontal: reedTheme.spacing.gutter,
  },
  setLabel: {
    flexShrink: 0,
    alignSelf: 'flex-start',
    paddingTop: reedTheme.spacing.xxs,
  },
  exerciseHeadingCopy: {
    flex: 1,
    minWidth: 0,
    gap: reedTheme.spacing.xxs,
  },
  exerciseTitle: {
    flexShrink: 1,
    textAlign: 'left',
  },
  guideButton: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    justifyContent: 'center',
    minHeight: 44,
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

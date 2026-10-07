import { StyleSheet } from 'react-native';
import { reedRadii } from '@/design/system';
import { styles as shared } from './workout-shared.styles';

export const styles = StyleSheet.create({
  ...shared,
  liveCardShell: {
    borderRadius: reedRadii.card,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  liveCardBody: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  liveCardTimerSection: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    justifyContent: 'center',
  },
  liveSummaryBody: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  liveSummaryMeta: {
    alignItems: 'center',
    gap: 4,
  },
  liveSummaryValue: {
    textAlign: 'center',
  },
  liveSummaryActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  liveStartHint: {
    marginBottom: 12,
    textAlign: 'center',
  },
  liveRingButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  liveElapsedTimerShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveElapsedTimerRing: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    borderWidth: 12,
    justifyContent: 'center',
  },
  liveElapsedCopy: {
    alignItems: 'center',
    gap: 8,
    maxWidth: '78%',
  },
  liveElapsedLabel: {
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  liveCardStartState: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  livePrimaryActions: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  liveMetricList: {
    alignSelf: 'stretch',
    gap: 12,
  },
  liveMetricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  liveMetricCopy: {
    flex: 1,
    gap: 2,
  },
  liveMetricActions: {
    flexDirection: 'row',
    gap: 8,
  },
  liveStepButton: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 52,
    paddingHorizontal: 12,
  },
  liveAction: {
    flex: 1,
  },
});

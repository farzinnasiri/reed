import { reedRadii } from '@/design/system';
import { StyleSheet } from 'react-native';

export const SESSION_STRIP_HEIGHT = 52;
/** The second row of a live session's strip on the timeline: Finish and Notes. */
// A 44px row of two halves, inset 6px from the pill's edge so their corners follow its curve.
const ACTION_INSET = 6;
const ACTION_HEIGHT = 44;
export const SESSION_STRIP_ACTIONS_HEIGHT = ACTION_HEIGHT + ACTION_INSET;
const CONCENTRIC_RADIUS = reedRadii.card - ACTION_INSET;

export const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'box-none',
    zIndex: 20,
  },
  column: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 720,
    pointerEvents: 'box-none',
    width: '100%',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    zIndex: 15,
  },
  container: {
    overflow: 'hidden',
    position: 'absolute',
  },
  strip: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    height: SESSION_STRIP_HEIGHT,
    left: 0,
    paddingLeft: 4,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: ACTION_INSET,
    height: ACTION_HEIGHT,
    left: ACTION_INSET,
    position: 'absolute',
    right: ACTION_INSET,
    top: SESSION_STRIP_HEIGHT,
  },
  actionHit: { flex: 1 },
  actionStart: { borderBottomLeftRadius: CONCENTRIC_RADIUS },
  actionEnd: { borderBottomRightRadius: CONCENTRIC_RADIUS },
  // The two halves read as one split control: their outer bottom corners are concentric with the
  // pill (its 26 less the 6 inset), the corners facing the top row and each other are tighter.
  action: {
    alignItems: 'center',
    borderRadius: reedRadii.sm,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  navButton: {
    alignItems: 'center',
    height: 44,
    marginTop: (SESSION_STRIP_HEIGHT - 44) / 2,
    justifyContent: 'center',
    width: 44,
  },
  // The part of the strip you tap or pull to open the panel.
  stripBody: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: SESSION_STRIP_HEIGHT,
    minWidth: 0,
    paddingLeft: 4,
    paddingRight: 14,
  },
  stripItem: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 7,
  },
  stripNumber: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
  },
  stripPosition: {
    flex: 1,
    minWidth: 0,
  },
  separator: {
    height: 18,
    width: 1,
  },
  panel: {
    flex: 1,
  },
});

import { StyleSheet, useWindowDimensions } from 'react-native';
import { reedRadii, reedSessionMetrics, SCREEN_CHROME_HORIZONTAL_MARGIN } from '@/design/system';

export const DOCK_PADDING_TOP = 4;
export const DOCK_PADDING_BOTTOM = 8;
/** The button row. Reed is taller than it and rises above it, so the row stays slim. */
export const DOCK_ROW_HEIGHT = 56;
/** What the dock takes above the safe inset; pages keep this much clear at their bottom. */
export const DOCK_HEIGHT = DOCK_ROW_HEIGHT + DOCK_PADDING_TOP + DOCK_PADDING_BOTTOM;
export const DOCK_FADE_HEIGHT = 20;
/** How far Reed's slot rises above the row. */
export const DOCK_MASCOT_RISE = reedSessionMetrics.dock - DOCK_ROW_HEIGHT;

export function useExerciseDockSize() {
  const { height } = useWindowDimensions();
  return height < reedSessionMetrics.compactHeight ? reedSessionMetrics.compactExerciseDock : reedSessionMetrics.exerciseDock;
}

export const styles = StyleSheet.create({
  // The home dock's shape: chrome-gutter sides, canvas behind, one row. Reed is at the left and
  // stands taller than the row, so the container is as tall as he is and only its lower part is canvas.
  dock: {
    bottom: 0,
    left: 0,
    paddingBottom: DOCK_PADDING_BOTTOM,
    paddingHorizontal: SCREEN_CHROME_HORIZONTAL_MARGIN,
    paddingTop: DOCK_PADDING_TOP,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  fade: {
    height: DOCK_FADE_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: -DOCK_FADE_HEIGHT,
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    height: reedSessionMetrics.dock,
  },
  round: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 48,
    justifyContent: 'center',
    marginBottom: (DOCK_ROW_HEIGHT - 48) / 2,
    width: 48,
  },
  next: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    height: 52,
    marginBottom: (DOCK_ROW_HEIGHT - 52) / 2,
    minWidth: 0,
    paddingLeft: 20,
    paddingRight: 16,
  },
  nextCopy: { flex: 1, minWidth: 0 },
  nextTitle: { lineHeight: 20 },
  nextDetail: { lineHeight: 16 },
  nextClock: { fontVariant: ['tabular-nums'] },
});

import { useCallback, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { reedSprings } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedBodyMetrics as metrics, reedRadii } from '@/design/system';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';

export const PAIN_LABELS = ['None', 'Mild', 'Moderate', 'Strong', 'Severe'] as const;

/** Finger position is continuous on the UI thread; only level changes cross to React. */
export function VerticalPainScale({ area, value, height, onPreview, onChange }: {
  area: string; value: number | null; height: number;
  onPreview: (value: number) => void; onChange: (value: number) => void;
}) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const travel = height - metrics.severityInset * 2;
  const position = useSharedValue((1 - (value ?? 0) / 4) * travel);
  const last = useSharedValue(value ?? -1);
  const dragging = useSharedValue(false);
  const colors = [theme.colors.inkMuted, theme.colors.successInk, theme.colors.dataWarm, theme.colors.bodyPainStrong, theme.colors.bodyPainHigh];
  useEffect(() => {
    if (dragging.get()) return;
    const target = (1 - (value ?? 0) / 4) * travel;
    position.set(reduced ? target : withSpring(target, reedSprings.snappy));
    last.set(value ?? -1);
  }, [dragging, last, position, reduced, travel, value]);
  const preview = useCallback((next: number) => { haptics.selection(); onPreview(next); }, [onPreview]);
  const commit = (next: number) => onChange(Math.max(0, Math.min(4, next)));
  const pan = Gesture.Pan().minDistance(0)
    .onBegin(event => {
      dragging.set(true);
      const y = Math.max(0, Math.min(travel, event.y - metrics.severityInset));
      position.set(y);
      const next = Math.round((1 - y / travel) * 4);
      if (last.get() !== next) { last.set(next); scheduleOnRN(preview, next); }
    })
    .onUpdate(event => {
      const y = Math.max(0, Math.min(travel, event.y - metrics.severityInset));
      position.set(y);
      const next = Math.round((1 - y / travel) * 4);
      if (last.get() !== next) { last.set(next); scheduleOnRN(preview, next); }
    })
    .onEnd(() => {
      const next = Math.round((1 - position.get() / travel) * 4);
      const target = (1 - next / 4) * travel;
      position.set(reduced ? target : withSpring(target, reedSprings.snappy));
      scheduleOnRN(commit, next);
    })
    .onFinalize((_event, success) => {
      dragging.set(false);
      if (!success) {
        const target = (1 - (value ?? 0) / 4) * travel;
        position.set(reduced ? target : withSpring(target, reedSprings.snappy));
      }
    });
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateY: position.get() }] }));
  const choose = (next: number) => { const clamped = Math.max(0, Math.min(4, next)); if (clamped !== value) haptics.selection(); commit(clamped); };
  return <View style={styles.root}>
    <ReedText accessibilityLiveRegion="polite" variant="caption" style={{ textAlign: 'center', color: value === null ? theme.colors.inkSecondary : colors[value] }}>{value === null ? 'How much?' : PAIN_LABELS[value]}</ReedText>
    <GestureDetector gesture={pan} touchAction="none">
      <Animated.View accessibilityRole="adjustable" accessibilityLabel={`${area} severity`}
        accessibilityValue={{ min: 0, max: 4, now: value ?? undefined, text: value === null ? 'Choose severity' : PAIN_LABELS[value] }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => choose((value ?? 0) + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}
        {...(Platform.OS === 'web' ? { tabIndex: 0, 'aria-orientation': 'vertical', 'aria-valuemin': 0, 'aria-valuemax': 4, 'aria-valuenow': value ?? undefined, 'aria-valuetext': value === null ? 'Choose severity' : PAIN_LABELS[value], onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault(); choose(event.key === 'Home' ? 0 : event.key === 'End' ? 4 : (value ?? 0) + (event.key === 'ArrowUp' ? 1 : -1));
        } } : {})}
        style={{ height, width: metrics.severityWidth }}>
        <View style={[styles.track, { top: metrics.severityInset, bottom: metrics.severityInset, backgroundColor: theme.colors.lineStrong, pointerEvents: 'none' }]} />
        {PAIN_LABELS.map((label, index) => <View key={label} style={[styles.dot, { top: metrics.severityInset + (1 - index / 4) * travel - metrics.severityDot / 2, backgroundColor: colors[index], pointerEvents: 'none' }]} />)}
        <Animated.View style={[styles.thumb, thumbStyle, { top: metrics.severityInset - metrics.severityThumb / 2, backgroundColor: value === null ? theme.colors.canvas : colors[value], borderColor: theme.colors.ink, pointerEvents: 'none' }]} />
      </Animated.View>
    </GestureDetector>
    <ReedText tone="muted" variant="caption" style={{ textAlign: 'center' }}>None</ReedText>
  </View>;
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 4, width: metrics.severityWidth },
  track: { position: 'absolute', width: metrics.severityTrack, left: (metrics.severityWidth - metrics.severityTrack) / 2, borderRadius: reedRadii.pill },
  dot: { position: 'absolute', width: metrics.severityDot, height: metrics.severityDot, left: (metrics.severityWidth - metrics.severityDot) / 2, borderRadius: reedRadii.pill },
  thumb: { position: 'absolute', width: metrics.severityThumb, height: metrics.severityThumb, left: (metrics.severityWidth - metrics.severityThumb) / 2, borderRadius: reedRadii.pill, borderWidth: 2 },
});

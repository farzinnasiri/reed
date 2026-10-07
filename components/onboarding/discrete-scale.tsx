import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { useReedTheme } from '@/design/provider';
import { reedOnboardingMetrics, reedRadii } from '@/design/system';

export type ScaleStop = { label: string; color: string };

/** The rail can be dragged; every stop is also a labeled, keyboard-accessible button. */
export function DiscreteScale({ label, stops, value, onChange, numberOffset = 1, compact = false }: { compact?: boolean; numberOffset?: number; label: string; stops: ScaleStop[]; value: number | null; onChange: (value: number) => void }) {
  const { theme } = useReedTheme();
  const width = useRef(0);
  const rail = useRef<View>(null);
  const last = useRef(value);
  last.current = value;
  const choose = (next: number) => {
    const clamped = Math.max(0, Math.min(stops.length - 1, next));
    if (last.current === clamped) return;
    last.current = clamped;
    haptics.selection();
    onChange(clamped);
  };
  const drag = (pageX: number) => rail.current?.measureInWindow(left => {
    if (!Number.isFinite(pageX)) return;
    choose(Math.round(Math.max(0, Math.min(1, (pageX - left - 24) / Math.max(1, width.current - 48))) * (stops.length - 1)));
  });
  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <ReedText variant="bodyStrong">{label}</ReedText>
        <ReedText accessibilityLiveRegion="polite" style={{ color: value === null ? theme.colors.inkMuted : stops[value].color }} variant="bodyStrong">{value === null ? 'Choose a level' : stops[value].label}</ReedText>
      </View>
      <View
        ref={rail}
        accessibilityLabel={label}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max: stops.length - 1, now: value ?? undefined, text: value === null ? 'Not answered' : stops[value].label }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => choose((value ?? 0) + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}
        onLayout={event => { width.current = event.nativeEvent.layout.width; }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={event => drag(event.nativeEvent.pageX)}
        onResponderMove={event => drag(event.nativeEvent.pageX)}
        style={styles.railTouch}
        {...(Platform.OS === 'web' ? { 'aria-valuemin': 0, 'aria-valuemax': stops.length - 1, 'aria-valuenow': value ?? undefined, 'aria-valuetext': value === null ? 'Not answered' : stops[value].label, tabIndex: 0, onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          choose(event.key === 'Home' ? 0 : event.key === 'End' ? stops.length - 1 : (value ?? 0) + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1));
        } } : {})}
      >
        <View pointerEvents="none" style={[styles.track, { backgroundColor: theme.colors.lineStrong }]} />
        <View pointerEvents="none" style={styles.dots}>
          {stops.map((stop, index) => <View key={stop.label} style={[styles.dot, { backgroundColor: stop.color, borderColor: value === index ? theme.colors.ink : 'transparent', transform: [{ scale: value === index ? 1.3 : 0.8 }] }]} />)}
        </View>
      </View>
      {!compact ? <View style={styles.choices}>
        {stops.map((stop, index) => (
          <Pressable accessibilityRole="radio" accessibilityLabel={`${label}: ${stop.label}`} accessibilityState={{ checked: value === index }} key={stop.label} onPress={() => choose(index)} style={styles.choice}>
            <ReedText style={{ color: value === index ? stop.color : theme.colors.inkSecondary }} variant="caption">{index + numberOffset}</ReedText>
          </Pressable>
        ))}
      </View> : null}
      <View style={styles.heading}>
        <ReedText tone="muted" variant="caption">{stops[0].label}</ReedText>
        <ReedText tone="muted" variant="caption">{stops[stops.length - 1].label}</ReedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 2, width: '100%' },
  heading: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  railTouch: { height: reedOnboardingMetrics.hit, justifyContent: 'center' },
  track: { height: 3, left: 24, right: 24, position: 'absolute', borderRadius: reedRadii.pill },
  dots: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14 },
  dot: { width: 20, height: 20, borderRadius: reedRadii.pill, borderWidth: 2 },
  choices: { flexDirection: 'row', justifyContent: 'space-between' },
  choice: { width: reedOnboardingMetrics.hit, minHeight: reedOnboardingMetrics.hit, alignItems: 'center', justifyContent: 'center' },
});

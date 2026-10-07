import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { useOnboardingReed } from './reed-context';

const motion = reedMotion.onboarding;
const LABEL = "Hold to say I'm in";

/**
 * The letter ends with a promise, so the answer is held rather than tapped. `progress` (0 to 1) is
 * owned by the flow so the mascot can swell with it. Reed's face climbs as the hold does; letting go
 * early is a nudge, not a failure.
 */
export function HoldToCommit({ onCommit, progress }: { onCommit: () => void; progress: SharedValue<number> }) {
  const { theme } = useReedTheme();
  const { reed, say } = useOnboardingReed();
  const [width, setWidth] = useState(0);
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);
  const stages = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearStages = useCallback(() => {
    stages.current.forEach(clearTimeout);
    stages.current = [];
  }, []);

  const commit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    clearStages();
    setDone(true);
    haptics.success();
    reed?.react('proud', 2200);
    reed?.act('bounce');
    onCommit();
  }, [clearStages, onCommit, reed]);

  const begin = () => {
    if (doneRef.current) return;
    const at = (fraction: number, run: () => void) => stages.current.push(setTimeout(run, motion.holdMs * fraction));
    haptics.light();
    reed?.react('focused', motion.holdMs);
    at(0.3, () => { haptics.selection(); reed?.play([{ expression: 'effort', ms: motion.holdMs, speed: 1.4, transition: 'quick' }]); });
    at(0.62, () => { haptics.light(); reed?.react('excited', motion.holdMs); });
    at(0.88, () => haptics.medium());
    progress.set(withTiming(1, { duration: motion.holdMs, easing: Easing.linear }, finished => {
      if (finished) scheduleOnRN(commit);
    }));
  };

  const release = () => {
    if (doneRef.current) return;
    clearStages();
    cancelAnimation(progress);
    progress.set(withTiming(0, { duration: motion.holdReleaseMs }));
    reed?.react('encouraging', 900);
    say('A little longer. Hold it.', 1800);
  };

  useEffect(() => () => {
    clearStages();
    cancelAnimation(progress);
    progress.set(0);
  }, [clearStages, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  const press = useAnimatedStyle(() => ({ transform: [{ scale: 1 - motion.holdPressScale * Math.min(1, progress.get() * 10) }] }));
  const label = done ? "I'm in." : LABEL;

  return (
    <Pressable
      accessibilityActions={[{ name: 'activate', label: "Say I'm in" }]}
      accessibilityHint="Press and hold"
      accessibilityLabel={LABEL}
      accessibilityRole="button"
      onAccessibilityAction={commit}
      onPressIn={begin}
      onPressOut={release}
    >
      <Animated.View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.track, { backgroundColor: theme.colors.accentSoft }, press]}>
        <ReedText style={{ color: theme.colors.accentInk }} variant="bodyStrong">{label}</ReedText>
        <Animated.View style={[styles.fill, { backgroundColor: theme.colors.accent }, fill]}>
          <View style={[styles.fillLabel, { width }]}>
            <ReedText style={{ color: theme.colors.accentText }} variant="bodyStrong">{label}</ReedText>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { alignItems: 'center', borderRadius: reedRadii.pill, justifyContent: 'center', minHeight: 56, overflow: 'hidden' },
  fill: { bottom: 0, left: 0, overflow: 'hidden', position: 'absolute', top: 0 },
  fillLabel: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', top: 0 },
});

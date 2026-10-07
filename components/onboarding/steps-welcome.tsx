import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { reedMotion, reedSprings } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii, withColorAlpha } from '@/design/system';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { MARQUEE_ROWS, WELCOME_FEATURES } from './content';
import { Reveal, Say } from './controls';
import { useOnboardingReed } from './reed-context';
import type { StepProps } from './step-props';

const GUTTER = 20;
const FEATURE_MS = 3000;

/** The front door: who Reed is, the range it covers drifting past, and what it promises. */
export function WelcomeStep(_props: StepProps) {
  return (
    <View style={styles.welcome}>
      <View style={styles.title}>
        <Reveal delay={reedMotion.launch.titleDelayMs}>
          <ReedText style={styles.wordmark} variant="display">Reed</ReedText>
        </Reveal>
        <Say delay={reedMotion.launch.subtitleDelayMs} text="Your coach for everything you do with your body." tone="secondary" variant="voice" />
      </View>
      <Reveal delay={reedMotion.launch.stripsDelayMs} style={styles.marquees}>
        <MarqueeRow items={MARQUEE_ROWS[0]} seconds={46} />
        <MarqueeRow items={MARQUEE_ROWS[1]} reverse seconds={52} />
      </Reveal>
      <Reveal delay={reedMotion.launch.promiseDelayMs}>
        <FeatureTicker />
      </Reveal>
    </View>
  );
}

/** A band of pills sliding past, looping seamlessly. Static when Reduce Motion is on. */
function MarqueeRow({ items, reverse = false, seconds }: { items: { icon: ComponentIcon; label: string }[]; reverse?: boolean; seconds: number }) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const [setWidth, setSetWidth] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (!setWidth || reduced) return;
    x.set(reverse ? -setWidth : 0);
    x.set(withRepeat(withTiming(reverse ? 0 : -setWidth, { duration: seconds * 1000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(x);
  }, [reduced, reverse, seconds, setWidth, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const canvas = String(theme.colors.canvas);
  const pills = items.map(item => (
    <View key={item.label} style={[styles.pill, { backgroundColor: theme.colors.surface }]}>
      <Ionicons color={String(theme.colors.inkMuted)} name={item.icon} size={15} />
      <ReedText tone="secondary" variant="caption">{item.label}</ReedText>
    </View>
  ));
  return (
    <View style={styles.clip}>
      <Animated.View style={[styles.track, style]}>
        <View onLayout={event => setSetWidth(event.nativeEvent.layout.width)} style={styles.set}>{pills}</View>
        <View style={styles.set}>{pills}</View>
        <View style={styles.set}>{pills}</View>
      </Animated.View>
      <LinearGradient colors={[canvas, withColorAlpha(canvas, 0)]} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={[styles.fade, { left: 0 }]} />
      <LinearGradient colors={[withColorAlpha(canvas, 0), canvas]} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={[styles.fade, { right: 0 }]} />
    </View>
  );
}

type ComponentIcon = React.ComponentProps<typeof Ionicons>['name'];

/** One promise at a time, cross-fading. Reed pulls the matching face, and a tap moves on. */
function FeatureTicker() {
  const { theme } = useReedTheme();
  const { reed } = useOnboardingReed();
  const reduced = useReedReducedMotion();
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(0);
  const feature = WELCOME_FEATURES[index];

  useEffect(() => {
    progress.set(reduced ? withTiming(1, { duration: reedMotion.durations.standard }) : withSpring(1, reedSprings.smooth));
    reed?.react(feature.face, FEATURE_MS - 400);
    const timer = setTimeout(() => advance(), FEATURE_MS);
    return () => clearTimeout(timer);
    // The timer restarts with each feature; `reed` is stable for the life of the flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const advance = (direct = false) => {
    if (direct) haptics.selection();
    progress.set(withTiming(0, { duration: 160 }, finished => {
      if (finished) scheduleOnRN(setIndex, (index + 1) % WELCOME_FEATURES.length);
    }));
  };
  const style = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: reduced ? 0 : (1 - progress.get()) * 8 }] }));

  return (
    <Pressable accessibilityHint="Shows the next thing Reed does" accessibilityRole="button" onPress={() => advance(true)} style={styles.ticker}>
      <Animated.View style={[styles.feature, style]}>
        <View style={[styles.featureIcon, { backgroundColor: theme.colors.accentSoft }]}>
          <Ionicons color={String(theme.colors.accentInk)} name={feature.icon} size={20} />
        </View>
        <ReedText style={styles.featureText} variant="headline">{feature.text}</ReedText>
      </Animated.View>
      <View style={styles.dots}>
        {WELCOME_FEATURES.map((entry, dot) => (
          <View key={entry.text} style={[styles.dot, { backgroundColor: dot === index ? theme.colors.accent : theme.colors.lineStrong, width: dot === index ? 16 : 6 }]} />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  welcome: {
    flexGrow: 1,
    gap: 24,
    justifyContent: 'space-evenly',
  },
  title: {
    gap: 8,
  },
  wordmark: {
    fontSize: 48,
    letterSpacing: -1.8,
    lineHeight: 54,
    textAlign: 'center',
  },
  marquees: {
    gap: 10,
    marginHorizontal: -GUTTER,
  },
  clip: {
    height: 40,
    overflow: 'hidden',
  },
  track: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
  set: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
    paddingRight: 8,
  },
  pill: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    flexDirection: 'row',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
  },
  fade: {
    bottom: 0,
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    width: 48,
  },
  ticker: {
    alignItems: 'center',
    gap: 14,
    minHeight: 92,
  },
  feature: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 8,
  },
  featureIcon: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  featureText: {
    flexShrink: 1,
    maxWidth: 310,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    borderRadius: reedRadii.pill,
    height: 6,
  },
});

import { useCallback, useEffect, useRef } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { ReedMascot, type MascotController } from '@/components/reed/mascot';
import { ReedButton } from '@/components/ui/reed-button';
import { reedMotion, reedReanimatedEasing } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedLaunchMetrics as metrics } from '@/design/system';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { launchCutouts } from './use-launch-introduction';

const motion = reedMotion.launch;
const AnimatedImage = Animated.createAnimatedComponent(Image);

/** One visible scene: a small sporting world gathers into Reed, then settles at the welcome anchor. */
export function FirstLaunchIntro({ reed, targetY, targetSize, onComplete }: {
  reed: MascotController; targetY: number; targetSize: number; onComplete: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const progress = useSharedValue(0);
  const finished = useRef(false);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onComplete();
  }, [onComplete]);
  const centerY = height * metrics.centerHeightRatio;
  const radiusX = Math.min(metrics.orbitMaxX, width * metrics.orbitWidthRatio);
  const radiusY = Math.min(metrics.orbitMaxY, height * metrics.orbitHeightRatio);

  useEffect(() => {
    if (reduced) { finish(); return; }
    progress.set(withTiming(1, { duration: motion.durationMs, easing: reedReanimatedEasing.easeInOut }, done => {
      if (done) scheduleOnRN(finish);
    }));
    // Also allow entry when the OS suspends frame delivery during startup.
    const fallback = setTimeout(finish, motion.durationMs + motion.fallbackMs);
    return () => { cancelAnimation(progress); clearTimeout(fallback); };
    // This is a one-shot scene; dimensions change its measured destination without restarting it.
  }, [finish, progress, reduced]);

  const mascotStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const y = interpolate(p, [0, motion.gatherEnd, 1], [centerY, centerY, targetY]);
    const size = interpolate(p, [0, motion.arrivalEnd, motion.gatherEnd, 1], [metrics.loadingSize, metrics.mascotSize, metrics.mascotSize, targetSize]);
    const hop = p > motion.orbitEnd && p < motion.gatherEnd ? Math.sin((p - motion.orbitEnd) / (motion.gatherEnd - motion.orbitEnd) * Math.PI) * -reedMotion.presence.hopY : 0;
    return { transform: [{ translateY: y - metrics.mascotSize / 2 + hop }, { scale: size / metrics.mascotSize }] };
  });

  return <View accessibilityLabel="Welcome to Reed" style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
    <View style={[styles.stage, { width: Math.min(width, metrics.stageWidth) }]}>
      {launchCutouts.map((source, index) => <OrbitCutout key={index} source={source} index={index} progress={progress} centerY={centerY} radiusX={radiusX} radiusY={radiusY} />)}
      <Animated.View style={[styles.mascot, mascotStyle]}><ReedMascot mascot={reed} size={metrics.mascotSize} /></Animated.View>
    </View>
    <View style={[styles.skip, { bottom: insets.bottom + metrics.skipInset }]}>
      <ReedButton label="Skip intro" onPress={finish} variant="ghost" />
    </View>
  </View>;
}

function OrbitCutout({ source, index, progress, centerY, radiusX, radiusY }: {
  source: number; index: number; progress: SharedValue<number>; centerY: number; radiusX: number; radiusY: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const arrived = Math.min(1, Math.max(0, (p - index * motion.objectStagger) / motion.arrivalEnd));
    const gather = Math.min(1, Math.max(0, (p - motion.orbitEnd) / (motion.gatherEnd - motion.orbitEnd)));
    const angle = index * Math.PI * 2 / 3 - Math.PI / 2 + p * motion.orbitRadians;
    return {
      opacity: arrived * (1 - gather),
      transform: [
        { translateX: Math.cos(angle) * radiusX * (1 - gather) },
        { translateY: centerY - metrics.cutoutSize / 2 + Math.sin(angle) * radiusY * (1 - gather) },
        { rotate: `${Math.sin(angle) * motion.cutoutTiltDegrees}deg` },
        { scale: interpolate(gather, [0, 1], [motion.cutoutInitialScale + arrived * (1 - motion.cutoutInitialScale), motion.gatherScale]) },
      ],
    };
  });
  return <AnimatedImage accessibilityElementsHidden importantForAccessibility="no-hide-descendants" resizeMode="contain" source={source} style={[styles.cutout, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', overflow: 'hidden' },
  stage: { flex: 1, alignItems: 'center' },
  mascot: { position: 'absolute', width: metrics.mascotSize, height: metrics.mascotSize },
  cutout: { position: 'absolute', width: metrics.cutoutSize, height: metrics.cutoutSize },
  skip: { position: 'absolute', right: metrics.skipInset, minHeight: metrics.skipTarget },
});

import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { reedMotion, reedSprings } from '@/design/motion';
import { reedHomeMascotMetrics } from '@/design/system';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { MascotTouch } from './presence/mascot-touch';
import { useEntryAnimation } from '@/design/use-entry-animation';
import type { ReedPresenceState } from './presence/presence-state';
import { mascotSizes, ReedMascot, type MascotController } from './mascot';

/** Where the mascot sits: its centre in stage coordinates and its drawn size. */
export type MascotAnchor = { cx: number; cy: number; size: number };

// The mascot is drawn once at its largest hero size and scaled down to wherever it is, so one
// instance serves the hero and the corner and is never scaled up (which would blur it).
const BASE_SIZE = Math.round(mascotSizes.hero * reedHomeMascotMetrics.quietScale);

type PresenceMascotProps = {
  corner: MascotAnchor;
  state: ReedPresenceState;
  onTalk: () => void;
  /** Null until the today view has measured its hero slot. */
  hero: MascotAnchor | null;
  keyboardLift: SharedValue<number>;
  mascot: MascotController;
  placement: 'corner' | 'hero';
  /** The today view's scroll offset: the hero slot scrolls, so the mascot follows it. */
  scrollY: SharedValue<number>;
};

/**
 * The one mascot on home. It lives in an overlay above the thread and glides between the hero
 * slot (today mode) and the corner slot (chat mode) with `reedSprings.morph`. Going to the hero
 * is a cut, not a reverse glide. With Reduce Motion it crossfades instead of travelling.
 */
export function PresenceMascot({ corner, hero, keyboardLift, mascot, placement, scrollY, state, onTalk }: PresenceMascotProps) {
  const reduceMotion = useReedReducedMotion();
  const entry = useEntryAnimation({ enabled: placement === 'hero', fromScale: reedMotion.today.heroScale, translateY: 0 });
  const act = mascot.act;
  useEffect(() => {
    if (placement !== 'hero') return;
    const timer = setTimeout(() => act('tick'), reedMotion.today.nodDelayMs);
    return () => clearTimeout(timer);
  }, [act, placement]);
  const progress = useSharedValue(placement === 'corner' ? 1 : 0);
  const heroX = useSharedValue(hero?.cx ?? 0);
  const heroY = useSharedValue(hero?.cy ?? 0);
  const heroSize = useSharedValue(hero?.size ?? BASE_SIZE);
  const cornerX = useSharedValue(corner.cx);
  const cornerY = useSharedValue(corner.cy);
  const cornerSize = useSharedValue(corner.size);
  const previousPlacementRef = useRef(placement);

  useEffect(() => {
    if (!hero) return;
    heroX.value = hero.cx;
    heroY.value = hero.cy;
    heroSize.value = hero.size;
  }, [hero, heroSize, heroX, heroY]);

  // The corner moves with the keyboard; ease it rather than snapping.
  useEffect(() => {
    const ease = { duration: reedMotion.durations.standard };
    cornerX.value = withTiming(corner.cx, ease);
    cornerY.value = withTiming(corner.cy, ease);
    cornerSize.value = corner.size;
  }, [corner.cx, corner.cy, corner.size, cornerSize, cornerX, cornerY]);

  useEffect(() => {
    if (previousPlacementRef.current === placement) return;
    previousPlacementRef.current = placement;

    if (placement === 'hero') {
      progress.value = 0;
    } else {
      progress.value = reduceMotion
        ? withTiming(1, { duration: reedMotion.durations.standard, reduceMotion: ReduceMotion.Never })
        : withSpring(1, reedSprings.morph);
    }
  }, [placement, progress, reduceMotion]);

  const style = useAnimatedStyle(() => {
    const raw = progress.value;
    // Reduce Motion: no travel, the mascot fades out at one slot and in at the other.
    const t = reduceMotion ? (raw > 0.5 ? 1 : 0) : raw;
    const fromY = heroY.value - scrollY.value;
    const cx = heroX.value + (cornerX.value - heroX.value) * t;
    const cy = fromY + (cornerY.value - fromY) * t - keyboardLift.get() * t;
    const size = heroSize.value + (cornerSize.value - heroSize.value) * t;

    return {
      opacity: reduceMotion ? Math.abs(raw * 2 - 1) : 1,
      transform: [{ translateX: cx - BASE_SIZE / 2 }, { translateY: cy - BASE_SIZE / 2 }, { scale: size / BASE_SIZE }],
    };
  });

  // In today mode nothing is drawn until the hero slot has been measured.
  const isPlaced = placement === 'corner' || hero !== null;

  return (
    <View style={[styles.layer, { opacity: isPlaced ? 1 : 0 }]}>
      <Animated.View style={[styles.mascot, style]}>
        <Animated.View style={entry}><MascotTouch mascot={mascot} state={state} onTalk={onTalk}><ReedMascot mascot={mascot} size={BASE_SIZE} /></MascotTouch></Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'box-none',
    // Above the dock, whose fade would otherwise dim the mascot's lower edge.
    zIndex: 21,
  },
  mascot: {
    height: BASE_SIZE,
    left: 0,
    position: 'absolute',
    top: 0,
    width: BASE_SIZE,
  },
});

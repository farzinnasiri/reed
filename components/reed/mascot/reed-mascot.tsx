import { memo, useEffect, useId, useLayoutEffect, useState } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop, type CircleProps, type GProps, type PathProps } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedStyle, useDerivedValue, useFrameCallback, useSharedValue, type DerivedValue } from 'react-native-reanimated';
import { reedMotion, reedSprings } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { useLowPower } from '../presence/use-low-power';
import { usePresenceActivity } from '../presence/use-presence-activity';
import { computeMascotFrame, createMascotRuntime, getMascotExpressionLabel, getMascotNextFrameDelay, setMascotExpression, type MascotExpression, type MascotFrame } from './mascot-engine';
import { resolveMascotTransition, type MascotController, type MascotFeel } from './use-mascot';

export type { MascotExpression } from './mascot-engine';
export const mascotSizes = { xs: 24, sm: 40, md: 64, corner: 96, heroSmall: 112, hero: 150, lg: 120, xl: 200 } as const;
export type MascotSize = keyof typeof mascotSizes;

// Fixed illustration palette; surface colors still come from the theme.
const MASCOT_INK = ['#15161a', '#0e0f12', '#090a0c'] as const;
const MASCOT_APERTURE = ['#d9dce2', '#ffffff'] as const;
const MASCOT_RIM = '#ffffff';
const MASCOT_COUNTER_RIM = '#c8cad0';
const BREATH_VISIBLE_MIN_SIZE = 64;
const HALO_MIN_SIZE = 48;
// The snooze marks and sweat drop turn to noise below this size.
const ACCENT_MIN_SIZE = 64;
const ACCENT_SLOTS = [0, 1, 2];
const VIEWBOX = '-92 -92 184 184';
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const IS_WEB = Platform.OS === 'web';

function reactionDuration(kind: string) {
  'worklet';
  return kind === 'tick' ? reedMotion.presence.tickMs : kind === 'shake' ? reedMotion.touch.shakeMs : kind === 'wobble' ? reedSprings.lift.duration : reedMotion.presence.hopMs;
}

type ReedMascotProps = MascotFeel & {
  /** A fixed expression. Ignored when a `mascot` controller drives the face. */
  expression?: MascotExpression;
  /** Drives the face, pace and transitions; `speed` and `transition` here then do nothing. */
  mascot?: MascotController;
  size?: MascotSize | number;
  style?: StyleProp<ViewStyle>;
  halo?: boolean;
};

function ReedMascotComponent({ expression: fixedExpression = 'idle', mascot, size: sizeProp = 'md', speed: fixedSpeed = 1, style, halo: showHalo = true, transition: fixedTransition = 'smooth' }: ReedMascotProps) {
  const expression = mascot?.expression ?? fixedExpression;
  const size = typeof sizeProp === 'number' ? sizeProp : mascotSizes[sizeProp];
  const { theme } = useReedTheme();
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const reduced = useReedReducedMotion();
  const visible = usePresenceActivity();
  const lowPower = useLowPower();
  const active = visible && !lowPower;
  const breathVisible = size >= BREATH_VISIBLE_MIN_SIZE;
  const bodyTravel = breathVisible ? 0.8 : 0.45;
  const [initial] = useState(() => {
    const now = Date.now();
    const runtime = createMascotRuntime(expression, now);
    const frame = computeMascotFrame(runtime, now, reduced, bodyTravel);
    return { runtime, frame, now };
  });
  const runtime = useSharedValue(initial.runtime);
  const clock = useSharedValue(initial.now);
  const desiredExpression = useSharedValue(expression);
  const ownSpeed = useSharedValue(fixedSpeed);
  const ownTransitionMs = useSharedValue(resolveMascotTransition(fixedTransition));
  const speed = mascot?.speed ?? ownSpeed;
  const transitionMs = mascot?.transitionMs ?? ownTransitionMs;
  const lastDraw = useSharedValue(0);
  const gazeX = mascot?.gazeX;
  const gazeY = mascot?.gazeY;
  const reaction = mascot?.reaction;

  const fixedTransitionMs = resolveMascotTransition(fixedTransition);
  useLayoutEffect(() => {
    ownSpeed.set(fixedSpeed);
    ownTransitionMs.set(fixedTransitionMs);
  }, [fixedSpeed, fixedTransitionMs, ownSpeed, ownTransitionMs]);

  useLayoutEffect(() => {
    desiredExpression.set(expression);
    clock.set(Date.now());
  }, [clock, desiredExpression, expression, reduced]);

  // Geometry and SVG prop updates stay on the UI runtime. No per-frame React updates.
  const frame = useDerivedValue(() => {
    const now = clock.get();
    const name = desiredExpression.get();
    const gaze = { x: gazeX?.get() ?? 0, y: gazeY?.get() ?? 0 };
    let next = initial.frame;
    const pace = Math.max(0.1, speed.get());
    runtime.modify(current => {
      current.speed = pace;
      setMascotExpression(current, name, now, reduced, transitionMs.get());
      next = computeMascotFrame(current, now, reduced, bodyTravel, gaze);
      return current;
    }, false);
    return next;
  });

  const frames = useFrameCallback(() => {
    const now = Date.now();
    const current = runtime.get();
    const gesture = reaction?.get();
    const reacting = !reduced && gesture !== null && gesture !== undefined
      && now - gesture.startedAt < reactionDuration(gesture.kind);
    if (getMascotNextFrameDelay(current, now, reduced, breathVisible) > 0 && !reacting) return;
    const busy = reacting || current.transition !== null || current.name === 'thinking'
      || current.name === 'listening' || current.name === 'speaking';
    if (!busy && now - lastDraw.get() < reedMotion.presence.idleFrameMs) return;
    lastDraw.set(now);
    clock.set(now);
  }, false);
  useEffect(() => {
    frames.setActive(active);
    if (active) clock.set(Date.now());
    return () => frames.setActive(false);
  }, [active, clock, frames]);

  const reactionStyle = useAnimatedStyle(() => {
    const gesture = reaction?.get();
    if (reduced || !gesture) return { transform: [{ translateY: 0 }] };
    const duration = reactionDuration(gesture.kind);
    const t = Math.max(0, Math.min(1, (clock.get() - gesture.startedAt) / duration));
    const arc = Math.sin(t * Math.PI);
    const kind = gesture.kind;
    const y = kind === 'tick' ? arc * reedMotion.presence.tickY : kind === 'hop' ? -arc * reedMotion.presence.hopY : kind === 'spring' ? -arc * reedMotion.touch.jumpY : kind === 'bounce' ? -arc * reedMotion.presence.hopY / 2 : 0;
    const wobble = kind === 'wobble' ? arc : 0;
    const angle = kind === 'shake' ? Math.sin(t * Math.PI * 6) * (1 - t) * reedMotion.touch.shakeDegrees : 0;
    return { transform: [{ translateY: y }, { rotate: `${angle}deg` }, { scaleX: 1 + wobble * 0.06 }, { scaleY: 1 - wobble * 0.05 }] };
  });
  const ink = `${gradientId}-ink`, halo = `${gradientId}-halo`, rim = `${gradientId}-rim`, counterRim = `${gradientId}-counter`;
  const aperture = `url(#${gradientId}-aperture)`;

  return (
    <Animated.View accessibilityLabel={`Reed, ${getMascotExpressionLabel(expression).toLowerCase()}`} accessibilityRole="image" style={[{ height: size, width: size }, style, reactionStyle]}>
      <Svg height={size} viewBox={VIEWBOX} width={size}>
        <Defs>
          <LinearGradient gradientUnits="userSpaceOnUse" id={ink} x1="-54" x2="56" y1="-58" y2="58">
            <Stop offset="0" stopColor={MASCOT_INK[0]} />
            <Stop offset="0.55" stopColor={MASCOT_INK[1]} />
            <Stop offset="1" stopColor={MASCOT_INK[2]} />
          </LinearGradient>
          <RadialGradient id={halo}>
            <Stop offset="0" stopColor={String(theme.colors.accent)} stopOpacity="0.38" />
            <Stop offset="0.7" stopColor={String(theme.colors.accent)} stopOpacity="0.3" />
            <Stop offset="1" stopColor={String(theme.colors.accent)} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient gradientUnits="userSpaceOnUse" id={rim} x1="-55" x2="32" y1="34" y2="-56">
            <Stop offset="0" stopColor={MASCOT_RIM} stopOpacity="0" />
            <Stop offset="0.42" stopColor={MASCOT_RIM} stopOpacity="0.34" />
            <Stop offset="0.72" stopColor={MASCOT_APERTURE[0]} stopOpacity="0.12" />
            <Stop offset="1" stopColor={MASCOT_APERTURE[0]} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient gradientUnits="userSpaceOnUse" id={counterRim} x1="-18" x2="57" y1="61" y2="29">
            <Stop offset="0" stopColor={MASCOT_COUNTER_RIM} stopOpacity="0" />
            <Stop offset="0.58" stopColor={MASCOT_COUNTER_RIM} stopOpacity="0.1" />
            <Stop offset="1" stopColor={MASCOT_COUNTER_RIM} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient gradientUnits="userSpaceOnUse" id={`${gradientId}-aperture`} x1="-36" x2="36" y1="0" y2="0">
            <Stop offset="0" stopColor={MASCOT_APERTURE[0]} />
            <Stop offset="0.5" stopColor={MASCOT_APERTURE[1]} />
            <Stop offset="1" stopColor={MASCOT_APERTURE[0]} />
          </LinearGradient>
        </Defs>
        <MascotGroup frame={frame} initial={initial.frame} part="core">
          {showHalo && size >= HALO_MIN_SIZE ? <MascotHalo frame={frame} fill={`url(#${halo})`} /> : null}
          <Circle cx={0} cy={0} fill={`url(#${ink})`} r={65} />
          <Path d="M -55 34 A 64.25 64.25 0 0 1 32 -56" fill="none" stroke={`url(#${rim})`} strokeLinecap="round" strokeWidth={1.4} />
          <Path d="M -18 61 A 64.25 64.25 0 0 0 57 29" fill="none" stroke={`url(#${counterRim})`} strokeLinecap="round" strokeWidth={1.2} />
          <MascotGroup frame={frame} initial={initial.frame} part="aperture">
            {(['track', 'meter', 'main', 'second', 'wave'] as const).map(part => (
              <MascotStroke color={part === 'track' ? MASCOT_APERTURE[1] : aperture} frame={frame} initial={initial.frame} key={part} part={part} />
            ))}
            {[0, 1, 2, 3].map(index => <MascotDetail color={aperture} frame={frame} index={index} key={`focus-${index}`} part="focus" />)}
            {[0, 1, 2, 3, 4].map(index => <MascotDetail color={aperture} frame={frame} index={index} key={`bar-${index}`} part="bars" />)}
            {[0, 1, 2].map(index => <MascotDetail color={aperture} frame={frame} index={index} key={`dot-${index}`} part="typing" />)}
            {[-14, 14].map(x => <MascotDizzyEye key={x} x={x} frame={frame} color={aperture} />)}
            <MascotRing color={aperture} frame={frame} />
            <MascotSignal frame={frame} />
          </MascotGroup>
          {size >= ACCENT_MIN_SIZE ? ACCENT_SLOTS.map(index => <MascotAccent color={aperture} frame={frame} index={index} key={`accent-${index}`} />) : null}
        </MascotGroup>
      </Svg>
    </Animated.View>
  );
}

type FrameValue = DerivedValue<MascotFrame>;

function MascotGroup({ children, frame, initial, part }: { children: React.ReactNode; frame: FrameValue; initial: MascotFrame; part: 'core' | 'aperture' }) {
  const animatedProps = useAnimatedProps<GProps & { matrix?: number[] }>(() => {
    const f = frame.get();
    return IS_WEB ? { transform: f[part] } : { matrix: part === 'core' ? f.coreMatrix : f.apertureMatrix };
  });
  return <AnimatedG animatedProps={animatedProps} transform={initial[part]}>{children}</AnimatedG>;
}

function MascotStroke({ color, frame, initial, part }: { color: string; frame: FrameValue; initial: MascotFrame; part: 'main' | 'second' | 'wave' | 'track' | 'meter' }) {
  const props = useAnimatedProps<PathProps>(() => {
    const stroke = frame.get()[part];
    return { d: stroke.d, opacity: stroke.opacity, strokeWidth: stroke.width };
  });
  return <AnimatedPath animatedProps={props} d={initial[part].d} fill="none" opacity={initial[part].opacity} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={initial[part].width} />;
}

function MascotDetail({ color, frame, index, part }: { color: string; frame: FrameValue; index: number; part: 'focus' | 'bars' | 'typing' }) {
  const props = useAnimatedProps<PathProps>(() => {
    const f = frame.get();
    const group = f[part];
    const stroke = part === 'focus' ? f.focus.corners[index]
      : part === 'bars' ? f.bars.items[index] : f.typing.items[index];
    return { d: stroke.d, opacity: group.opacity, strokeWidth: stroke.width };
  });
  return <AnimatedPath animatedProps={props} d="M 0 0" fill="none" opacity={0} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} />;
}

function MascotAccent({ color, frame, index }: { color: string; frame: FrameValue; index: number }) {
  const props = useAnimatedProps<PathProps>(() => {
    const accent = frame.get().accents[index];
    return { d: accent.d, opacity: accent.opacity, strokeWidth: accent.width };
  });
  return <AnimatedPath animatedProps={props} d="M 0 0" fill="none" opacity={0} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} />;
}

function MascotHalo({ frame, fill }: { frame: FrameValue; fill: string }) {
  const props = useAnimatedProps<CircleProps>(() => ({ opacity: frame.get().haloOpacity }));
  return <AnimatedCircle animatedProps={props} cx={0} cy={0} fill={fill} r={79} />;
}

function MascotRing({ color, frame }: { color: string; frame: FrameValue }) {
  const props = useAnimatedProps<CircleProps & { matrix?: number[] }>(() => {
    const ring = frame.get().ring;
    return { opacity: ring.opacity, r: ring.r, strokeDasharray: ring.dash ?? [], strokeWidth: ring.width,
      ...(IS_WEB ? { transform: ring.transform } : { matrix: ring.matrix }) };
  });
  return <AnimatedCircle animatedProps={props} cx={0} cy={0} fill="none" opacity={0} r={16} stroke={color} strokeLinecap="round" strokeWidth={1} />;
}

function MascotSignal({ frame }: { frame: FrameValue }) {
  const props = useAnimatedProps<CircleProps>(() => ({ cx: frame.get().signal.cx, opacity: frame.get().signal.opacity }));
  return <AnimatedCircle animatedProps={props} cy={0} fill={MASCOT_APERTURE[1]} opacity={0} r={3.2} />;
}

export const ReedMascot = memo(ReedMascotComponent);

function MascotDizzyEye({ x, frame, color }: { x: number; frame: FrameValue; color: string }) {
  const props = useAnimatedProps<CircleProps>(() => {
    const angle = frame.get().dizzy.angle, rad = angle * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    return { opacity: frame.get().dizzy.opacity, ...(IS_WEB ? { transform: `rotate(${angle} ${x} 0)` } : { matrix: [c, s, -s, c, x * (1 - c), -x * s] }) };
  });
  return <AnimatedCircle animatedProps={props} cx={x} cy={0} r={8} fill="none" opacity={0} stroke={color} strokeWidth={4.5} strokeDasharray={[34, 16]} strokeLinecap="round" />;
}

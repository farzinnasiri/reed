import { useEffect } from "react";
import {
  Canvas,
  Circle,
  Group,
  RadialGradient,
  vec,
} from "@shopify/react-native-skia";
import { DeviceMotion } from "expo-sensors";
import {
  interpolateColor,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import {
  reedGlowMetrics as metrics,
  withColorAlpha,
} from "@/design/system";
import { reedMotion } from "@/design/motion";
import { useReedReducedMotion } from "@/design/use-reed-reduced-motion";
import { usePresenceActivity } from "./use-presence-activity";
import { useLowPower } from "./use-low-power";
import { useReedTheme } from "@/design/provider";
import { glowTarget, type GlowProps } from "./glow-state";

type Frame = ReturnType<typeof glowTarget> & {
  time: number;
  elapsed: number;
  x: number;
  y: number;
  wave: number;
  pulse: number;
};

/** Three additive radials. Every render value and the clock stay on the UI runtime. */
export function ReedGlowField({
  state,
  wordAt,
  receivedAt,
  width,
  height,
  heroY,
  scrollY,
  sleeping,
}: GlowProps) {
  const reduced = useReedReducedMotion();
  const visible = usePresenceActivity();
  const lowPower = useLowPower();
  const active = visible && !lowPower && !reduced;
  const rawTilt = useSharedValue({ x: 0, y: 0 });
  const target = useDerivedValue(() =>
    glowTarget(
      state.get(),
      heroY === null ? null : heroY - (scrollY?.get() ?? 0),
      sleeping,
    ),
  );
  const frame = useSharedValue<Frame>({
    ...glowTarget("resting", heroY),
    time: 0,
    elapsed: 0,
    x: 0,
    y: 0,
    wave: 1,
    pulse: 0,
  });
  const lastDraw = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      rawTilt.set({ x: 0, y: 0 });
      return;
    }
    let live = true;
    let subscription: ReturnType<typeof DeviceMotion.addListener> | null = null;
    // A decorative effect never prompts for permission. Unsupported or denied sensors stay still.
    void Promise.all([
      DeviceMotion.isAvailableAsync(),
      DeviceMotion.getPermissionsAsync(),
    ])
      .then(([available, permission]) => {
        if (!live || !available || !permission.granted) return;
        let origin: { beta: number; gamma: number } | null = null;
        DeviceMotion.setUpdateInterval(reedMotion.glow.sensorMs);
        subscription = DeviceMotion.addListener((event) => {
          const rotation = event.rotation;
          if (
            !rotation ||
            !Number.isFinite(rotation.beta) ||
            !Number.isFinite(rotation.gamma)
          )
            return;
          origin ??= rotation;
          const x = Math.max(
            -1,
            Math.min(1, (rotation.gamma - origin.gamma) / 0.65),
          );
          const y = Math.max(
            -1,
            Math.min(1, (rotation.beta - origin.beta) / 0.65),
          );
          const rotated =
            event.orientation === 90
              ? { x: -y, y: x }
              : event.orientation === -90
                ? { x: y, y: -x }
                : event.orientation === 180
                  ? { x: -x, y: -y }
                  : { x, y };
          rawTilt.set(rotated);
        });
      })
      .catch(() => {});
    return () => {
      live = false;
      subscription?.remove();
      rawTilt.set({ x: 0, y: 0 });
    };
  }, [active, rawTilt]);
  const frames = useFrameCallback(() => {
    const now = Date.now();
    const waveAge = now - receivedAt.get();
    const pulseAge = now - wordAt.get();
    const reacting =
      waveAge < reedMotion.glow.waveMs ||
      pulseAge < reedMotion.glow.pulseMs ||
      state.get() !== "resting";
    const since = now - lastDraw.get();
    if (!reacting && since < reedMotion.presence.idleFrameMs) return;
    lastDraw.set(now);
    const dt = Math.min(50, Math.max(0, since));
    const ease = 1 - Math.exp(-dt / reedMotion.glow.smoothingMs);
    const next = target.get();
    const tilt = rawTilt.get();
    frame.modify((current) => {
      current.energy += (next.energy - current.energy) * ease;
      current.cy += (next.cy - current.cy) * ease;
      current.spread += (next.spread - current.spread) * ease;
      current.warmth += (next.warmth - current.warmth) * ease;
      current.breath += (next.breath - current.breath) * ease;
      current.speed += (next.speed - current.speed) * ease;
      current.x += (tilt.x - current.x) * ease;
      current.y += (tilt.y - current.y) * ease;
      current.time += (dt / 1000) * current.speed;
      current.elapsed += dt;
      current.wave = Math.min(1, Math.max(0, waveAge / reedMotion.glow.waveMs));
      current.pulse =
        Math.max(0, 1 - pulseAge / reedMotion.glow.pulseMs) *
        reedMotion.glow.pulseEnergy;
      return current;
    });
  }, false);
  useEffect(() => {
    frames.setActive(active);
    lastDraw.set(Date.now());
    if (!active)
      frame.modify((current) => ({
        ...current,
        ...glowTarget(state.get(), heroY),
        x: 0,
        y: 0,
        wave: 1,
        pulse: 0,
      }));
    return () => frames.setActive(false);
  }, [active, frame, frames, heroY, lastDraw, state]);
  const rendered = useDerivedValue(() =>
    active
      ? frame.get()
      : {
          ...frame.get(),
          ...target.get(),
          x: 0,
          y: 0,
          wave: 1,
          pulse: 0,
          time: 0,
        },
  );
  return (
    <Canvas style={{ width, height }}>
      <Group blendMode="plus">
        {metrics.radii.map((_, index) => (
          <GlowBlob
            key={index}
            index={index}
            frame={rendered}
            width={width}
            active={active}
          />
        ))}
        <SendWave frame={rendered} width={width} height={height} />
      </Group>
    </Canvas>
  );
}
function GlowBlob({
  frame,
  index,
  width,
  active,
}: {
  frame: SharedValue<Frame>;
  index: number;
  width: number;
  active: boolean;
}) {
  const { glowPalette: palette } = useReedTheme();
  const transparent = [palette.accent, palette.light, palette.deep].map(color => withColorAlpha(color, 0));
  const middleColors = [palette.accent, palette.light, palette.deep, palette.warm].map(color => withColorAlpha(color, .38));
  const center = useDerivedValue(() => {
    const f = frame.get(),
      t = f.time;
    const x =
      index === 0
        ? width * 0.5 + Math.sin(t * 0.21) * 38 + f.x * metrics.tilt[0]
        : index === 1
          ? width * 0.295 + Math.cos(t * 0.13) * 55 + f.x * metrics.tilt[1]
          : width * 0.73 + Math.sin(t * 0.11 + 1) * 48 - f.x * metrics.tilt[2];
    const y =
      f.cy +
      (index === 0
        ? Math.cos(t * 0.17) * 18 + f.y * 4
        : index === 1
          ? -30 + Math.sin(t * 0.19) * 28 + f.y * 8
          : 50 + Math.cos(t * 0.15 + 2) * 22 - f.y * 5);
    return vec(x, y);
  });
  const radius = useDerivedValue(
    () => metrics.radii[index] * frame.get().spread,
  );
  const opacity = useDerivedValue(() => {
    const f = frame.get();
    const breath = active
      ? f.breath *
        reedMotion.glow.breathAmount *
        Math.sin((f.elapsed * Math.PI * 2) / reedMotion.glow.breathMs)
      : 0;
    return Math.min(
      1,
      metrics.alpha[index] * (f.energy * (1 + breath) + f.pulse),
    );
  });
  const colors = useDerivedValue(() => {
    const base =
      index === 0 ? palette.accent : index === 1 ? palette.light : palette.deep;
    const color = interpolateColor(
      index === 0 ? 0 : frame.get().warmth * (index === 2 ? 0.5 : 1),
      [0, 1],
      [base, palette.warm],
    );
    // Numeric rgba manipulation stays in Reanimated; the zero-alpha endpoint is fixed.
    const middle = interpolateColor(
      index === 0 ? 0 : frame.get().warmth * (index === 2 ? 0.5 : 1),
      [0, 1],
      [middleColors[index], middleColors[3]],
    );
    return [color, middle, transparent[index]];
  });
  return (
    <Group opacity={opacity}>
      <Circle c={center} r={radius}>
        <RadialGradient
          c={center}
          r={radius}
          colors={colors}
          positions={[0, 0.5, 1]}
        />
      </Circle>
    </Group>
  );
}
function SendWave({
  frame,
  width,
  height,
}: {
  frame: SharedValue<Frame>;
  width: number;
  height: number;
}) {
  const { glowPalette: palette } = useReedTheme();
  const transparentWave = withColorAlpha(palette.wave, 0);
  const y = useDerivedValue(() => {
    const p = frame.get().wave;
    return height - (height + 160) * (1 - Math.pow(1 - p, 3));
  });
  const center = useDerivedValue(() => vec(width / 2, y.get()));
  const origin = useDerivedValue(() => vec(width / 2, y.get()));
  const opacity = useDerivedValue(
    () => metrics.waveAlpha * Math.sin(Math.PI * frame.get().wave),
  );
  const transform = [{ scaleX: metrics.waveX }, { scaleY: metrics.waveY }];
  return (
    <Group opacity={opacity} origin={origin} transform={transform}>
      <Circle c={center} r={metrics.waveRadius}>
        <RadialGradient
          c={center}
          r={metrics.waveRadius}
          colors={[palette.wave, transparentWave]}
        />
      </Circle>
    </Group>
  );
}

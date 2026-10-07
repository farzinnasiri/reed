import { useId } from "react";
import Svg, { Defs, RadialGradient, Stop, Ellipse } from "react-native-svg";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import {
  reedGlowMetrics as metrics,
} from "@/design/system";
import { useReedTheme } from "@/design/provider";
import { glowTarget, type GlowProps } from "./glow-state";
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
/** Static web fallback. State changes update gradients; scrolling only moves the ellipse. */
export function ReedGlowField({
  semanticState,
  width,
  height,
  heroY,
  scrollY,
  sleeping,
}: GlowProps) {
  const { glowPalette: palette } = useReedTheme();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const target = glowTarget(semanticState, heroY, sleeping);
  return (
    <Svg width={width} height={height}>
      <Defs>
        {metrics.radii.map((_, i) => {
          const color =
            i === 0
              ? palette.accent
              : target.warmth
                ? palette.warm
                : i === 1
                  ? palette.light
                  : palette.deep;
          return (
            <RadialGradient key={i} id={`${id}-${i}`}>
              <Stop
                offset="0"
                stopColor={color}
                stopOpacity={metrics.alpha[i] * target.energy}
              />
              <Stop
                offset="0.5"
                stopColor={color}
                stopOpacity={metrics.alpha[i] * target.energy * 0.38}
              />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </RadialGradient>
          );
        })}
      </Defs>
      {metrics.radii.map((_, i) => (
        <GlowBlob
          key={i}
          index={i}
          width={width}
          target={target}
          scrollY={scrollY}
          hero={heroY !== null}
          id={`${id}-${i}`}
        />
      ))}
    </Svg>
  );
}
function GlowBlob({
  index,
  target,
  width,
  id,
  scrollY,
  hero,
}: {
  index: number;
  target: ReturnType<typeof glowTarget>;
  width: number;
  id: string;
  scrollY?: GlowProps["scrollY"];
  hero: boolean;
}) {
  const props = useAnimatedProps(() => ({
    cx: width * [0.5, 0.44, 0.73][index],
    cy: target.cy - (hero ? (scrollY?.get() ?? 0) : 0) + [18, -30, 50][index],
    rx: metrics.radii[index] * target.spread,
    ry: metrics.radii[index] * target.spread,
  }));
  return <AnimatedEllipse animatedProps={props} fill={`url(#${id})`} />;
}

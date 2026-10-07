import { useId } from "react";
import Svg, { Defs, Filter, FeGaussianBlur, Rect } from "react-native-svg";
import { useReedTheme } from "@/design/provider";
import { reedComposerMetrics as metrics } from "@/design/system";
/** Focus feedback around a solid composer; it never blurs the surface behind it. */
export function ComposerHalo({
  width,
  height,
  radius,
}: {
  width: number;
  height: number;
  radius: number;
}) {
  const { theme } = useReedTheme();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const margin = metrics.focusHalo * 2;
  return (
    <Svg
      width={width + margin * 2}
      height={height + margin * 2}
      style={{
        position: "absolute",
        left: -margin,
        top: -margin,
        pointerEvents: "none",
      }}
    >
      <Defs>
        <Filter id={id} x="-50%" y="-100%" width="200%" height="300%">
          <FeGaussianBlur stdDeviation={metrics.focusHalo / 2} />
        </Filter>
      </Defs>
      <Rect
        x={margin}
        y={margin}
        width={width}
        height={height}
        rx={radius}
        fill={String(theme.colors.accent)}
        filter={`url(#${id})`}
      />
    </Svg>
  );
}

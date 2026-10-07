import { useEffect, useMemo, useRef, useState } from 'react';
import { interpolateColor } from 'react-native-reanimated';
import { reedMotion } from './motion';
import { glowPaletteForAccent, themeForAccent, type ReedAccent, type ReedGlowPalette } from './system';

/** A brief palette change shared by ordinary text, controls, SVG and native glow. */
export function useAccentAppearance(accent: ReedAccent, reduced: boolean) {
  const target = useMemo(() => ({ theme: themeForAccent(accent), glowPalette: glowPaletteForAccent(accent) }), [accent]);
  const [appearance, setAppearance] = useState(target);
  const visible = useRef(target);
  useEffect(() => {
    const from = visible.current;
    if (from === target) return;
    const publish = (next: typeof target) => { visible.current = next; setAppearance(next); };
    if (reduced) { publish(target); return; }
    let frame: number;
    let started: number | undefined;
    let lastPublished = -Infinity;
    const tick = (now: number) => {
      started ??= now;
      const progress = Math.min(1, (now - started) / reedMotion.theme.accentMs);
      if (progress === 1) { publish(target); return; }
      if (now - lastPublished >= reedMotion.theme.frameMs) {
        lastPublished = now;
        const blend = (a: string, b: string) => interpolateColor(progress, [0, 1], [a, b]);
        const colors = { ...target.theme.colors };
        for (const key of ['accent', 'accentInk', 'accentSoft', 'accentText'] as const) colors[key] = blend(from.theme.colors[key], target.theme.colors[key]);
        const glowPalette = { ...target.glowPalette };
        for (const key of Object.keys(glowPalette) as (keyof ReedGlowPalette)[]) glowPalette[key] = blend(from.glowPalette[key], target.glowPalette[key]);
        publish({ theme: { ...target.theme, colors }, glowPalette });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, target]);
  return appearance;
}

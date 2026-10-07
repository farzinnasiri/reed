import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useId } from 'react';
import { useReedTheme } from '@/design/provider';

export const GLOW_WIDTH = 540;
export const GLOW_HEIGHT = 440;
export const GLOW_TOP = -140;

function GlowDefinition({ id, accent }: { id: string; accent: string }) {
  return (
    <RadialGradient cx="50%" cy="50%" id={id} rx="50%" ry="50%">
      <Stop offset="0" stopColor={accent} stopOpacity="0.18" />
      <Stop offset="0.55" stopColor={accent} stopOpacity="0.05" />
      <Stop offset="1" stopColor={accent} stopOpacity="0" />
    </RadialGradient>
  );
}

/** The mockup's single static top gradient. Its caller positions and clips it. */
export function TodayGlow() {
  const { theme } = useReedTheme();
  const accent = String(theme.colors.accent);
  const id = `home-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <Svg height={GLOW_HEIGHT} width={GLOW_WIDTH}>
      <Defs>
        <GlowDefinition accent={accent} id={id} />
      </Defs>
      <Ellipse cx={GLOW_WIDTH / 2} cy={GLOW_HEIGHT / 2} fill={`url(#${id})`} rx={GLOW_WIDTH / 2} ry={GLOW_HEIGHT / 2} />
    </Svg>
  );
}

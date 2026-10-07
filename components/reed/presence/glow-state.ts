import type { SharedValue } from 'react-native-reanimated';
import type { ReedPresenceState } from './presence-state';
export type GlowProps = {
  semanticState: ReedPresenceState; scrollY?: SharedValue<number>;
  sleeping?: boolean;
  state: SharedValue<ReedPresenceState>; wordAt: SharedValue<number>; receivedAt: SharedValue<number>;
  width: number; height: number; heroY: number | null;
};
export function glowTarget(state: ReedPresenceState, heroY: number | null, sleeping = false) {
  'worklet';
  const thinking = state === 'thinking';
  const listening = state === 'listening' || state === 'following';
  const energy = sleeping ? 0.18 : state === 'concerned' ? 0.22 : thinking || listening ? 0.5 : state === 'speaking' || state === 'waitingOnYou' ? 0.45 : 0.35;
  return { energy, cy: heroY ?? (listening ? 110 : 40), spread: heroY === null ? 1 : 1.15, warmth: thinking ? 0.15 : 0, breath: thinking ? 1 : 0, speed: sleeping ? 0.5 : thinking ? 2.5 : 1 };
}

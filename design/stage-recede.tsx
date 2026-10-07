import { createContext, useContext, type ReactNode } from 'react';
import { interpolate, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useReedReducedMotion as useReducedMotion } from './use-reed-reduced-motion';
import { reedMotion } from '@/design/motion';

/**
 * "Scrim and recede" (DESIGN.md): while a sheet or the expanded Pulse is open, the home stage
 * scales to 0.955 and fades to 0.55. One shared 0..1 value drives it; whatever opens writes
 * it, the stage reads it with `useStageRecedeStyle`.
 */
const StageRecedeContext = createContext<SharedValue<number> | null>(null);

export function StageRecedeProvider({ children }: { children: ReactNode }) {
  const progress = useSharedValue(0);

  return <StageRecedeContext.Provider value={progress}>{children}</StageRecedeContext.Provider>;
}

/** The recede progress (0 = settled, 1 = receded), or null outside a `StageRecedeProvider`. */
export function useStageRecedeProgress() {
  return useContext(StageRecedeContext);
}

export function useStageRecedeStyle() {
  const progress = useStageRecedeProgress();
  const reduceMotion = useReducedMotion();

  if (!progress) {
    throw new Error('useStageRecedeStyle must be used inside StageRecedeProvider.');
  }

  return useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, reedMotion.opacity.stageRecede]),
    transform: [{ scale: reduceMotion ? 1 : interpolate(progress.value, [0, 1], [1, reedMotion.scale.stageRecede]) }],
  }));
}

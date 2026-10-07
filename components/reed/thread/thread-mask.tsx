import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
/** Fade the thread itself, preserving the single glow behind its solid message bubbles. */
export function ThreadMask({ children, top, fade }: { children: ReactNode; top: number; fade: number }) {
  const style: ViewStyle & { maskImage: string; WebkitMaskImage: string } = { flex: 1, maskImage: `linear-gradient(to bottom, transparent ${top}px, black ${top + fade}px)`, WebkitMaskImage: `linear-gradient(to bottom, transparent ${top}px, black ${top + fade}px)` };
  return <View style={style}>{children}</View>;
}

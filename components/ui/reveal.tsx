import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useEntryAnimation } from '@/design/use-entry-animation';

/** A section that rises into place once when it mounts, `delay` ms after its screen (Today's 80/140/200ms rhythm). */
export function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const entry = useEntryAnimation({ delay, spring: 'smooth', translateY: 8 });
  return <Animated.View style={[entry, style]}>{children}</Animated.View>;
}

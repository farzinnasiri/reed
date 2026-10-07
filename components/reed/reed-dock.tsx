import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { LiveDot } from '@/components/ui/live-dot';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle, reedMotion, reedSprings } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedComposerMetrics as metrics, withColorAlpha } from '@/design/system';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { styles } from './reed.styles';

const REED_DOCK_FADE_HEIGHT = 24;

/** The keyboard's shared position carries the entire dock, including its clearance. */
export function ReedDock({ keyboardLift, bottomPadding, children, focused, hasOpenSession, onHeightChange, onOpenSession }: {
  keyboardLift: SharedValue<number>;
  bottomPadding: number;
  children: ReactNode;
  focused: boolean;
  hasOpenSession: boolean;
  onHeightChange: (height: number) => void;
  onOpenSession: () => void;
}) {
  const { theme } = useReedTheme();
  const canvas = String(theme.colors.canvas);
  const keyboardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -keyboardLift.get() }] }));
  return (
    <Animated.View
      onLayout={event => onHeightChange(Math.round(event.nativeEvent.layout.height))}
      style={[styles.dock, { backgroundColor: canvas, bottom: 0, paddingBottom: bottomPadding }, keyboardStyle]}
    >
      <LinearGradient colors={[withColorAlpha(canvas, 0), canvas]} style={[styles.dockFade, { height: REED_DOCK_FADE_HEIGHT, top: -REED_DOCK_FADE_HEIGHT }]} />
      <View style={[styles.dockRow, styles.column, { paddingHorizontal: theme.spacing.chromeGutter }]}>
        <SessionButton focused={focused} hasOpenSession={hasOpenSession} onPress={onOpenSession} />
        <View style={styles.dockComposer}>{children}</View>
      </View>
    </Animated.View>
  );
}

function SessionButton({ focused, hasOpenSession, onPress }: { focused: boolean; hasOpenSession: boolean; onPress: () => void }) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const focus = useSharedValue(focused ? 1 : 0);
  useEffect(() => { focus.set(reduced ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, reedSprings.pop)); }, [focus, focused, reduced]);
  const frameStyle = useAnimatedStyle(() => {
    const t = focus.get();
    const rest = hasOpenSession ? metrics.sessionLive : metrics.sessionRest;
    return { width: rest + (metrics.sessionFocused - rest) * t, height: metrics.sessionRest + (metrics.sessionFocused - metrics.sessionRest) * t,
      backgroundColor: interpolateColor(Math.max(0, Math.min(1, t)), [0, 1], [String(theme.colors.accent), String(theme.colors.surfaceRaised)]) };
  });
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - focus.get() * (1 - reedMotion.composer.sessionIconScale) }] }));
  return (
    <Animated.View style={[{ borderRadius: theme.radii.pill }, frameStyle]}>
      <Pressable
        accessibilityHint="Opens workout and session options."
        accessibilityLabel={hasOpenSession ? 'Workout options, resume available' : 'Workout options'}
        accessibilityRole="button"
        hitSlop={4}
        onPress={onPress}
        style={({ pressed }) => [{ alignItems: 'center', flex: 1, flexDirection: 'row', gap: theme.spacing.xs, justifyContent: 'center' }, getTapScaleStyle(pressed)]}
      >
        {hasOpenSession && !focused ? <><LiveDot color={theme.colors.accentText} /><ReedText style={{ color: theme.colors.accentText }} variant="bodyStrong">Resume</ReedText></> : (
          <Animated.View style={iconStyle}><Ionicons color={String(focused ? theme.colors.inkSecondary : theme.colors.accentText)} name="barbell" size={24} /></Animated.View>
        )}
        {hasOpenSession && focused ? <View style={{ position: 'absolute', right: theme.spacing.xs, top: theme.spacing.xs }}><LiveDot color={theme.colors.accent} /></View> : null}
      </Pressable>
    </Animated.View>
  );
}

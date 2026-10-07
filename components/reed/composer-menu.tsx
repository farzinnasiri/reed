import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle, reedMotion, reedSprings } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedComposerMetrics } from '@/design/system';
import { useEntryAnimation } from '@/design/use-entry-animation';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { retainComposerFocus, type ComposerMenuAnchor } from './reed-composer';
import { useComposerFocusRetention } from './use-composer-focus-retention';

type ComposerMenuProps = {
  anchor: ComposerMenuAnchor | null;
  attachmentsDisabled: boolean;
  onClose: () => void;
  onPickCamera: () => void;
  onPickFiles: () => void;
  onPickLibrary: () => void;
  onQuickLog: () => void;
  visible: boolean;
};

/** An anchored menu in the same window as the editor, so opening it retains the keyboard. */
export function ComposerMenu({ anchor, attachmentsDisabled, onClose, onPickCamera, onPickFiles, onPickLibrary, onQuickLog, visible }: ComposerMenuProps) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [previousOpen, setPreviousOpen] = useState(visible);
  if (previousOpen !== visible) {
    setPreviousOpen(visible);
    if (visible) setMounted(true);
  }
  const menuRef = useRef<View>(null);
  useComposerFocusRetention(menuRef, mounted);
  const [height, setHeight] = useState(reedComposerMetrics.menuRowHeight * 4 + theme.spacing.md);
  const opacity = useSharedValue(0);
  const scale = useSharedValue<number>(reedMotion.composer.menuFromScale);
  const pendingAction = useRef<(() => void) | null>(null);
  const finishClose = useCallback(() => {
    setMounted(false);
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  }, []);
  useEffect(() => {
    if (visible) {
      pendingAction.current = null;

      opacity.set(withTiming(1, { duration: reedMotion.composer.iconFadeMs }));
      scale.set(reduced ? 1 : withSpring(1, reedSprings.pop));
    } else if (mounted) {
      opacity.set(withTiming(0, { duration: reedMotion.composer.menuFadeMs }, finished => { if (finished) scheduleOnRN(finishClose); }));
      scale.set(reduced ? 1 : withTiming(reedMotion.composer.menuFromScale, { duration: reedMotion.composer.menuFadeMs }));
    }
  }, [finishClose, mounted, opacity, reduced, scale, visible]);
  useEffect(() => {
    if (!visible) return;
    if (Platform.OS === 'android') {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
      return () => subscription.remove();
    }
    if (Platform.OS === 'web') {
      const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
      document.addEventListener('keydown', close);
      return () => document.removeEventListener('keydown', close);
    }
  }, [onClose, visible]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.get() * reedMotion.opacity.composerMenuScrim }));
  const menuStyle = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: reduced ? 1 : scale.get() }] }));
  if (!mounted || !anchor) return null;
  const left = Math.max(theme.spacing.chromeGutter, Math.min(anchor.x, width - reedComposerMetrics.menuWidth - theme.spacing.chromeGutter));
  const top = Math.max(theme.spacing.chromeGutter, anchor.y - height - theme.spacing.xs);
  function choose(action: () => void) { pendingAction.current = action; onClose(); }
  return (
    <View ref={menuRef} accessibilityViewIsModal style={[StyleSheet.absoluteFill, { pointerEvents: visible ? 'auto' : 'none', zIndex: 60 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }, scrimStyle]} />
      <Pressable accessibilityLabel="Close actions menu" accessibilityRole="button" onPress={onClose} onPressIn={retainComposerFocus} style={StyleSheet.absoluteFill} />
      <Animated.View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={[styles.menu, { paddingVertical: theme.spacing.xs, backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radii.lg, left, top, width: reedComposerMetrics.menuWidth }, menuStyle]}>
        <MenuRow index={0} icon="flash-outline" label="Quick log" onPress={() => choose(onQuickLog)} />
        <MenuRow disabled={attachmentsDisabled} divider index={1} icon="camera-outline" label="Take photo" onPress={() => choose(onPickCamera)} />
        <MenuRow disabled={attachmentsDisabled} index={2} icon="images-outline" label="Photo library" onPress={() => choose(onPickLibrary)} />
        <MenuRow disabled={attachmentsDisabled} index={3} icon="document-outline" label="Choose files" onPress={() => choose(onPickFiles)} />
      </Animated.View>
    </View>
  );
}

function MenuRow({ disabled = false, divider = false, icon, index, label, onPress }: {
  disabled?: boolean;
  divider?: boolean;
  icon: ComponentProps<typeof Ionicons>['name'];
  index: number;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const enter = useEntryAnimation({ delay: reduced ? 0 : reedMotion.composer.menuRowDelayMs + index * reedMotion.composer.menuRowStaggerMs, spring: 'smooth', translateY: reedMotion.composer.menuRowY });
  return (
    <Animated.View style={enter}>
      <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onPressIn={retainComposerFocus}
        style={({ pressed }) => [styles.row, { gap: theme.spacing.chromeGutter, paddingHorizontal: theme.spacing.md }, divider ? { borderTopColor: theme.colors.line, borderTopWidth: 1 } : null, getTapScaleStyle(pressed, disabled)]}>
        <Ionicons color={String(theme.colors.inkSecondary)} name={icon} size={20} />
        <ReedText variant="body">{label}</ReedText>
      </Pressable>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  menu: { position: 'absolute', transformOrigin: '0% 100%' },
  row: { alignItems: 'center', flexDirection: 'row', minHeight: reedComposerMetrics.menuRowHeight },
});

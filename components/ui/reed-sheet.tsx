import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { ReduceMotion, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useReedReducedMotion as useReducedMotion } from '@/design/use-reed-reduced-motion';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reedMotion, reedSprings } from '@/design/motion';
import { criticalSpring } from '@/design/sheet-spring';
import { useReedTheme } from '@/design/provider';
import { useStageRecedeProgress } from '@/design/stage-recede';
import { reedSessionMetrics } from '@/design/system';

type ReedSheetProps = {
  children: ReactNode;
  /**
   * Show the sheet while true and close it when false. The usual way to drive a sheet; use the
   * `ref` instead (present/dismiss) only when opening is an event rather than state.
   */
  open?: boolean;
  onDismiss?: () => void;
  ref?: Ref<BottomSheetModal>;
  /** Wrap the content in a scroll view; the sheet still grows with its content up to the screen. */
  scrollable?: boolean;
  /** Fixed conversation height; content owns its list and footer. */
  conversation?: boolean;
  /**
   * A focused sheet with a fixed header/footer; its content owns scrolling. Give several fractions
   * for a sheet that rests at more than one height (smallest first); the content is laid out at the
   * tallest, so moving between them never re-lays it out.
   */
  heightFraction?: number | readonly number[];
  /** Which of the `heightFraction`s the sheet rests at; change it to move the sheet there. */
  snapIndex?: number;
  /** Called when the sheet comes to rest at one of its heights, including after a drag. */
  onSnapIndexChange?: (index: number) => void;
  /** A sheet can return to its parent section before dismissing. */
  onBack?: () => void;
  position?: SharedValue<number>;
};

// `reedSprings.sheet` (450ms, dampingRatio 1) as plain physics: gorhom treats any config that has
// `duration` as a timing animation, so the duration-based token cannot be passed to it.
const SHEET_SPRING = criticalSpring(reedSprings.sheet.duration);

// Reduce Motion: place the sheet immediately, then fade it. Dismiss waits for the fade before
// unmounting the modal, so gorhom cannot turn it into a slide or an abrupt disappearance.
const SHEET_REDUCED_MOTION = {
  duration: 0,
  reduceMotion: ReduceMotion.Never,
} as const;

/**
 * The bottom sheet: `sheet` colour, 36 top radius, grabber, scrim, spring, keyboard handling,
 * dynamic height and the Android back button (Escape on web). Present it with `ref.current?.present()`; it needs
 * `BottomSheetModalProvider` above it. If a `StageRecedeProvider` is mounted, opening the sheet
 * recedes the stage.
 */
export function ReedSheet({ children, onDismiss, open, ref, scrollable = false, conversation = false, heightFraction, onBack, onSnapIndexChange, position, snapIndex }: ReedSheetProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const fractions = heightFraction === undefined
    ? conversation ? [reedSessionMetrics.sheetFraction] : undefined
    : typeof heightFraction === 'number' ? [heightFraction] : [...heightFraction];
  // Content is laid out at the tallest height; the sheet only slides over it.
  const fixedFraction = fractions ? Math.max(...fractions) : undefined;
  const reduceMotion = useReducedMotion();
  const stageRecede = useStageRecedeProgress();
  const animatedIndex = useSharedValue(-1);
  const opacity = useSharedValue(0);
  const [isOpen, setIsOpen] = useState(false);
  const sheetRef = useRef<BottomSheetModal | null>(null);
  const restingIndex = useRef(snapIndex ?? 0);
  const handleRef = useRef<BottomSheetModal | null>(null);
  const wasPresented = useRef(false);
  // A visible-prop cleanup often follows gorhom's onDismiss. Dismissing again at that point
  // leaves its internal status as DISMISSING, so a later present never renders the portal.
  const phaseRef = useRef<'closed' | 'open' | 'closing'>('closed');

  useAnimatedReaction(
    () => ({ index: animatedIndex.value, opacity: opacity.value }),
    ({ index, opacity: fade }) => {
      if (stageRecede) {
        stageRecede.value = reduceMotion ? fade : Math.min(1, Math.max(0, index + 1));
      }
    },
  );
  const fadeStyle = useAnimatedStyle(() => ({ opacity: reduceMotion ? opacity.value : 1 }));
  const finishDismiss = useCallback(() => sheetRef.current?.dismiss(SHEET_REDUCED_MOTION), []);
  const dismissSheet = useCallback((configs?: Parameters<BottomSheetModal['dismiss']>[0]) => {
    if (phaseRef.current !== 'open') return;
    phaseRef.current = 'closing';
    if (!reduceMotion) {
      sheetRef.current?.dismiss(configs);
      return;
    }
    opacity.value = withTiming(0, { duration: reedMotion.durations.standard, reduceMotion: ReduceMotion.Never }, finished => {
      if (finished) scheduleOnRN(finishDismiss);
    });
  }, [finishDismiss, opacity, reduceMotion]);

  useEffect(() => {
    if (open === undefined) return;
    if (open) {
      wasPresented.current = true;
      handleRef.current?.present();
    } else if (wasPresented.current) {
      handleRef.current?.dismiss();
    }
  }, [open]);

  // Move to the requested height. The sheet reports where it came to rest, so a request for the
  // height it is already at (or just dragged to) does nothing.
  useEffect(() => {
    if (snapIndex === undefined || !isOpen || restingIndex.current === snapIndex) return;
    restingIndex.current = snapIndex;
    sheetRef.current?.snapToIndex(snapIndex);
  }, [isOpen, snapIndex]);

  // The web equivalent of the Android back button.
  useEffect(() => {
    if (!isOpen || Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (onBack) onBack();
      else dismissSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissSheet, isOpen, onBack]);

  useEffect(() => {
    if (!isOpen || Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (onBack) onBack();
      else dismissSheet();
      return true;
    });

    return () => subscription.remove();
  }, [dismissSheet, isOpen, onBack]);

  const setRefs = useCallback(
    (instance: BottomSheetModal | null) => {
      sheetRef.current = instance;
      const handle: BottomSheetModal | null = instance ? {
        ...instance,
        dismiss: dismissSheet,
        present: (...args: Parameters<BottomSheetModal['present']>) => {
          phaseRef.current = 'open';
          opacity.value = reduceMotion ? 0 : 1;
          instance.present(...args);
        },
      } : null;
      handleRef.current = handle;
      if (typeof ref === 'function') {
        ref(handle);
      } else if (ref) {
        ref.current = handle;
      }
    },
    [dismissSheet, opacity, reduceMotion, ref],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => reduceMotion ? (
      <Animated.View style={[props.style, { backgroundColor: theme.colors.scrim }, fadeStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={() => dismissSheet()} style={StyleSheet.absoluteFill} />
      </Animated.View>
    ) : (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={1}
        pressBehavior="close"
        style={[props.style, { backgroundColor: theme.colors.scrim }]}
      />
    ),
    [dismissSheet, fadeStyle, reduceMotion, theme.colors.scrim],
  );

  const contentStyle = {
    paddingBottom: insets.bottom + theme.spacing.md,
    paddingHorizontal: theme.spacing.gutter,
  };

  return (
    <BottomSheetModal
      android_keyboardInputMode="adjustResize"
      animatedIndex={animatedIndex}
      animatedPosition={position}
      animationConfigs={reduceMotion ? SHEET_REDUCED_MOTION : SHEET_SPRING}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.colors.sheet,
        borderTopLeftRadius: theme.radii.sheet,
        borderTopRightRadius: theme.radii.sheet,
      }}
      enableDynamicSizing={fixedFraction === undefined}
      index={snapIndex}
      snapPoints={fractions?.map(fraction => `${fraction * 100}%`)}
      enablePanDownToClose
      handleStyle={fixedFraction !== undefined ? { height: reedSessionMetrics.handle, paddingVertical: 0, justifyContent: 'center' } : undefined}
      handleIndicatorStyle={{
        backgroundColor: theme.colors.surfaceHigh,
        borderRadius: theme.radii.pill,
        height: 5,
        width: 38,
      }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onAnimate={(_from, to) => setIsOpen(to >= 0)}
      onChange={index => {
        setIsOpen(index >= 0);
        if (index >= 0) {
          restingIndex.current = index;
          onSnapIndexChange?.(index);
        }
        if (reduceMotion) opacity.value = index >= 0
          ? withTiming(1, { duration: reedMotion.durations.standard, reduceMotion: ReduceMotion.Never })
          : 0;
      }}
      onDismiss={() => {
        phaseRef.current = 'closed';
        onDismiss?.();
      }}
      ref={setRefs}
      style={fadeStyle}
      topInset={insets.top}
    >
      {scrollable ? (
        <BottomSheetScrollView contentContainerStyle={contentStyle}>{children}</BottomSheetScrollView>
      ) : (
        <BottomSheetView style={fixedFraction !== undefined ? { flex: 1, ...(Platform.OS === 'web' ? { height: (viewportHeight - insets.top) * fixedFraction - reedSessionMetrics.handle } : {}) } : contentStyle}>{children}</BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

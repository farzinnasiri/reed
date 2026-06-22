import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSolidGlassCardTokens } from '@/components/ui/glass-material';
import { ReedText } from '@/components/ui/reed-text';
import { createTiming, getTapScaleStyle, reedEasing, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii, withColorAlpha } from '@/design/system';
import { playOnboardingSwipeCommitFeedback } from '@/lib/onboarding-feedback';
import { FIRST_EXPERIENCE_REED_MARK_ROOT_TOP, FIRST_EXPERIENCE_REED_MARK_SIZE } from './first-experience-layout';

type StepGestureDemoProps = {
  displayName: string;
  onBack: () => Promise<void> | void;
  onContinue: () => void;
};

const SWIPE_THRESHOLD = 104;
const SHOULD_USE_NATIVE_DRIVER = Platform.OS !== 'web';
const CARD_EXIT_DURATION_MS = 420;
const HANDOFF_DURATION_MS = 1500;

export function StepGestureDemo({ displayName, onBack, onContinue }: StepGestureDemoProps) {
  const { theme } = useReedTheme();
  const solidGlass = getSolidGlassCardTokens(theme);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;
  const cueProgress = useRef(new Animated.Value(0)).current;
  const completionProgress = useRef(new Animated.Value(0)).current;
  const isCompleting = useRef(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [stageY, setStageY] = useState(0);
  const [cardStageY, setCardStageY] = useState(0);
  const [cardFrameLayout, setCardFrameLayout] = useState<{ height: number; y: number } | null>(null);
  const flyoutDistance = Math.max(width * 1.1, 420);
  const firstName = displayName.trim().split(/\s+/)[0] || 'there';
  const cardFrameRootCenterY = cardFrameLayout
    ? stageY + cardStageY + cardFrameLayout.y + cardFrameLayout.height / 2
    : null;

  const rotation = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-flyoutDistance, 0, flyoutDistance],
        outputRange: ['-18deg', '0deg', '18deg'],
        extrapolate: 'clamp',
      }),
    [flyoutDistance, translateX],
  );

  const underlayOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, 24, 150],
        outputRange: [0, 0.28, 1],
        extrapolate: 'clamp',
      }),
    [translateX],
  );

  const cueTranslateX = cueProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 30],
  });

  const cueOpacity = cueProgress.interpolate({
    inputRange: [0, 0.2, 0.82, 1],
    outputRange: [0.3, 0.9, 0.9, 0.25],
  });

  const chromeOpacity = completionProgress.interpolate({
    inputRange: [0, 0.08, 0.34],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  const cardOpacity = completionProgress.interpolate({
    inputRange: [0, 0.22, 1],
    outputRange: [1, 0, 0],
  });

  const underlayFadeOpacity = Animated.multiply(underlayOpacity, chromeOpacity);

  const arrivalOpacity = completionProgress.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [0, 1, 1],
  });

  const arrivalScale = completionProgress.interpolate({
    inputRange: [0, 0.12, 0.64, 1],
    outputRange: [0.82, 1, 0.98, 1],
  });

  const arrivalY = completionProgress.interpolate({
    inputRange: [0, 0.28, 1],
    outputRange: [
      0,
      0,
      cardFrameRootCenterY === null
        ? 0
        : FIRST_EXPERIENCE_REED_MARK_ROOT_TOP + FIRST_EXPERIENCE_REED_MARK_SIZE / 2 - cardFrameRootCenterY,
    ],
  });

  const checkOpacity = completionProgress.interpolate({
    inputRange: [0, 0.08, 0.56, 0.72],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });

  const reedOpacity = completionProgress.interpolate({
    inputRange: [0, 0.6, 0.78, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !isCompleting.current &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 8,
        onPanResponderGrant: () => {
          setHasInteracted(true);
          translateX.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          translateX.setValue(Math.max(-20, gestureState.dx));
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > SWIPE_THRESHOLD) {
            completeGesture();
            return;
          }
          resetGesture();
        },
        onPanResponderTerminate: resetGesture,
      }),
    [translateX, flyoutDistance],
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        createTiming(cueProgress, 1, reedMotion.durations.mode + 420, reedEasing.easeInOut, SHOULD_USE_NATIVE_DRIVER),
        Animated.delay(520),
        createTiming(cueProgress, 0, reedMotion.durations.micro, reedEasing.easeOut, SHOULD_USE_NATIVE_DRIVER),
        Animated.delay(780),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [cueProgress]);

  function resetGesture() {
    createTiming(translateX, 0, reedMotion.durations.standard, reedEasing.easeOut, SHOULD_USE_NATIVE_DRIVER).start();
  }

  function completeGesture() {
    if (isCompleting.current) {
      return;
    }

    isCompleting.current = true;
    playOnboardingSwipeCommitFeedback();
    Animated.sequence([
      Animated.parallel([
        createTiming(translateX, flyoutDistance, CARD_EXIT_DURATION_MS, reedEasing.easeOut, SHOULD_USE_NATIVE_DRIVER),
        createTiming(completionProgress, 1, HANDOFF_DURATION_MS, reedEasing.easeInOut, SHOULD_USE_NATIVE_DRIVER),
      ]),
      Animated.delay(180),
    ]).start(() => {
      onContinue();
    });
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.canvas,
          paddingBottom: insets.bottom + theme.spacing.xl,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.md,
        },
      ]}
    >
      <Animated.View style={[styles.header, { opacity: chromeOpacity }]}>
        <Pressable
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [styles.backLink, getTapScaleStyle(pressed)]}
        >
          <ReedText tone="muted" variant="bodyStrong">
            Back
          </ReedText>
        </Pressable>
        <ReedText variant="brand">REED</ReedText>
      </Animated.View>

      <View
        onLayout={event => {
          setStageY(event.nativeEvent.layout.y);
        }}
        style={styles.stage}
      >
        <Animated.View style={[styles.copyBlock, { opacity: chromeOpacity }]}>
          <ReedText tone="muted" variant="bodyStrong">
            {firstName}, start with the motion.
          </ReedText>
          <ReedText style={styles.title} variant="display">
            Log the first set.
          </ReedText>
        </Animated.View>

        <View
          onLayout={event => {
            setCardStageY(event.nativeEvent.layout.y);
          }}
          style={styles.cardStage}
        >
          <Animated.View
            style={[
              styles.swipeCue,
              { pointerEvents: 'none' },
              {
                opacity: hasInteracted ? 0 : Animated.multiply(cueOpacity, chromeOpacity),
                transform: [{ translateX: cueTranslateX }],
              },
            ]}
          >
            <View style={styles.swipeCueTrack}>
              <View style={[styles.cueRule, { backgroundColor: theme.colors.textPrimary }]} />
              <Ionicons color={String(theme.colors.textPrimary)} name="arrow-forward" size={28} />
            </View>
            <ReedText variant="label">Swipe right</ReedText>
          </Animated.View>

          <View
            onLayout={event => {
              const { y, height } = event.nativeEvent.layout;
              setCardFrameLayout({ height, y });
            }}
            style={styles.cardFrame}
          >
            <Animated.View
              style={[
                styles.successMark,
                {
                  opacity: arrivalOpacity,
                  transform: [{ translateY: arrivalY }, { scale: arrivalScale }],
                },
              ]}
            >
              <View
                style={[
                  styles.successCore,
                  {
                    backgroundColor: theme.colors.accentPrimary,
                  ...(Platform.OS === 'web'
                    ? { boxShadow: `0px 18px 28px ${withColorAlpha(String(theme.colors.accentPrimary), 0.38)}` }
                    : { shadowColor: String(theme.colors.accentPrimary) }),
                },
              ]}
            >
                <Animated.View style={[styles.successGlyph, { opacity: checkOpacity }]}>
                  <Ionicons color={String(theme.colors.accentPrimaryText)} name="checkmark" size={26} />
                </Animated.View>
                <Animated.View style={[styles.successGlyph, { opacity: reedOpacity }]}>
                  <ReedText style={styles.successLetter} variant="section">
                    R
                  </ReedText>
                </Animated.View>
              </View>
            </Animated.View>

            <Animated.View style={[styles.underlay, { opacity: underlayFadeOpacity }]}>
              <LinearGradient
                colors={[theme.mode === 'dark' ? 'rgba(22, 163, 74, 0.52)' : 'rgba(22, 163, 74, 0.42)', 'transparent']}
                end={{ x: 0, y: 0.5 }}
                start={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.underlayCopy}>
                <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="label">
                  Log set
                </ReedText>
              </View>
            </Animated.View>

            <Animated.View
              {...panResponder.panHandlers}
              accessibilityLabel="Swipe right to log the demo set"
              accessibilityRole="adjustable"
              style={[
                styles.demoCard,
                solidGlass,
                {
                  opacity: cardOpacity,
                  transform: [{ translateX }, { rotate: rotation }],
                },
              ]}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.cardHeaderCopy}>
                  <ReedText tone="muted" variant="caption">
                    Set 1
                  </ReedText>
                  <ReedText numberOfLines={1} variant="title">Dumbbell bench</ReedText>
                </View>
                <View
                  style={[
                    styles.warmupChip,
                    {
                      backgroundColor: theme.colors.controlFill,
                      borderColor: theme.colors.controlBorder,
                    },
                  ]}
                >
                  <ReedText variant="caption">Warm-up</ReedText>
                </View>
              </View>

              <View style={styles.metricsStack}>
                <MockMetric label="Load · prev 22.5 kg" value="24" suffix="kg" />
                <MockMetric label="Reps · prev 8" value="8" />
                <MockMetric label="Effort" value="4" suffix="rpe" />
              </View>

              <View style={styles.cardFoot}>
                <ReedText tone="muted" variant="caption">
                  Swipe right to log
                </ReedText>
              </View>
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

function MockMetric({ label, suffix, value }: { label: string; suffix?: string; value: string }) {
  const { theme } = useReedTheme();

  return (
    <View style={styles.metricRow}>
      <View style={styles.metricCopy}>
        <ReedText style={{ color: theme.colors.textMuted }} variant="label">
          {label}
        </ReedText>
        <View style={styles.metricValueRow}>
          <ReedText
            style={[
              styles.metricValue,
              {
                color: theme.colors.accentPrimary,
              },
            ]}
            variant="display"
          >
            {value}
          </ReedText>
          {suffix ? (
            <ReedText style={styles.metricSuffix} tone="muted" variant="bodyStrong">
              {suffix}
            </ReedText>
          ) : null}
        </View>
      </View>
      <View style={styles.tickColumn}>
        {[-2, -1, 0, 1, 2].map(offset => (
          <View
            key={offset}
            style={[
              styles.tick,
              {
                backgroundColor: offset === 0 ? theme.colors.textPrimary : theme.colors.borderSoft,
                opacity: offset === 0 ? 0.9 : 0.48,
                width: offset === 0 ? 22 : 12,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
  },
  backLink: {
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 72,
  },
  stage: {
    flex: 1,
    gap: 14,
  },
  copyBlock: {
    gap: 8,
    paddingBottom: 2,
  },
  title: {
    maxWidth: 260,
  },
  cardStage: {
    alignSelf: 'center',
    flex: 1,
    minHeight: 0,
    maxWidth: 440,
    position: 'relative',
    width: '100%',
  },
  cardFrame: {
    alignSelf: 'center',
    flex: 1,
    minHeight: 0,
    position: 'relative',
    width: '100%',
  },
  underlay: {
    alignItems: 'flex-start',
    borderRadius: reedRadii.xl,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    overflow: 'hidden',
    paddingLeft: 30,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  underlayCopy: {
    alignItems: 'center',
    gap: 8,
  },
  demoCard: {
    bottom: 0,
    borderRadius: reedRadii.xl,
    borderWidth: 1.5,
    left: 0,
    overflow: 'hidden',
    paddingBottom: 20,
    paddingHorizontal: 22,
    paddingTop: 24,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  cardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cardHeaderCopy: {
    flex: 1,
    gap: 8,
  },
  warmupChip: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metricsStack: {
    flex: 1,
    gap: 12,
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  metricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 108,
  },
  metricCopy: {
    flex: 1,
    gap: 4,
  },
  metricValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  metricValue: {
    fontSize: 58,
    letterSpacing: -1.8,
    lineHeight: 58,
  },
  metricSuffix: {
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  tickColumn: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    width: 30,
  },
  tick: {
    borderRadius: reedRadii.pill,
    height: 2,
  },
  cardFoot: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    minHeight: 30,
  },
  successMark: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCore: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    elevation: 18,
    height: FIRST_EXPERIENCE_REED_MARK_SIZE,
    justifyContent: 'center',
    ...Platform.select({
      web: {},
      default: {
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.38,
        shadowRadius: 28,
      },
    }),
    width: FIRST_EXPERIENCE_REED_MARK_SIZE,
  },
  successGlyph: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successLetter: {
    color: '#f8fafc',
    fontSize: 24,
    lineHeight: 28,
  },
  swipeCue: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    justifyContent: 'center',
    left: 54,
    minHeight: 76,
    position: 'absolute',
    right: 54,
    top: '44%',
    zIndex: 8,
  },
  swipeCueTrack: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  cueRule: {
    borderRadius: reedRadii.pill,
    height: 2,
    width: 92,
  },
});

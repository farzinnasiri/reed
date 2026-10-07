import { Animated, Easing, LayoutAnimation, Platform, UIManager, type ViewStyle } from 'react-native';
import { Easing as ReanimatedEasing, LinearTransition, type WithSpringConfig } from 'react-native-reanimated';

/**
 * Spring presets tuned to settle at roughly the same perceived duration as
 * the timing tokens they replace: snappy ≈ micro (100ms), smooth ≈ standard
 * (180ms), gentle ≈ mode (240ms).
 *
 * All use mass: 1 so the only knobs are stiffness (speed) and damping
 * (overshoot). Higher damping → less bounce → more "serious" feel, which
 * aligns with DESIGN-PRINCIPLES.md: "motion serves understanding".
 */
export const reedSprings = {
  /** Press feedback, toggles — fast settle, minimal overshoot. */
  snappy: { damping: 28, mass: 1, stiffness: 400 } satisfies WithSpringConfig,
  /** Tab indicator, content reveals — slight overshoot, medium settle. */
  smooth: { damping: 22, mass: 1, stiffness: 200 } satisfies WithSpringConfig,
  /** Sheet enter, mode transitions — gentle settle with perceivable follow-through. */
  gentle: { damping: 18, mass: 1, stiffness: 120 } satisfies WithSpringConfig,
  /** Pulse expand/collapse, mascot glide, stage recede — duration-based, near-critical damping. */
  morph: { dampingRatio: 0.92, duration: 550 } satisfies WithSpringConfig,
  /** Bottom sheets — duration-based, critically damped (no bounce). */
  sheet: { dampingRatio: 1, duration: 450 } satisfies WithSpringConfig,
  /** Presence reactions and composer feedback. */
  pop: { dampingRatio: 0.62, duration: 380 } satisfies WithSpringConfig,
  /** A composer draft or suggestion becoming its committed message. */
  lift: { dampingRatio: 0.86, duration: 480 } satisfies WithSpringConfig,
} as const;

export const reedMotion = {
  body: { turnMs: 450 },
  widgets: { revealMs: 220, contentY: 8, chevronDegrees: -90, easing: 'ease-out' },
  launch: { durationMs: 3400, fallbackMs: 800, arrivalEnd: .16, orbitEnd: .57, gatherEnd: .8, objectStagger: .045, orbitRadians: 1.8, gatherScale: .08, cutoutInitialScale: .7, cutoutTiltDegrees: 16, titleDelayMs: 150, subtitleDelayMs: 450, stripsDelayMs: 900, promiseDelayMs: 1300, actionsDelayMs: 1550 },
  theme: { accentMs: 360, frameMs: 32 },
  onboarding: { deliveryMs: 280, flapMs: 240, paperMs: 300, paperY: 48, dropY: 64, writingDelayMs: 760, wordFadeMs: 420, commaPauseMs: 70, sentencePauseMs: 180, phrasePauseMs: 260, letterPace: {
    introduction: { wordMs: 48, pauseMs: 180 }, explanation: { wordMs: 60, pauseMs: 260 }, promise: { wordMs: 75, pauseMs: 380 }, reflection: { wordMs: 90, pauseMs: 420 }, closing: { wordMs: 125, pauseMs: 600 }, question: { wordMs: 180, pauseMs: 650 },
  }, letterFollowMs: 550, signatureDegrees: 8, signatureMs: 1500, signatureHoldMs: 500, holdMs: 1400, holdReleaseMs: 260, holdPressScale: 0.03, holdSwell: 0.3, commitHoldMs: 1100, retreatScale: 0.95, perspective: 700 },
  today: { heroMs: 240, heroScale: 0.9, titleDelayMs: 80, bodyDelayMs: 140, widgetsDelayMs: 200, chipsDelayMs: 260, nodDelayMs: 700, exitMs: 240, threadDelayMs: 120, threadMs: 220, exitY: -24 },
  session: { whisperDelayMs: 600, whisperHoldMs: 6000, whisperFadeMs: 200, whisperY: -10, whisperScale: 0.92, appliedHoldMs: 700, swapRollMs: 250, swapRollY: 14 },
  touch: { pressMs: 90, pressScale: 0.92, holdMs: 500, squishX: 1.1, squishY: 0.84, squishYpx: 8, jumpY: 22, shakeDegrees: 7, shakeMs: 520, dizzyMs: 1200, rapidMs: 1600, cooldownMs: 60000, dragMax: 22, dragActivation: 8, idleMs: 45000, glanceMinMs: 20000, glanceMaxMs: 40000, sleepyMs: 180000 },
  glow: { smoothingMs: 350, breathMs: 2400, breathAmount: 0.32, pulseEnergy: 0.06, pulseMs: 400, waveMs: 900, sensorMs: 1000 / 30 },
  suggestions: { pressMs: 90, asideMs: 160, asideY: 6, enterX: 8, enterScale: 0.94, returnScale: 0.96, chatStaggerMs: 60, todayStaggerMs: 40 },
  history: { threshold: 64, resistance: 0.55, activationY: 8, failX: 24, skeletonDelayMs: 300 },
  messageActions: { holdMs: 300, slideActivation: 8, enterScale: 0.96, copyFeedbackMs: 1200 },
  messageEntry: { durationMs: 260, userDelayMs: 80, userY: 44, userX: 8, userScale: 0.97, replyY: 14 },
  reply: { sentenceMs: 180, sentenceStaggerMs: 90, sentenceY: 4, widgetY: 12, widgetScale: 0.96, widgetSettleMs: 420, reducedMs: 200 },
  composer: {
    focusMs: 110,
    focusScale: 1.03,
    iconFadeMs: 120,
    iconFromScale: 0.6,
    refusedMs: 200,
    refusedX: 3,
    menuFadeMs: 200,
    menuFromScale: 0.9,
    menuRowDelayMs: 40,
    menuRowStaggerMs: 30,
    menuRowY: 6,
    sessionIconScale: 0.84,
    blurDelayMs: 150,
  },
  presence: {
    receivedMs: 300,
    speakingMs: 1200,
    waitingMs: 1600,
    hintDelayMs: 400,
    thinkingStepMs: 4800,
    hintSwapMs: 180,
    hintSwapY: 4,
    wordThrottleMs: 450,
    tickMs: 200,
    tickY: 2.5,
    hopMs: 420,
    hopY: 12,
    maxGaze: 6,
    idleFrameMs: 1000 / 30,
  },
  durations: {
    ambientMedium: 16000,
    ambientQuick: 11000,
    ambientReaction: 360,
    ambientSettle: 820,
    ambientSlow: 22000,
    micro: 100,
    standard: 180,
    mode: 240,
  },
  distances: {
    expandContentY: 8,
    listInsertY: 12,
    modeEnterY: 24,
    screenShiftX: 8,
    setTickY: -4,
    tabSlideX: 16,
  },
  opacity: {
    disabled: 0.45,
    flash: 0.06,
    screenShift: 0.95,
    stageRecede: 0.55,
    composerMenuScrim: 0.7,
    tabEnter: 0.92,
    workoutEnter: 0.96,
  },
  scale: {
    activeTab: 1.06,
    backgroundSheet: 0.98,
    stageRecede: 0.955,
    tap: 0.97,
  },
} as const;

export const reedLayoutTransitions = {
  smooth: LinearTransition.springify().damping(reedSprings.smooth.damping).mass(reedSprings.smooth.mass).stiffness(reedSprings.smooth.stiffness),
};

export const reedEasing = {
  easeInOut: Easing.inOut(Easing.quad),
  easeOut: Easing.out(Easing.quad),
} as const;

export const reedReanimatedEasing = {
  easeInOut: ReanimatedEasing.inOut(ReanimatedEasing.quad),
  easeOut: ReanimatedEasing.out(ReanimatedEasing.quad),
} as const;

export const shouldUseNativeDriver = Platform.OS !== 'web';
let reducedMotion = false;

/** Updated by the app's theme provider, including live system preference changes. */
export function setReedMotionReduced(value: boolean) {
  reducedMotion = value;
}

export function enableReedLayoutAnimations() {
  if (Platform.OS === 'android') {
    UIManager.setLayoutAnimationEnabledExperimental?.(true);
  }
}

export function runReedLayoutAnimation(duration: number = reedMotion.durations.standard) {
  if (reducedMotion) return;
  LayoutAnimation.configureNext({
    duration,
    create: {
      duration,
      property: LayoutAnimation.Properties.opacity,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      duration,
      property: LayoutAnimation.Properties.opacity,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    update: {
      duration,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
  });
}

export function getTapScaleStyle(pressed: boolean, disabled: boolean | null | undefined = false): ViewStyle {
  return {
    opacity: disabled ? reedMotion.opacity.disabled : 1,
    transform: [{ scale: pressed && !disabled && !reducedMotion ? reedMotion.scale.tap : 1 }],
  };
}

export function createTiming(
  value: Animated.Value | Animated.ValueXY,
  toValue: number,
  duration: number = reedMotion.durations.standard,
  easing = reedEasing.easeOut,
  useNativeDriver = shouldUseNativeDriver,
) {
  return Animated.timing(value, {
    duration: reducedMotion ? 0 : duration,
    easing,
    toValue,
    useNativeDriver,
  });
}

enableReedLayoutAnimations();

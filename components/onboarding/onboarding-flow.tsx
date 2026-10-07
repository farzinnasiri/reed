import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { ReedMascot, useMascot, type MascotExpression } from '@/components/reed/mascot';
import { BootSplash } from '@/components/launch/boot-splash';
import { FirstLaunchIntro } from '@/components/launch/first-launch-intro';
import { useLaunchIntroduction } from '@/components/launch/use-launch-introduction';
import { TodayGlow } from '@/components/reed/today/today-glow';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { reedLayoutTransitions, reedMotion, reedSprings } from '@/design/motion';
import { ReedOnboardingThemeProvider, useReedTheme } from '@/design/provider';
import { reedOnboardingMetrics, reedRadii, withColorAlpha } from '@/design/system';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import type { CategoryId } from './content';
import { CHAPTER_COUNT, canContinue, chapterOf, isSkippable, useOnboardingFlow, type Draft, type StepId } from './draft';
import { HoldToCommit } from './hold-to-commit';
import { OnboardingReedContext } from './reed-context';
import type { StepProps } from './step-props';
import { BodyMapStep, BornStep, HeightStep, SexStep, ShapeStep, WeightStep } from './steps-body';
import { ValuesStep } from './steps-values';
import { ReviewStep, SynthStep } from './steps-finale';
import { NotesStep } from './steps-notes';
import { LetterStep } from './steps-letter';
import { DayStep, PushStep, RhythmStep, SleepStep, WeekStep } from './steps-life';
import { ConsentStep, HelloStep } from './steps-meet';
import { WelcomeStep } from './steps-welcome';
import { Reveal } from './controls';
import { WorldStep, WorldsStep } from './steps-world';

const FIXED_STEPS = {
  welcome: WelcomeStep,
  hello: HelloStep,
  worlds: WorldsStep,
  values: ValuesStep,
  consent: ConsentStep,
  sex: SexStep,
  born: BornStep,
  height: HeightStep,
  weight: WeightStep,
  shape: ShapeStep,
  bodymap: BodyMapStep,
  sleep: SleepStep,
  day: DayStep,
  week: WeekStep,
  rhythm: RhythmStep,
  push: PushStep,
  synth: SynthStep,
  review: ReviewStep,
  notes: NotesStep,
  letter: LetterStep,
} as const;

function StepBody({ id, ...props }: StepProps & { id: StepId }) {
  if (id.startsWith('world:')) return <WorldStep {...props} category={id.slice('world:'.length) as CategoryId} />;
  const Body = FIXED_STEPS[id as keyof typeof FIXED_STEPS];
  return <Body {...props} />;
}

const COLUMN_MAX_WIDTH = 480;
const GUTTER = 20;
const TOP_BAR_HEIGHT = 52;
const MASCOT_BASE = 112;
// The face fills about three quarters of its box, so these read bigger than the numbers suggest.
const MASCOT_HERO_SCALE = 1.4;


const HERO_STEPS: StepId[] = ['welcome', 'hello', 'synth'];
const STEP_EXIT_MS = 120;
const STEP_SHIFT = reedMotion.distances.tabSlideX;

function continueLabel(step: StepId, returning: boolean, draft: Draft) {
  if (returning) return 'Back to summary';
  switch (step) {
    case 'welcome': return 'Get started';
    case 'hello': return 'Nice to meet you';
    case 'consent': return 'Sounds good';
    case 'bodymap': return Object.keys(draft.bodyPain).length === 0 ? 'Nothing hurts' : 'Continue';
    case 'review': return "That's me. Let's go";
    case 'letter': return "I'm ready";
    default: return 'Continue';
  }
}

type Reaction = { id: number; ms: number; text: string; step: StepId };

type OnboardingFlowProps = {
  /** "I already have an account" on the welcome screen. */
  onSignIn?: () => void;
  onComplete: (draft: Draft) => void | Promise<void>;
  initialDraft?: Draft;
  initialStep?: StepId;
  onCancel?: () => void;
  /** Public front door reuses the welcome without entering the unsaved preview draft. */
  welcomeOnly?: boolean;
  replayIntro?: boolean;
};

export function OnboardingFlow(props: OnboardingFlowProps) {
  const flow = useOnboardingFlow(props.initialDraft, props.initialStep);
  return <ReedOnboardingThemeProvider gender={flow.draft.sex}>
    <OnboardingContent {...props} flow={flow} />
  </ReedOnboardingThemeProvider>;
}

function OnboardingContent({ flow, onComplete, onSignIn, welcomeOnly, replayIntro, initialStep, onCancel }: OnboardingFlowProps & { flow: ReturnType<typeof useOnboardingFlow> }) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReedReducedMotion();
  const { back, direction, draft, edit, next, practices, returnToReview, step, steps, update } = flow;
  const [stageViewportHeight, setStageViewportHeight] = useState(0);
  const [letterReady, setLetterReady] = useState(false);
  const [letterDelivered, setLetterDelivered] = useState(false);
  const [answerPending, setAnswerPending] = useState(false);
  const [listening, setListening] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < reedOnboardingMetrics.compactHeight;
  const zonePresent = compact ? reedOnboardingMetrics.compactPresence : reedOnboardingMetrics.presence;
  const zoneHero = compact ? reedOnboardingMetrics.compactHero : reedOnboardingMetrics.hero;
  const [columnWidth, setColumnWidth] = useState(COLUMN_MAX_WIDTH);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentScroll = useRef<ScrollView>(null);
  const revealAnswer = useCallback(() => contentScroll.current?.scrollToEnd({ animated: !reduced }), [reduced]);
  const beforeNext = useRef<(() => void) | null>(null);

  const resting: MascotExpression = step === 'synth' ? 'thinking' : listening ? 'listening' : 'happy';
  const reed = useMascot(resting);
  const launch = useLaunchIntroduction(step === 'welcome', replayIntro);
  const say = useCallback((text: string, ms = 2400) => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    setReaction(current => ({ id: (current?.id ?? 0) + 1, ms, text, step }));
    reactionTimer.current = setTimeout(() => setReaction(null), ms + 400);
  }, [step]);
  useEffect(() => () => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
  }, []);
  const setBeforeNext = useCallback((action: (() => void) | null) => {
    beforeNext.current = action;
  }, []);
  const reedContext = useMemo(() => ({ stageViewportHeight, reed, say, setBeforeNext, setListening, revealAnswer, setAnswerPending, setLetterReady, setLetterDelivered }), [stageViewportHeight, reed, say, setBeforeNext, revealAnswer]);

  // Which step is on screen lags `step` by the exit animation.
  const [shown, setShown] = useState<StepId>(step);
  // Reduced motion swaps the child before commit, without a second effect render.
  if (reduced && shown !== step) setShown(step);
  const stageOpacity = useSharedValue(1);
  const stageShift = useSharedValue(0);
  const answerTop = useSharedValue(0);
  const answerScroll = useSharedValue(0);
  const firstRender = useRef(true);
  useEffect(() => {
    if (shown === step) return;
    answerTop.set(0);
    answerScroll.set(0);
    if (reduced) return;
    stageShift.set(withTiming(-direction * STEP_SHIFT, { duration: STEP_EXIT_MS }));
    stageOpacity.set(withTiming(0, { duration: STEP_EXIT_MS }, finished => {
      if (finished) scheduleOnRN(setShown, step);
    }));
  }, [answerScroll, answerTop, direction, reduced, shown, stageOpacity, stageShift, step]);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reduced) {
      stageOpacity.set(withTiming(1, { duration: reedMotion.durations.standard }));
      return;
    }
    stageShift.set(direction * STEP_SHIFT);
    stageOpacity.set(0);
    stageShift.set(withSpring(0, reedSprings.smooth));
    stageOpacity.set(withTiming(1, { duration: reedMotion.durations.mode }));
    // Runs when the swapped-in step mounts; direction is read as it was for that move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  const stageStyle = useAnimatedStyle(() => ({ opacity: stageOpacity.get(), transform: [{ translateX: Platform.OS === 'web' ? 0 : stageShift.get() }] }));


  const hero = HERO_STEPS.includes(step);
  const mode = useSharedValue(hero ? 1 : 0);
  useEffect(() => {
    mode.set(reduced ? withTiming(hero ? 1 : 0, { duration: reedMotion.durations.standard }) : withSpring(hero ? 1 : 0, reedSprings.morph));
  }, [hero, mode, reduced]);

  const onLayout = useCallback((event: LayoutChangeEvent) => setColumnWidth(event.nativeEvent.layout.width), []);
  const zoneStyle = useAnimatedStyle(() => ({ height: interpolate(mode.get(), [0, 1], [zonePresent, zoneHero]) }));
  const retreat = useSharedValue(1);
  const hold = useSharedValue(0);
  useEffect(() => {
    const target = step === 'letter' && letterDelivered ? reedMotion.onboarding.retreatScale : 1;
    retreat.set(reduced ? target : withTiming(target, { duration: reedMotion.onboarding.paperMs }));
  }, [letterDelivered, reduced, retreat, step]);
  const mascotStyle = useAnimatedStyle(() => {
    const m = mode.get();
    const adaptive = !['welcome', 'hello', 'synth', 'letter', 'review', 'bodymap'].includes(shown);
    const headingTop = zonePresent + Math.max(0, answerTop.get() - answerScroll.get());
    const baseScale = compact ? 0.65 : 0.8;
    const questionScale = adaptive ? Math.min(reedOnboardingMetrics.questionScale, Math.max(baseScale, (headingTop - reedOnboardingMetrics.questionClearance * 2) / MASCOT_BASE)) : baseScale;
    const questionCenter = adaptive ? Math.max(zonePresent / 2, headingTop - MASCOT_BASE * questionScale / 2 - reedOnboardingMetrics.questionClearance) : zonePresent / 2;
    const centerY = interpolate(m, [0, 1], [questionCenter, zoneHero / 2]);
    const scale = interpolate(m, [0, 1], [questionScale, compact ? 1 : MASCOT_HERO_SCALE]) * retreat.get() * (1 + reedMotion.onboarding.holdSwell * hold.get());
    return {
      transform: [
        { translateX: columnWidth / 2 - MASCOT_BASE / 2 },
        { translateY: reduced ? centerY - MASCOT_BASE / 2 : withSpring(centerY - MASCOT_BASE / 2, reedSprings.morph) },
        { scale: reduced ? scale : withSpring(scale, reedSprings.morph) },
      ],
    };
  });
  const reactionAnchorStyle = useAnimatedStyle(() => {
    const adaptive = !['welcome', 'hello', 'synth', 'letter', 'review', 'bodymap'].includes(shown);
    const offset = adaptive ? Math.max(0, answerTop.get() - answerScroll.get() - 8) : 0;
    return { transform: [{ translateY: reduced ? offset : withSpring(offset, reedSprings.morph) }] };
  });
  const glowStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, interpolate(mode.get(), [0, 1], [0.6, 1]) + hold.get() * 0.4) }));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const finish = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await onComplete(draft);
    } catch {
      setSaveError("Couldn't save your answers. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const enabled = !saving && canContinue(step, draft) && !answerPending && step === shown;
  const showDock = step !== 'synth';
  const showSkip = isSkippable(step) || step === 'letter';
  const primary = () => {
    if (step === 'welcome' && welcomeOnly) {
      haptics.light();
      void finish();
      return;
    }
    if (step === 'letter' || (step === 'review' && onCancel)) {
      haptics.success();
      void finish();
      return;
    }
    haptics.light();
    beforeNext.current?.();
    next();
  };
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
  }, []);
  // The held promise lands, Reed celebrates for a beat, then the flow ends.
  const commitLetter = () => {
    commitTimer.current = setTimeout(() => { void finish(); }, reedMotion.onboarding.commitHoldMs);
  };
  const skip = () => {
    haptics.selection();
    if (step === 'letter') void finish();
    else {
      if (step === 'notes') update({ notes: '' });
      if (step === 'values') update({ values: [] });
      if (step === 'bodymap') update({ bodyPain: {}, bodyMapDone: false });
      if (step === 'sleep') update({ sleep: null, sleepQuality: null });
      if (step === 'day') update({ dayLoad: null });
      if (step === 'rhythm') update({ rhythm: null });
      next();
    }
  };

  const showBack = !saving && step !== 'welcome' && step !== 'synth' && step !== 'letter' && !(step === 'hello' && initialStep === 'hello' && !onCancel);
  const handleBack = () => { if (onCancel && (step === 'review' || (step === initialStep && !returnToReview))) onCancel(); else back(); };

  if (launch.phase === 'checking') return <BootSplash />;
  if (launch.phase === 'intro') return <FirstLaunchIntro
    reed={reed}
    targetY={insets.top + TOP_BAR_HEIGHT + zoneHero / 2}
    targetSize={MASCOT_BASE * (compact ? 1 : MASCOT_HERO_SCALE)}
    onComplete={launch.finish}
  />;

  return (
    <OnboardingReedContext.Provider value={reedContext}>
      <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
        <View style={styles.glowClip}>
          <Animated.View style={[styles.glow, { top: insets.top + TOP_BAR_HEIGHT + 80 - 220 }, glowStyle]}>
            <TodayGlow />
          </Animated.View>
        </View>

        <KeyboardAvoidingView behavior="padding" style={styles.root}>
          <View onLayout={onLayout} style={[styles.column, { paddingTop: insets.top }]}>
            <TopBar onBack={handleBack} showBack={showBack} step={step} steps={steps} />

            <Animated.View style={[styles.zone, zoneStyle]}>
              <Animated.View style={[styles.mascot, mascotStyle]}>
                <ReedMascot mascot={reed} size={MASCOT_BASE} />
              </Animated.View>
              {reaction?.step === shown ? <Animated.View style={[StyleSheet.absoluteFill, reactionAnchorStyle]}><ReactionPill key={reaction.id} ms={reaction.ms} text={reaction.text} /></Animated.View> : null}
            </Animated.View>

            <Animated.View onLayout={event => setStageViewportHeight(event.nativeEvent.layout.height)} style={[styles.stage, stageStyle]}>
              <ScrollView
                ref={contentScroll}
                scrollEnabled={shown !== 'letter'}
                onScroll={event => answerScroll.set(event.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
                contentContainerStyle={[styles.content, !['welcome', 'synth', 'review', 'letter', 'bodymap'].includes(shown) && styles.answerContent, { paddingBottom: shown === 'letter' ? 12 : showDock ? 28 : insets.bottom + 28 }]}
                key={shown}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View onLayout={event => answerTop.set(event.nativeEvent.layout.y)} style={[styles.answerGroup, shown === 'review' && styles.reviewGroup, shown === 'bodymap' && { gap: reedOnboardingMetrics.answerGap }, HERO_STEPS.includes(shown) && { flexGrow: 1 }]}>
                  <StepBody draft={draft} edit={edit} editing={!!onCancel} id={shown} next={next} practices={practices} update={update} />
                </View>
              </ScrollView>
            </Animated.View>

            {showDock ? (
              <DockArrival welcome={shown === 'welcome'} style={[styles.dock, { paddingBottom: insets.bottom + 12 }]}>
                <LinearGradient colors={[withColorAlpha(String(theme.colors.canvas), 0), String(theme.colors.canvas)]} style={styles.dockFade} />
                {saveError ? <ReedText tone="danger" variant="caption">{saveError}</ReedText> : null}
                <View style={styles.dockActions}>
                  <SkipAction disabled={saving} letter={step === 'letter'} onSkip={skip} visible={showSkip} />
                  <ReadyAction visible={step !== 'letter' || letterReady || reduced}>{saving ? <ReedButton disabled label="Saving…" /> : step === 'letter' && !saveError ? <HoldToCommit onCommit={commitLetter} progress={hold} /> : <ReedButton disabled={!enabled} label={onCancel && step === 'review' ? 'Save changes' : saveError && step === 'letter' ? 'Try again' : continueLabel(step, returnToReview, draft)} onPress={primary} />}</ReadyAction>
                </View>
                {step === 'welcome' && onSignIn ? <ReedButton label="I already have an account" onPress={onSignIn} style={styles.signIn} variant="quiet" /> : null}
              </DockArrival>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </OnboardingReedContext.Provider>
  );
}

function DockArrival({ children, welcome, style }: { children: React.ReactNode; welcome: boolean; style: React.ComponentProps<typeof View>['style'] }) {
  return welcome ? <Reveal delay={reedMotion.launch.actionsDelayMs} style={style}>{children}</Reveal> : <View style={style}>{children}</View>;
}

function ReadyAction({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const reduced = useReedReducedMotion();
  const progress = useSharedValue(visible ? 1 : 0);
  useEffect(() => { progress.set(reduced ? (visible ? 1 : 0) : withTiming(visible ? 1 : 0, { duration: reedMotion.durations.mode })); }, [progress, reduced, visible]);
  const style = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: reduced ? 0 : (1 - progress.get()) * reedMotion.reply.widgetY }] }));
  return <Animated.View layout={reduced ? undefined : reedLayoutTransitions.smooth} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} style={[styles.primary, style, { pointerEvents: visible ? 'auto' : 'none' }]}>{visible ? children : null}</Animated.View>;
}

function SkipAction({ disabled, letter, onSkip, visible }: { disabled: boolean; letter: boolean; onSkip: () => void; visible: boolean }) {
  const reduced = useReedReducedMotion();
  const progress = useSharedValue(visible ? 1 : 0);
  useEffect(() => { progress.set(reduced ? Number(visible) : withTiming(Number(visible), { duration: reedMotion.durations.mode })); }, [progress, reduced, visible]);
  const reveal = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateX: reduced ? 0 : -(1 - progress.get()) * reedOnboardingMetrics.dockGap }] }));
  const width = visible ? (letter ? reedOnboardingMetrics.letterSkipWidth : reedOnboardingMetrics.skipWidth) + reedOnboardingMetrics.dockGap : 0;
  return <Animated.View layout={reduced ? undefined : reedLayoutTransitions.smooth} style={{ width, overflow: 'hidden' }}>
    {visible ? <Animated.View style={[{ paddingRight: reedOnboardingMetrics.dockGap }, reveal]}>
      <ReedButton disabled={disabled} label={letter ? 'Skip letter' : 'Skip'} onPress={onSkip} style={{ minHeight: reedOnboardingMetrics.hit, justifyContent: 'center' }} variant="quiet" />
    </Animated.View> : null}
  </Animated.View>;
}

/** A line from Reed under the mascot: fades in with a small pop, holds, fades out. */
function ReactionPill({ ms, text }: { ms: number; text: string }) {
  const { theme } = useReedTheme();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withSequence(withSpring(1, reedSprings.pop), withDelay(ms, withTiming(0, { duration: 220 }))));
  }, [ms, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progress.get())),
    transform: [{ scale: 0.92 + Math.min(1, progress.get()) * 0.08 }],
  }));
  return (
    <View style={styles.reactionSlot}>
      <Animated.View style={[styles.reaction, { backgroundColor: theme.colors.surfaceRaised }, style]}>
        <ReedText numberOfLines={1} tone="secondary" variant="caption">{text}</ReedText>
      </Animated.View>
    </View>
  );
}

function TopBar({ onBack, showBack, step, steps }: { onBack: () => void; showBack: boolean; step: StepId; steps: StepId[] }) {
  const { theme } = useReedTheme();
  if (step === 'welcome') return <View style={styles.topBar} />;
  if (step === 'letter') return <View style={{ height: 12 }} />;
  const position = steps.indexOf(step);
  const current = chapterOf(step);
  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        disabled={!showBack}
        hitSlop={8}
        onPress={() => {
          haptics.selection();
          onBack();
        }}
        style={[styles.side, { opacity: showBack ? 1 : 0 }]}
      >
        <Ionicons color={String(theme.colors.inkSecondary)} name="chevron-back" size={22} />
      </Pressable>
      <View accessibilityLabel={`Step ${position + 1}`} style={styles.segments}>
        {Array.from({ length: CHAPTER_COUNT }, (_, chapter) => {
          const inChapter = steps.filter(id => id !== 'synth' && id !== 'review' && id !== 'letter' && chapterOf(id) === chapter);
          const within = inChapter.indexOf(step);
          const fill = chapter < current ? 1 : chapter > current ? 0 : within >= 0 ? (within + 1) / inChapter.length : 1;
          return <Segment fill={fill} key={chapter} />;
        })}
      </View>
      <View style={styles.side} />
    </View>
  );
}

function Segment({ fill }: { fill: number }) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const progress = useSharedValue(fill);
  useEffect(() => {
    progress.set(reduced ? withTiming(fill, { duration: reedMotion.durations.standard }) : withSpring(fill, reedSprings.smooth));
  }, [fill, progress, reduced]);
  const style = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, progress.get())) * 100}%` }));
  return (
    <View style={[styles.segment, { backgroundColor: theme.colors.surfaceHigh }]}>
      <Animated.View style={[styles.segmentFill, { backgroundColor: theme.colors.accent }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  glowClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none' },
  glow: {
    alignSelf: 'center',
    pointerEvents: 'none',
    position: 'absolute',
  },
  column: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: COLUMN_MAX_WIDTH,
    width: '100%',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    height: TOP_BAR_HEIGHT,
    paddingHorizontal: GUTTER - 10,
  },
  side: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 48,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },
  segment: {
    borderRadius: reedRadii.pill,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  segmentFill: {
    borderRadius: reedRadii.pill,
    height: '100%',
  },
  zone: {
    zIndex: 1,
    pointerEvents: 'none',
    overflow: 'visible',
  },
  mascot: {
    height: MASCOT_BASE,
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    width: MASCOT_BASE,
  },
  reactionSlot: {
    alignItems: 'center',
    bottom: 0,
    left: 0,
    paddingHorizontal: GUTTER,
    position: 'absolute',
    right: 0,
  },
  reaction: {
    borderRadius: reedRadii.pill,
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  stage: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: 22,
    paddingHorizontal: GUTTER,
    paddingTop: 6,
  },
  answerGroup: { gap: 22 },
  reviewGroup: { gap: 8 },
  answerContent: {
    justifyContent: 'flex-end',
    paddingBottom: reedOnboardingMetrics.answerGap,
  },
  dockActions: { flexDirection: 'row', alignItems: 'center' },
  primary: { flex: 1 },
  signIn: {
    alignSelf: 'center',
    marginTop: 6,
  },
  dock: {
    paddingHorizontal: GUTTER,
    paddingTop: 8,
  },
  dockFade: {
    height: 28,
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: -28,
  },
});

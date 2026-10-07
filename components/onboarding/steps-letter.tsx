import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, cancelAnimation, scrollTo, useAnimatedRef, useDerivedValue, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import type { MascotExpression } from '@/components/reed/mascot';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedOnboardingMetrics as metrics } from '@/design/system';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { firstName } from './draft';
import { useOnboardingReed } from './reed-context';
import { SIGNATURE_PATH, SIGNATURE_VIEWBOX } from './signature-path';
import type { StepProps } from './step-props';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const decorative = Platform.OS === 'web' ? { 'aria-hidden': true as const, focusable: false } : { accessible: false };
const motion = reedMotion.onboarding;

type LetterPace = keyof typeof motion.letterPace;
type LetterPassage = { text: string; pace: LetterPace; section?: boolean; question?: boolean; expression?: MascotExpression };
type LetterWord = { text: string; at: number; breakBefore: boolean };
type LetterLine = LetterPassage & { words: LetterWord[]; duration: number; at: number };

/** One schedule drives fades, reading pauses, mascot reactions and scroll following. */
function schedulePassage(passage: LetterPassage, at: number): LetterLine {
  const words: LetterWord[] = [];
  let time = 0;
  for (const [row, phrase] of passage.text.split('\n').entries()) {
    for (const [index, text] of phrase.split(/\s+/).entries()) {
      const breakBefore = row > 0 && index === 0;
      if (words.length) {
        time += motion.letterPace[passage.pace].wordMs;
        const previous = words[words.length - 1].text;
        time += breakBefore ? motion.phrasePauseMs : /[.!?]$/.test(previous) ? motion.sentencePauseMs : /[,;:]$/.test(previous) ? motion.commaPauseMs : 0;
      }
      words.push({ text, at: time, breakBefore });
    }
  }
  return { ...passage, at, words, duration: time + motion.wordFadeMs };
}

export function LetterStep({ draft }: StepProps) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const { reed, setLetterReady, setLetterDelivered, stageViewportHeight } = useOnboardingReed();
  const act = reed?.act;
  const react = reed?.react;
  const stop = reed?.stop;
  const [revealed, setRevealed] = useState(false);
  const finished = reduced || revealed;
  const name = firstName(draft);
  const { lines, signatureAt } = useMemo(() => {
    const copy: LetterPassage[] = [
      { text: `Hey ${name}.`, pace: 'introduction' },
      { text: "It's Reed.\nWe're going to spend a lot of time together, so let me introduce myself.", pace: 'introduction', expression: 'excited' },
      { text: "I'm your coach.\nI'll learn how you move, how you recover, and what lights you up.\nThen I'll build everything around that.", pace: 'explanation', expression: 'encouraging' },
      { text: "I won't always tell you what you want to hear.\nBut I'll always tell you what you need.", pace: 'promise', section: true, expression: 'proud' },
      { text: "Some days will feel easy. Some won't.\nI'll be there for both.", pace: 'promise', expression: 'encouraging' },
      { text: "It takes time to really know each other.\nThat's okay. Good things do.", pace: 'reflection', expression: 'happy' },
      { text: "I'm here every day.\nI'm in YOUR corner.", pace: 'closing', section: true, expression: 'proud' },
      { text: 'Are you in?', pace: 'question', expression: 'ready', question: true },
    ];
    let at = motion.writingDelayMs;
    const lines = copy.map(passage => {
      const line = schedulePassage(passage, at);
      at += line.duration + motion.letterPace[passage.pace].pauseMs;
      return line;
    });
    return { lines, signatureAt: at };
  }, [name]);
  useEffect(() => {
    setLetterReady(finished);
    setLetterDelivered(finished);
    if (finished) { stop?.(); return; }
    act?.('hop');
    const timers = [setTimeout(() => setLetterDelivered(true), motion.deliveryMs + motion.flapMs)];
    for (const line of lines) if (line.expression) timers.push(setTimeout(() => react?.(line.expression!, line.duration), line.at));
    timers.push(setTimeout(() => { setLetterReady(true); setRevealed(true); haptics.soft(); }, signatureAt + motion.signatureMs + motion.signatureHoldMs));
    return () => { timers.forEach(clearTimeout); stop?.(); };
  }, [act, finished, lines, react, setLetterDelivered, setLetterReady, signatureAt, stop]);

  const { height: windowHeight } = useWindowDimensions();
  const [noteWidth, setNoteWidth] = useState(0);
  const signatureWidth = Math.min(metrics.signatureWidth, noteWidth * metrics.signatureFraction);
  const epoch = useRef(Date.now()).current;
  const body = useAnimatedRef<ScrollView>();
  const scroll = useSharedValue(0);
  const following = useSharedValue(!reduced);
  const bodyHeight = useRef(0);
  const contentHeight = useRef(0);
  useDerivedValue(() => { if (following.get()) scrollTo(body, 0, scroll.get(), false); });
  const followWriting = useCallback((bottom: number) => {
    if (!following.get()) return;
    const target = Math.min(Math.max(0, contentHeight.current - bodyHeight.current), Math.max(0, bottom - bodyHeight.current + metrics.letterFollowClearance));
    if (target > scroll.get()) scroll.set(withTiming(target, { duration: motion.letterFollowMs }));
  }, [following, scroll]);
  const pauseFollowing = useCallback(() => { following.set(false); cancelAnimation(scroll); }, [following, scroll]);
  useEffect(() => { if (finished) pauseFollowing(); }, [finished, pauseFollowing]);
  useEffect(() => () => cancelAnimation(scroll), [scroll]);

  const paper = useSharedValue(finished ? 1 : 0);
  useEffect(() => {
    cancelAnimation(paper);
    paper.set(finished ? 1 : withDelay(motion.deliveryMs + motion.flapMs, withTiming(1, { duration: motion.paperMs })));
    return () => cancelAnimation(paper);
  }, [finished, paper]);
  const paperStyle = useAnimatedStyle(() => ({ opacity: paper.get(), transform: [{ translateY: (1 - paper.get()) * motion.paperY }] }));
  return (
    <View style={[styles.letter, { height: Math.max(0, (stageViewportHeight || windowHeight / 2) - 12) }]}>
      <Envelope finished={finished} />
      <Animated.View onLayout={event => setNoteWidth(event.nativeEvent.layout.width)} style={[styles.paper, { backgroundColor: theme.colors.surface }, paperStyle]}>
        <Pressable accessible={false} onPress={() => setRevealed(true)} style={[styles.noteHeader, { paddingRight: signatureWidth }]}>
          <WrittenLine line={lines[0]} finished={finished} headline />
        </Pressable>
        <Animated.ScrollView
          ref={body}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          onLayout={event => { bodyHeight.current = event.nativeEvent.layout.height; }}
          onContentSizeChange={(_, height) => { contentHeight.current = height; }}
          {...(Platform.OS === 'web' ? { onWheel: pauseFollowing } : {})}
          onTouchStart={pauseFollowing}
          onScrollBeginDrag={pauseFollowing}
          showsVerticalScrollIndicator={false}
        >
          <Pressable accessible={false} onPress={() => setRevealed(true)} style={styles.paragraphs}>
            {lines.slice(1).map((line, index) => <WrittenLine key={index} line={line} finished={finished} headline={false} question={line.question} epoch={epoch} onWritingRow={followWriting} />)}
          </Pressable>
        </Animated.ScrollView>
        <Signature at={signatureAt} finished={finished} width={signatureWidth} />
      </Animated.View>
      <View style={styles.revealSlot}>
        {!finished ? <Pressable accessibilityRole="button" onPress={() => setRevealed(true)} style={styles.showAll}><ReedText tone="secondary" variant="caption">Show full letter</ReedText></Pressable> : null}
      </View>
    </View>
  );
}

/** Separate back, slip of paper, front and hinged flap, all on the same envelope anchor. */
function Envelope({ finished }: { finished: boolean }) {
  const { theme } = useReedTheme();
  const drop = useSharedValue(finished ? 1 : 0);
  const flap = useSharedValue(finished ? 1 : 0);
  const slip = useSharedValue(finished ? 1 : 0);
  useEffect(() => {
    drop.set(finished ? 1 : withTiming(1, { duration: motion.deliveryMs }));
    flap.set(finished ? 1 : withDelay(motion.deliveryMs, withTiming(1, { duration: motion.flapMs })));
    slip.set(finished ? 1 : withDelay(motion.deliveryMs + motion.flapMs, withTiming(1, { duration: motion.paperMs })));
    return () => { cancelAnimation(drop); cancelAnimation(flap); cancelAnimation(slip); };
  }, [drop, finished, flap, slip]);
  const delivery = useAnimatedStyle(() => ({ opacity: (1 - slip.get()) * drop.get(), transform: [{ translateY: (drop.get() - 1) * motion.dropY }] }));
  const hinge = useAnimatedStyle(() => ({ transform: [{ perspective: motion.perspective }, { rotateX: `${-180 * flap.get()}deg` }] }));
  const paper = useAnimatedStyle(() => ({ transform: [{ translateY: -slip.get() * motion.paperY }] }));
  return <Animated.View style={[styles.envelope, delivery]}>
    <Svg {...decorative} width={112} height={64} viewBox="0 0 112 64"><Rect x={1} y={1} width={110} height={62} rx={8} fill={String(theme.colors.surfaceHigh)} /></Svg>
    <Animated.View style={[styles.slip, paper]}><Svg {...decorative} width={88} height={52}><Rect width={88} height={52} rx={4} fill={String(theme.colors.inkSecondary)} /><Path d="M12 16 H72 M12 25 H62 M12 34 H68" stroke={String(theme.colors.surfaceHigh)} strokeWidth={2} /></Svg></Animated.View>
    <Svg {...decorative} style={StyleSheet.absoluteFill} width={112} height={64} viewBox="0 0 112 64"><Path d="M1 2 L56 35 L111 2 V55 Q111 63 103 63 H9 Q1 63 1 55 Z" fill={String(theme.colors.surfaceRaised)} stroke={String(theme.colors.lineStrong)} /><Path d="M3 60 L42 31 M109 60 L70 31" stroke={String(theme.colors.lineStrong)} /></Svg>
    <Animated.View style={[styles.flap, hinge]}><Svg {...decorative} width={112} height={36} viewBox="0 0 112 36"><Path d="M1 1 H111 L60 33 Q56 36 52 33 Z" fill={String(theme.colors.surfaceHigh)} stroke={String(theme.colors.lineStrong)} /></Svg></Animated.View>
  </Animated.View>;
}

/** Whole words fade together in overlapping waves, with room for each thought to land. */
function WrittenLine({ line, finished, headline, question, epoch, onWritingRow }: { line: LetterLine; finished: boolean; headline: boolean; question?: boolean; epoch?: number; onWritingRow?: (bottom: number) => void }) {
  const words = line.words;
  const elapsed = useSharedValue(finished ? line.duration : 0);
  const [top, setTop] = useState(0);
  const [layouts, setLayouts] = useState<Record<number, { y: number; height: number }>>({});
  useEffect(() => {
    cancelAnimation(elapsed);
    elapsed.set(finished ? line.duration : withDelay(line.at, withTiming(line.duration, { duration: line.duration, easing: Easing.linear })));
    return () => cancelAnimation(elapsed);
  }, [elapsed, finished, line.at, line.duration]);
  // Schedule once per measured visual row, rather than jumping to the end of hidden paragraphs.
  useEffect(() => {
    if (finished || !onWritingRow || epoch === undefined) return;
    const seen = new Set<number>();
    const timers = Object.entries(layouts).flatMap(([index, row]) => {
      if (seen.has(row.y)) return [];
      seen.add(row.y);
      const delay = line.at + words[Number(index)].at - (Date.now() - epoch);
      return [setTimeout(() => onWritingRow(top + row.y + row.height), Math.max(0, delay))];
    });
    return () => timers.forEach(clearTimeout);
  }, [epoch, finished, layouts, line.at, onWritingRow, top, words]);
  return <View onLayout={event => setTop(event.nativeEvent.layout.y)} style={line.section ? styles.section : undefined}>
    <View accessible accessibilityLabel={line.text} style={styles.words}>
      {words.map((word, index) => <Fragment key={index}>
        {word.breakBefore ? <View style={styles.lineBreak} /> : null}
        <Word headline={headline} question={question} strong={word.text.length > 1 && word.text === word.text.toUpperCase() && /[A-Z]/.test(word.text)} word={word} elapsed={elapsed} onLayout={onWritingRow ? row => setLayouts(current => current[index]?.y === row.y && current[index]?.height === row.height ? current : { ...current, [index]: row }) : undefined} />
      </Fragment>)}
    </View>
  </View>;
}

function Word({ headline, question, strong, word, elapsed, onLayout }: { headline: boolean; question?: boolean; strong: boolean; word: LetterWord; elapsed: SharedValue<number>; onLayout?: (row: { y: number; height: number }) => void }) {
  const style = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, (elapsed.get() - word.at) / motion.wordFadeMs));
    return { opacity: Easing.out(Easing.quad)(progress) };
  });
  return <Animated.View onLayout={onLayout ? event => onLayout(event.nativeEvent.layout) : undefined} style={style}><ReedText importantForAccessibility="no" tone={strong || question ? 'accent' : undefined} variant={headline ? 'title' : question ? 'title' : strong ? 'bodyStrong' : 'voice'}>{word.text}</ReedText></Animated.View>;
}

/** "Reed" written on left to right: the outline is revealed by a clip that opens at pen speed. */
function Signature({ at, finished, width: renderedWidth }: { at: number; finished: boolean; width: number }) {
  const { theme } = useReedTheme();
  const progress = useSharedValue(finished ? 1 : 0);
  useEffect(() => {
    progress.set(finished ? 1 : withDelay(at, withTiming(1, { duration: motion.signatureMs, easing: Easing.inOut(Easing.quad) })));
    return () => cancelAnimation(progress);
  }, [at, finished, progress]);
  const wipe = useAnimatedProps(() => ({ width: SIGNATURE_VIEWBOX.width * progress.get() }));
  const label = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.get() * 6) }));
  const { x, y, width, height } = SIGNATURE_VIEWBOX;
  return <View style={[styles.signature, { width: renderedWidth }]}>
    <Animated.View style={label}><ReedText tone="secondary" variant="caption">With love, 🤍</ReedText></Animated.View>
    <Svg {...decorative} width={renderedWidth} height={(renderedWidth * height) / width} viewBox={`${x} ${y} ${width} ${height}`}>
      <Defs><ClipPath id="reed-signature-wipe"><AnimatedRect animatedProps={wipe} height={height} x={x} y={y} /></ClipPath></Defs>
      <G clipPath="url(#reed-signature-wipe)"><Path d={SIGNATURE_PATH} fill={String(theme.colors.accentInk)} /></G>
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  letter: { gap: 8, paddingTop: metrics.letterTop },
  envelope: { width: 112, height: 64, position: 'absolute', top: -32, left: '50%', marginLeft: -56, pointerEvents: 'none' },
  slip: { position: 'absolute', top: 6, left: 12 },
  flap: { position: 'absolute', top: 0, left: 0, transformOrigin: 'top center' },
  paper: { flex: 1, padding: 22, paddingBottom: 0 },
  noteHeader: { minHeight: metrics.letterHeader },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 22 },
  paragraphs: { gap: 16 },
  revealSlot: { height: metrics.hit },
  section: { marginTop: metrics.letterSectionGap },
  lineBreak: { width: '100%', height: 0 },
  words: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 5 },
  signature: { position: 'absolute', top: metrics.signatureTop, right: metrics.signatureRight, gap: 2, pointerEvents: 'none', transform: [{ rotate: `${motion.signatureDegrees}deg` }] },
  showAll: { minHeight: 48, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center' },
});

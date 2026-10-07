import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle, type TextInputProps } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { reedMotion, reedSprings } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii, withColorAlpha } from '@/design/system';
import { useEntryAnimation } from '@/design/use-entry-animation';
import { usePressAnimation } from '@/design/use-press-animation';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { LEVELS } from './content';
import { useFieldGaze, useOnboardingReed } from './reed-context';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** One-shot rise-and-fade for a block of a step. Steps remount on every change, so this replays. */
export function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const { editing } = useOnboardingReed();
  const animated = useEntryAnimation({ delay: editing ? 0 : delay, translateY: editing ? 0 : 10 });
  return <Animated.View style={[animated, style]}>{children}</Animated.View>;
}

/** Reed speaking: one sentence at a time, the way replies land in the thread. */
export function Say({ align = 'center', delay = 0, text, tone = 'default', variant = 'title' }: { align?: 'left' | 'center'; delay?: number; text: string; tone?: 'default' | 'secondary' | 'muted'; variant?: 'title' | 'voice' | 'display' }) {
  const sentences = text.match(/.+?(?:[.!?](?=\s|$)\s*|$)/gs) ?? [text];
  return (
    <ReedText style={{ textAlign: align }} tone={tone} variant={variant}>
      {sentences.map((sentence, index) => (
        <SayPiece delay={delay + index * (reedMotion.reply.sentenceStaggerMs + 220)} key={index} text={sentence} />
      ))}
    </ReedText>
  );
}

/** A question as Reed asks it: the title, then a quieter line under it. */
export function Heading({ align = 'center', sub, title }: { align?: 'left' | 'center'; sub?: string; title: string }) {
  const { editing } = useOnboardingReed();
  const titleMs = (title.match(/[.!?](?=\s|$)/g)?.length ?? 1) * (reedMotion.reply.sentenceStaggerMs + 220);
  if (editing) return sub ? <ReedText tone="secondary" variant="caption">{sub}</ReedText> : null;
  return (
    <View style={styles.heading}>
      <Say align={align} delay={80} text={title} />
      {sub ? <Say align={align} delay={160 + titleMs} text={sub} tone="secondary" variant="voice" /> : null}
    </View>
  );
}

function SayPiece({ delay, text }: { delay: number; text: string }) {
  const reduced = useReedReducedMotion();
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.set(withDelay(reduced ? 0 : delay, withTiming(1, { duration: reduced ? reedMotion.reply.reducedMs : reedMotion.durations.mode })));
  }, [delay, fade, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateY: reduced ? 0 : (1 - fade.get()) * reedMotion.reply.sentenceY }] }));
  return <Animated.Text style={style}>{text}</Animated.Text>;
}

/** Shared press behaviour: spring scale, a selection haptic and a nod from Reed. */
function useTap(onPress: () => void, { haptic = true, nod = true }: { haptic?: boolean; nod?: boolean } = {}) {
  const press = usePressAnimation();
  const { reed } = useOnboardingReed();
  return {
    animatedStyle: press.animatedStyle,
    handlers: {
      onPress: () => {
        if (haptic) haptics.selection();
        if (nod) reed?.act('tick');
        onPress();
      },
      onPressIn: press.onPressIn,
      onPressOut: press.onPressOut,
    },
  };
}

function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16));
}

/** Blend two #rrggbb colours. Levels warm from the accent blue toward the data-warm orange. */
export function mixHex(from: string, to: string, amount: number) {
  const [a, b] = [hexToRgb(from), hexToRgb(to)];
  const channel = (index: number) => Math.round(a[index] + (b[index] - a[index]) * amount).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <ReedText tone="muted" variant="caption">{children}</ReedText>;
}

export function Chip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const { theme } = useReedTheme();
  const { animatedStyle, handlers } = useTap(onPress);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} {...handlers}>
      <Animated.View
        style={[
          styles.chip,
          {
            backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
            borderColor: selected ? withColorAlpha(String(theme.colors.accent), 0.55) : 'transparent',
          },
          animatedStyle,
        ]}
      >
        <ReedText style={{ color: selected ? theme.colors.accentInk : theme.colors.inkSecondary }} variant="bodyStrong">{label}</ReedText>
      </Animated.View>
    </Pressable>
  );
}

export function ChipRow({ children, center }: { children: ReactNode; center?: boolean }) {
  return <View style={[styles.chipRow, center ? styles.chipRowCenter : null]}>{children}</View>;
}

function IconBadge({ icon, selected, size = 40, color }: { icon: IconName; selected: boolean; size?: number; color?: string }) {
  const { theme } = useReedTheme();
  return (
    <View style={[styles.badge, { backgroundColor: selected ? withColorAlpha(String(theme.colors.accent), 0.28) : theme.colors.surfaceRaised, height: size, width: size }]}>
      <Ionicons color={color ?? String(selected ? theme.colors.accentInk : theme.colors.inkSecondary)} name={icon} size={size * 0.5} />
    </View>
  );
}

/** A tick that pops in when something becomes selected. */
function SelectedMark({ selected }: { selected: boolean }) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.set(reduced ? withTiming(selected ? 1 : 0, { duration: reedMotion.durations.micro }) : withSpring(selected ? 1 : 0, reedSprings.pop));
  }, [progress, reduced, selected]);
  const style = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ scale: 0.4 + progress.get() * 0.6 }] }));
  return (
    <Animated.View style={[styles.mark, { backgroundColor: theme.colors.accent }, style]}>
      <Ionicons color={String(theme.colors.accentText)} name="checkmark" size={14} />
    </Animated.View>
  );
}

/** A world tile for the first, broad question. */
export function WorldTile({ icon, label, onPress, selected, tagline }: { icon: IconName; label: string; onPress: () => void; selected: boolean; tagline: string }) {
  const { theme } = useReedTheme();
  const { animatedStyle, handlers } = useTap(onPress);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} style={styles.fill} {...handlers}>
      <Animated.View
        style={[
          styles.world,
          {
            backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
            borderColor: selected ? withColorAlpha(String(theme.colors.accent), 0.55) : 'transparent',
          },
          animatedStyle,
        ]}
      >
        <View style={styles.worldHead}>
          <IconBadge icon={icon} selected={selected} size={34} />
          <ReedText numberOfLines={1} style={styles.worldLabel} variant="bodyStrong">{label}</ReedText>
        </View>
        <ReedText numberOfLines={1} tone="muted" variant="micro">{tagline}</ReedText>
        <View style={styles.worldMark}><SelectedMark selected={selected} /></View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * A discipline you can fill. Each tap goes one level deeper (For fun, Into it, Serious, Pro); a tap
 * on Pro clears it. The tile fills from the bottom and warms from blue toward orange as it goes.
 */
export function LevelTile({ hint, label, level, onChange, onOpen }: { hint?: string; label: string; level: number; onChange?: (level: number) => void; onOpen?: () => void }) {
  const { theme } = useReedTheme();
  const reduced = useReedReducedMotion();
  const { reed } = useOnboardingReed();
  const press = usePressAnimation();
  const progress = useSharedValue(level);
  useEffect(() => {
    progress.set(reduced ? withTiming(level, { duration: reedMotion.durations.standard }) : withSpring(level, reedSprings.lift));
  }, [level, progress, reduced]);

  const accent = String(theme.colors.accent);
  const warm = String(theme.colors.dataWarm);
  const inkFrom = String(theme.colors.accentInk);
  const colors = [accent, accent, mixHex(accent, warm, 0.33), mixHex(accent, warm, 0.66), warm];
  const fillColors = colors.map((color, index) => withColorAlpha(color, index === 0 ? 0 : 0.32));
  const borderColors = colors.map((color, index) => withColorAlpha(color, index === 0 ? 0 : 0.75));
  const textColors = [inkFrom, inkFrom, mixHex(inkFrom, warm, 0.33), mixHex(inkFrom, warm, 0.66), warm];
  const range = [0, 1, 2, 3, 4];

  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), range, fillColors),
    height: `${Math.max(0, Math.min(4, progress.get())) * 25}%`,
  }));
  const borderStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(progress.get(), range, borderColors) }));
  const subStyle = useAnimatedStyle(() => ({ color: interpolateColor(progress.get(), range, textColors) }));

  const change = (next: number) => {
    if (next === level) return;
    if (next === 0) haptics.soft();
    else if (next === 1) haptics.selection();
    else if (next === 2) haptics.light();
    else if (next === 3) haptics.medium();
    else haptics.success();
    reed?.act(next >= 3 ? 'hop' : 'tick');
    onChange?.(next);
  };

  return (
    <Pressable
      accessibilityActions={onOpen ? undefined : [{ name: 'increment' }, { name: 'decrement' }]}
      accessibilityLabel={label}
      accessibilityRole={onOpen ? 'button' : 'adjustable'}
      accessibilityHint={onOpen ? 'Edit this practice and its level.' : undefined}
      accessibilityValue={{ text: level > 0 ? LEVELS[level - 1] : 'Not selected' }}
      onAccessibilityAction={event => change(event.nativeEvent.actionName === 'increment' ? Math.min(4, level + 1) : Math.max(0, level - 1))}
      onPress={onOpen ?? (() => change(level >= 4 ? 0 : level + 1))}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={styles.fill}
    >
      <Animated.View style={[styles.levelTile, { backgroundColor: theme.colors.surface }, borderStyle, press.animatedStyle]}>
        <Animated.View style={[styles.levelFill, fillStyle]} />
        <View style={styles.levelText}>
          <ReedText numberOfLines={1} style={{ color: level > 0 ? theme.colors.ink : theme.colors.inkSecondary }} variant="bodyStrong">{label}</ReedText>
          {level > 0 ? (
            <Animated.Text numberOfLines={1} style={[styles.levelName, subStyle]}>{LEVELS[level - 1]}</Animated.Text>
          ) : hint ? (
            <ReedText numberOfLines={1} tone="muted" variant="micro">{hint}</ReedText>
          ) : null}
        </View>
        <View style={styles.pips}>
          {[0, 1, 2, 3].map(index => (
            <View key={index} style={[styles.pip, { backgroundColor: index < level ? colors[Math.max(1, level)] : theme.colors.lineStrong, height: 6 + index * 3 }]} />
          ))}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** A full-width choice with a title and a line under it. Used for single-choice questions. */
export function OptionCard({ children, icon, iconColor, onPress, selected, subtitle, title }: { children?: ReactNode; icon?: IconName; iconColor?: string; onPress: () => void; selected: boolean; subtitle?: string; title: string }) {
  const { theme } = useReedTheme();
  const { animatedStyle, handlers } = useTap(onPress);
  return (
    <Animated.View
      style={[
        styles.option,
        {
          backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
          borderColor: selected ? withColorAlpha(String(theme.colors.accent), 0.55) : 'transparent',
        },
        animatedStyle,
      ]}
    >
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} style={styles.optionRow} {...handlers}>
        {icon ? <IconBadge color={iconColor} icon={icon} selected={selected} /> : null}
        <View style={styles.optionText}>
          <ReedText variant="bodyStrong">{title}</ReedText>
          {subtitle ? <ReedText tone="secondary" variant="caption">{subtitle}</ReedText> : null}
        </View>
        <View style={[styles.radio, { borderColor: selected ? theme.colors.accent : theme.colors.lineStrong }]}>
          <SelectedMark selected={selected} />
        </View>
      </Pressable>
      {selected && children ? <View style={styles.optionExtra}>{children}</View> : null}
    </Animated.View>
  );
}

/** A row of big single-choice tiles, each a number with a caption. */
export function NumberTiles({ onChange, options, value }: { onChange: (index: number) => void; options: readonly { big: string; label: string }[]; value: number | null }) {
  const { theme } = useReedTheme();
  return (
    <View style={styles.numbers}>
      {options.map((option, index) => (
        <NumberTile big={option.big} key={option.big} label={option.label} onPress={() => onChange(index)} selected={value === index} theme={theme} />
      ))}
    </View>
  );
}

function NumberTile({ big, label, onPress, selected, theme }: { big: string; label: string; onPress: () => void; selected: boolean; theme: ReturnType<typeof useReedTheme>['theme'] }) {
  const { animatedStyle, handlers } = useTap(onPress);
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={styles.grow} {...handlers}>
      <Animated.View
        style={[
          styles.numberTile,
          {
            backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
            borderColor: selected ? withColorAlpha(String(theme.colors.accent), 0.55) : 'transparent',
          },
          animatedStyle,
        ]}
      >
        <ReedText style={{ color: selected ? theme.colors.accentInk : theme.colors.ink }} variant="stat">{big}</ReedText>
        <ReedText tone="muted" variant="micro">hours</ReedText>
      </Animated.View>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useReedTheme();
  return <View style={[styles.card, { backgroundColor: theme.colors.surface }, style]}>{children}</View>;
}

/** A text field that makes Reed look toward it while it has focus. */
export function Field({ multiline, style, ...props }: TextInputProps) {
  const { theme } = useReedTheme();
  const gaze = useFieldGaze();
  const focus = useSharedValue(0);
  const ringStyle = useAnimatedStyle(() => ({ borderColor: withColorAlpha(String(theme.colors.accent), 0.15 + focus.get() * 0.45) }));
  return (
    <Animated.View style={[styles.field, { backgroundColor: theme.colors.surface }, ringStyle]}>
      <TextInput
        multiline={multiline}
        onBlur={() => {
          focus.set(withTiming(0, { duration: reedMotion.composer.focusMs }));
          gaze.onBlur();
        }}
        onFocus={() => {
          focus.set(withTiming(1, { duration: reedMotion.composer.focusMs }));
          gaze.onFocus();
        }}
        placeholderTextColor={String(theme.colors.inkMuted)}
        selectionColor={String(theme.colors.accent)}
        style={[styles.input, { color: theme.colors.ink, fontFamily: theme.typography.body.fontFamily }, multiline ? styles.inputMultiline : null, style]}
        {...props}
      />
    </Animated.View>
  );
}

const RULER_HEIGHT = 74;
const RULER_LABEL_WIDTH = 60;

type RulerProps = {
  caption?: (value: number) => string | null;
  /** What the ruler shows until the user moves it. */
  fallback: number;
  format: (value: number) => string;
  labelEvery?: number;
  labelFormat?: (unit: number) => string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  tickEvery: number;
  tickGap?: number;
  value: number | null;
};

/**
 * A horizontal ruler that snaps to whole units: scroll it and the big number follows. The number
 * stays muted until the user has set it, so an untouched default never looks like an answer.
 */
export function Ruler({ caption, fallback, format, labelEvery, labelFormat, max, min, onChange, tickEvery, tickGap = 12, value }: RulerProps) {
  const { theme } = useReedTheme();
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const count = max - min + 1;
  const clampIndex = (index: number) => Math.max(0, Math.min(count - 1, index));
  const startIndex = clampIndex(Math.round((value ?? fallback) - min));
  const [active, setActive] = useState(startIndex);
  const last = useRef(startIndex);
  const ready = useRef(false);

  useEffect(() => {
    if (!width) return;
    scroll.current?.scrollTo({ animated: false, x: startIndex * tickGap });
    const timer = setTimeout(() => {
      ready.current = true;
    }, 450);
    return () => clearTimeout(timer);
    // Positioned once, when the width is known. Later changes come from the user's own scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clampIndex(Math.round(event.nativeEvent.contentOffset.x / tickGap));
    if (index === last.current) return;
    last.current = index;
    setActive(index);
    if (!ready.current) return;
    haptics.selection();
    onChange(min + index);
  };

  const shown = min + active;
  const nudge = (direction: number) => {
    const index = clampIndex(active + direction);
    ready.current = true;
    last.current = index;
    setActive(index);
    onChange(min + index);
    haptics.selection();
    scroll.current?.scrollTo({ animated: false, x: index * tickGap });
  };
  const canvas = String(theme.colors.canvas);
  return (
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.ruler}>
      <View style={styles.rulerValueRow}>
        <Pressable accessibilityLabel="Decrease value" accessibilityRole="button" disabled={active === 0} onPress={() => nudge(-1)} style={styles.rulerNudge}><Ionicons name="remove" size={22} color={String(theme.colors.inkSecondary)} /></Pressable>
      <ReedText accessibilityLiveRegion="polite" style={[styles.rulerNumber, { color: value === null ? theme.colors.inkMuted : theme.colors.ink }]} variant="display">{format(shown)}</ReedText>
        <Pressable accessibilityLabel="Increase value" accessibilityRole="button" disabled={active === count - 1} onPress={() => nudge(1)} style={styles.rulerNudge}><Ionicons name="add" size={22} color={String(theme.colors.inkSecondary)} /></Pressable>
      </View>
      <ReedText style={styles.rulerCaption} tone="muted" variant="caption">{(caption?.(shown) ?? '') || ' '}</ReedText>
      <View style={styles.rulerStrip}>
        <ScrollView
          contentContainerStyle={{ height: RULER_HEIGHT, paddingHorizontal: Math.max(0, width / 2 - tickGap / 2) }}
          decelerationRate="fast"
          horizontal
          onScroll={onScroll}
          ref={scroll}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={tickGap}
        >
          {Array.from({ length: count }, (_, index) => {
            const unit = min + index;
            const major = unit % tickEvery === 0;
            const labelled = labelEvery ? unit % labelEvery === 0 : false;
            return (
              <View key={unit} style={[styles.tick, { width: tickGap }]}>
                <View style={[styles.tickLine, { backgroundColor: major ? theme.colors.inkMuted : theme.colors.lineStrong, height: major ? 34 : 20 }]} />
                {labelled ? <Text style={[styles.tickLabel, { color: theme.colors.inkMuted, fontFamily: theme.typography.micro.fontFamily, left: (tickGap - RULER_LABEL_WIDTH) / 2 }]}>{labelFormat ? labelFormat(unit) : unit}</Text> : null}
              </View>
            );
          })}
        </ScrollView>
        <View style={[styles.rulerMarker, { backgroundColor: theme.colors.accent }]} />
        <LinearGradient colors={[canvas, withColorAlpha(canvas, 0)]} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={[styles.rulerFade, { left: 0 }]} />
        <LinearGradient colors={[withColorAlpha(canvas, 0), canvas]} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={[styles.rulerFade, { right: 0 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: 8,
  },
  fill: {
    width: '100%',
  },
  grow: {
    flex: 1,
  },
  chip: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipRowCenter: {
    justifyContent: 'center',
  },
  badge: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    justifyContent: 'center',
  },
  mark: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  world: {
    borderRadius: reedRadii.md,
    borderWidth: 1.5,
    gap: 6,
    minHeight: 84,
    padding: 12,
  },
  worldHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingRight: 24,
  },
  worldLabel: {
    flexShrink: 1,
  },
  worldMark: {
    position: 'absolute',
    right: 10,
    top: 10,
  },
  levelTile: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    minHeight: 66,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  levelFill: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  levelText: {
    flex: 1,
    gap: 2,
  },
  levelName: {
    fontFamily: 'Figtree_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
  },
  pips: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    height: 18,
  },
  pip: {
    borderRadius: 2,
    width: 4,
  },
  option: {
    borderRadius: reedRadii.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    padding: 14,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionExtra: {
    gap: 10,
    paddingBottom: 14,
    paddingHorizontal: 14,
  },
  radio: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  numbers: {
    flexDirection: 'row',
    gap: 8,
  },
  numberTile: {
    alignItems: 'center',
    borderRadius: reedRadii.lg,
    borderWidth: 1.5,
    gap: 2,
    justifyContent: 'center',
    minHeight: 104,
  },
  card: {
    borderRadius: reedRadii.card,
    gap: 14,
    padding: 16,
  },
  field: {
    borderRadius: reedRadii.md,
    borderWidth: 1.5,
  },
  input: {
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  ruler: {
    alignItems: 'center',
    gap: 2,
    width: '100%',
  },
  rulerValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  rulerNudge: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  rulerNumber: {
    flex: 1,
    fontSize: 56,
    letterSpacing: -1.5,
    lineHeight: 64,
    textAlign: 'center',
  },
  rulerCaption: {
    minHeight: 18,
    textAlign: 'center',
  },
  rulerStrip: {
    height: RULER_HEIGHT,
    marginTop: 18,
    width: '100%',
  },
  tick: {
    alignItems: 'center',
    height: RULER_HEIGHT,
    paddingTop: 12,
  },
  tickLine: {
    borderRadius: 1,
    width: 2,
  },
  tickLabel: {
    fontSize: 12,
    position: 'absolute',
    textAlign: 'center',
    top: 52,
    width: RULER_LABEL_WIDTH,
  },
  rulerMarker: {
    borderRadius: 2,
    height: 48,
    left: '50%',
    marginLeft: -2,
    pointerEvents: 'none',
    position: 'absolute',
    top: 6,
    width: 4,
  },
  rulerFade: {
    bottom: 0,
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    width: 56,
  },
});

export const gridStyle: ViewStyle = { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 };
export const gridCell: ViewStyle = { width: '48.5%' };

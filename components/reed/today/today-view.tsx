import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';
import type { Id } from '@/convex/_generated/dataModel';
import { ReedText } from '@/components/ui/reed-text';
import { useEntryAnimation } from '@/design/use-entry-animation';
import { reedHomeMascotMetrics, reedHomeUtilityMetrics } from '@/design/system';
import { getTapScaleStyle, reedMotion } from '@/design/motion';
import * as haptics from '@/design/haptics';
import { useFiveMinuteNow } from '@/components/home/use-five-minute-now';
import { useReedTheme } from '@/design/provider';
import { usePulse } from '@/components/home/pulse/use-pulse';
import { mascotSizes, type MascotExpression } from '../mascot';
import { REPLY_CHIP_STAGGER_MS, ReplyChip } from '../reply-chip';
import type { ReedMessage, ReedQuickAction } from '../reed.types';
import { ReedWidgetView } from '../widgets/registry';
import { styles as columnStyles } from '../reed.styles';
import { splitCoachNote } from './today-content';
import { daypartTitle, type GreetingContext } from './greeting';
import { useGreeting } from './use-greeting';
import { TodayCardView } from './today-cards';
import { useTodayCards } from './use-today-cards';
import { selectHomeSuggestions } from './home-suggestions';

const MAX_CHIPS = 4;
// DESIGN.md → Widgets: at most two widgets per today moment.
const MAX_WIDGETS = 2;

type TodayViewProps = {
  layout: {
    /** Space the dock (and the keyboard) take at the bottom. */
    bottomInset: number;
    /** Written as the view scrolls, so the mascot overlay can follow its hero slot. */
    scrollY: SharedValue<number>;
    topInset: number;
    onHeroLayout: (centerY: number, size: number) => void;
  };
  disabled: boolean;
  displayName: string;
  /** The unseen coach note today opened with; null for the daily greeting. */
  note: ReedMessage | null;
  onAsk: (prompt: string) => void;
  quickActions: ReedQuickAction[];
  history: { available: boolean; open: () => void };
  activity: { activeSession: boolean; hasTrainingHistory: boolean; timeZone?: string };
  /** Called once with the face the greeting calls for, so Reed can wear it. Keep it stable. */
  onGreetingFace?: (expression: MascotExpression) => void;
};

/**
 * Today mode: Reed as the hero. The unseen coach note (with its session summary when it has one),
 * or a deterministic greeting with the starter questions as chips. No history and no model call.
 * The mascot itself is not here: the hero slot only reserves its place.
 */
export function TodayView({
  layout,
  disabled,
  displayName,
  note,
  onAsk,
  quickActions,
  history,
  activity,
  onGreetingFace,
}: TodayViewProps) {
  const { bottomInset, onHeroLayout, scrollY, topInset } = layout;
  const { theme } = useReedTheme();
  const now = useFiveMinuteNow();
  const [seed] = useState(() => Math.floor(Math.random() * 4294967296));
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  const viewport = useWindowDimensions();
  const pulse = usePulse();
  const clock = useMemo(() => {
    const options = { timeZone: activity.timeZone };
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { ...options, weekday: 'short' }).format(now));
    const hour = Number(new Intl.DateTimeFormat('en-GB', { ...options, hour: 'numeric', hourCycle: 'h23' }).format(now));
    return { weekday, hour };
  }, [activity.timeZone, now]);
  const hour = clock.hour;
  const onScroll = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });
  const slotRef = useRef<View>(null);

  const { cards, dismiss } = useTodayCards();
  // A coach note brings its own widget (or its session); older notes only link the session.
  const noteWidget = note?.widget
    ?? (note?.relatedSession ? { kind: 'session_summary' as const, sessionId: note.relatedSession.sessionId as Id<'liveSessions'> } : null);
  const weight = pulse?.bodyweight;
  // Weight is an all-day utility. The proactive reminder's time/dismissal rules must not
  // remove the user's entry point; its collapsed summary reads the live Pulse measurement.
  const todayCards = pulse && !cards.some(card => card.kind === 'weigh_in') && noteWidget?.kind !== 'weigh_in'
    ? [{ kind: 'weigh_in' as const, lastKg: weight?.latestKg ?? null, lastLoggedAt: weight?.loggedAt ?? null, reason: '' }, ...cards] : cards;
  const visibleCards = todayCards.slice(0, MAX_WIDGETS - (noteWidget ? 1 : 0));
  // Moments other than opening the app on a training day get the smaller hero: after a session, a rest day.
  const populatedSize = noteWidget || visibleCards.some(card => card.kind === 'quick_log') ? mascotSizes.heroSmall : mascotSizes.hero;
  const room = Math.max(0, Math.min(1, (viewport.width - reedHomeMascotMetrics.minWidth) / (reedHomeMascotMetrics.fullWidth - reedHomeMascotMetrics.minWidth)));
  const quietScale = viewport.height < reedHomeMascotMetrics.compactHeight ? 1 : 1 + (reedHomeMascotMetrics.quietScale - 1) * room;
  const heroSize = !note && !noteWidget && expandedWidget === null && !visibleCards.some(card => card.kind === 'quick_log')
    ? Math.round(mascotSizes.hero * quietScale) : populatedSize;
  const firstName = displayName.trim().split(/\s+/)[0];
  const name = firstName && firstName !== 'there' ? firstName : null;
  const greetingContext = useMemo<GreetingContext>(
    () => ({ activeSession: activity.activeSession, firstName: name, hour, week: pulse?.week ?? null, weekday: clock.weekday }),
    [activity.activeSession, clock.weekday, hour, name, pulse?.week],
  );
  // Offset so the greeting's draws are independent of the starter chips' draws from the same seed.
  const greeting = useGreeting(greetingContext, seed ^ 0x5bd1e995, !note);
  useEffect(() => {
    if (greeting && greeting.expression !== 'idle') onGreetingFace?.(greeting.expression);
  }, [greeting, onGreetingFace]);
  const content = useMemo(() => {
    if (note) {
      const { body, headline } = splitCoachNote(note.text);
      return { body, title: headline ?? daypartTitle(name, hour) };
    }
    return greeting ? { body: greeting.subheader, title: greeting.emoji ? `${greeting.header} ${greeting.emoji}` : greeting.header } : null;
  }, [greeting, hour, name, note]);
  // Measured, not read from `onLayout`: on web `onLayout` fires for size changes only, and the slot
  // moves whenever the content around it (the session card) changes size.
  const measureHero = useCallback(() => {
    slotRef.current?.measureInWindow((_x, y, _width, height) => {
      if (height > 0) onHeroLayout(y + scrollY.get() + height / 2, height);
    });
  }, [onHeroLayout, scrollY]);
  const suggestions = useMemo(() => selectHomeSuggestions({ hour, weekday: clock.weekday, activeSession: activity.activeSession, trainedToday: pulse?.week.days[(clock.weekday + 6) % 7] === 'done', activeDays: pulse?.week.count ?? 0, targetDays: pulse?.week.target ?? null, hasTrainingHistory: activity.hasTrainingHistory || (pulse?.week.count ?? 0) > 0, hasGoal: !!pulse?.nearestGoal }, seed), [activity.activeSession, activity.hasTrainingHistory, clock.weekday, hour, pulse, seed]);
  const contextual = suggestions.map(item => ({ ...item, prompt: quickActions.find(action => action.id === item.id)?.prompt ?? item.prompt }));
  // A coach note's actual answers stay first; contextual starters fill remaining places.
  const noteReplies = (note?.replies ?? []).slice(0, MAX_CHIPS).map(reply => ({ id: `reply:${reply}`, label: reply, prompt: reply, icon: 'return-up-forward-outline' as const }));
  const chips = [...noteReplies, ...contextual.filter(item => !noteReplies.some(reply => reply.prompt === item.prompt))].slice(0, MAX_CHIPS);
  const disclosure = (key: string) => ({ expanded: expandedWidget === key, onChange: (open: boolean) => setExpandedWidget(open ? key : null) });

  return (
    <Animated.ScrollView
      contentContainerStyle={[
        columnStyles.column,
        styles.content,
        { paddingBottom: bottomInset, paddingHorizontal: theme.spacing.gutter, paddingTop: topInset },
      ]}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={measureHero}
      onLayout={measureHero}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      <View onLayout={measureHero} style={styles.stack}>
        {history.available ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chat history"
            onPress={() => { haptics.selection(); history.open(); }}
            style={({ pressed }) => [styles.history, { gap: theme.spacing.xxs, paddingHorizontal: theme.spacing.xs }, getTapScaleStyle(pressed)]}
          >
            <Ionicons name="time-outline" size={reedHomeUtilityMetrics.icon} color={String(theme.colors.inkSecondary)} />
            <ReedText variant="caption" tone="secondary">History</ReedText>
          </Pressable>
        ) : null}
        <Animated.View onLayout={measureHero} style={[styles.heroArea, { paddingVertical: theme.spacing.xl }]}>
          <View style={styles.heroContent}>
            <View
              collapsable={false}
              onLayout={measureHero}
              ref={slotRef}
              style={{ alignSelf: 'center', height: heroSize, width: heroSize }}
            />

            {content ? <HeroText body={content.body} title={content.title} /> : null}
          </View>
        </Animated.View>

        <Animated.View
          onLayout={measureHero}
          style={styles.actions}
        >
          {noteWidget ? (
            <WidgetSlot>
              <ReedWidgetView related={note?.relatedSession ?? null} widget={noteWidget} disclosure={disclosure('note')} />
            </WidgetSlot>
          ) : null}
          {visibleCards.map(card => (
            <WidgetSlot key={card.kind}>
              <TodayCardView card={card} onDismiss={() => dismiss(card.kind)} disclosure={disclosure(card.kind)} />
            </WidgetSlot>
          ))}

          <View style={styles.chips}>
            {chips.map((chip, index) => (
              <View key={chip.id} style={styles.chipCell}><ReplyChip
                delay={reedMotion.today.chipsDelayMs + index * REPLY_CHIP_STAGGER_MS}
                grid
                icon={chip.icon}
                disabled={disabled}
                label={chip.label}
                onPress={() => onAsk(chip.prompt)}
              /></View>
            ))}
          </View>
        </Animated.View>
      </View>
    </Animated.ScrollView>
  );
}

// The title and body rise in when they first appear: on mount for a coach note, a moment later for
// the greeting, which waits for what was said recently and for the week.
function HeroText({ body, title }: { body: string | null; title: string }) {
  const { theme } = useReedTheme();
  const titleEntry = useEntryAnimation({ delay: reedMotion.today.titleDelayMs, translateY: 8, spring: 'smooth' });
  const bodyEntry = useEntryAnimation({ delay: reedMotion.today.bodyDelayMs, translateY: 8, spring: 'smooth' });
  return (
    <>
      <Animated.View style={[{ gap: theme.spacing.xs }, titleEntry]}>
        {title ? <ReedText style={styles.centered} variant="display">{title}</ReedText> : null}
      </Animated.View>
      {body ? <Animated.View style={bodyEntry}><ReedText style={[styles.centered, styles.body]} tone="secondary" variant="voice">{body}</ReedText></Animated.View> : null}
    </>
  );
}

// Widgets rise in (gentle, 12px) when today mode opens; the chat thread animates its own rows.
function WidgetSlot({ children }: { children: ReactNode }) {
  const entry = useEntryAnimation({ delay: reedMotion.today.widgetsDelayMs, translateY: 8, spring: 'smooth' });
  return <Animated.View style={entry}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  history: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: reedHomeUtilityMetrics.target,
  },
  body: {
    paddingHorizontal: 10,
  },
  centered: {
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  chipCell: { width: '48.5%' },
  content: {
    flexGrow: 1,
  },
  stack: {
    flexGrow: 1,
    gap: 14,
  },
  heroArea: {
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'center',
  },
  heroContent: {
    gap: 14,
  },
  actions: {
    flexShrink: 0,
    gap: 14,
  },
});

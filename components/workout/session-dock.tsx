import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { withColorAlpha } from '@/design/system';
import type { NextAction } from './session-next-action';
import { DOCK_PADDING_TOP, DOCK_ROW_HEIGHT, styles, useExerciseDockSize } from './session-dock.styles';
import type { RestCard } from './workout-surface.types';
import { formatClock } from './workout-surface.utils';
import { useRestCountdown } from './use-rest-countdown';

type SessionDockProps = {
  /** Reed's slot, drawn by the owner so the one session mascot can glide to it. */
  mascot: ReactNode;
  disabled?: boolean;
} & (
  | {
      page: 'timeline';
      next: NextAction;
      restCard: RestCard | null;
      onAdd: () => void;
      onNext: () => void;
    }
  | { page: 'exercise' }
);

/**
 * The thumb zone of a live session (DESIGN.md → Workout surfaces), the home dock's shape with Reed
 * at the left. On the timeline it holds the two things you do between sets: go to whatever is next, and add an
 * exercise (the + sits at the thumb's edge). On an exercise it gives the larger Reed room for whispers; the strip
 * already owns navigation back to the timeline.
 */
export function SessionDock(props: SessionDockProps) {
  const { theme } = useReedTheme();
  const exerciseDockSize = useExerciseDockSize();

  return (
    <DockFrame mascotSize={props.page === 'exercise' ? exerciseDockSize : undefined}>
      {props.mascot}
      {props.page === 'timeline' ? (
        <>
          <NextButton {...props} />
          {props.next.kind === 'add' ? null : (
            <Pressable
              accessibilityLabel="Add exercise"
              accessibilityRole="button"
              disabled={props.disabled}
              onPress={props.onAdd}
              style={({ pressed }) => [
                styles.round,
                { backgroundColor: theme.colors.surfaceRaised },
                getTapScaleStyle(pressed, props.disabled),
              ]}
            >
              <Ionicons color={String(theme.colors.ink)} name="add" size={24} />
            </Pressable>
          )}
        </>
      ) : null}
    </DockFrame>
  );
}

/**
 * The dock's shape, shared by the session and the Sessions page: a canvas band with a fade above it
 * behind one row, and Reed at its left, standing taller than the band.
 */
export function DockFrame({ children, mascotSize }: { children: ReactNode; mascotSize?: number }) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const canvas = String(theme.colors.canvas);
  const band = mascotSize ? insets.bottom : DOCK_ROW_HEIGHT + DOCK_PADDING_TOP + insets.bottom + theme.spacing.xs;

  return (
    <View style={[
      styles.dock,
      { paddingBottom: insets.bottom + (mascotSize ? 0 : theme.spacing.xs) },
      // The mascot-only dock must not cover the card's lower actions with an empty hit area.
      mascotSize ? { right: undefined, width: mascotSize + theme.spacing.chromeGutter * 2 } : undefined,
    ]}>
      <View pointerEvents="none" style={[styles.backdrop, { backgroundColor: theme.colors.canvas, height: band }]}>
        <LinearGradient colors={[withColorAlpha(canvas, 0), canvas]} style={styles.fade} />
      </View>
      <View style={[styles.row, mascotSize ? { height: mascotSize } : undefined]}>{children}</View>
    </View>
  );
}

function NextButton({ disabled, next, onAdd, onNext, restCard }: Extract<SessionDockProps, { page: 'timeline' }>) {
  const { theme } = useReedTheme();
  const isAdd = next.kind === 'add';

  return (
    <Pressable
      accessibilityLabel={isAdd ? 'Add exercise' : `${next.detail}: ${next.title}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={isAdd ? onAdd : onNext}
      style={({ pressed }) => [
        styles.next,
        { backgroundColor: theme.colors.accent },
        getTapScaleStyle(pressed, disabled),
      ]}
    >
      {isAdd ? (
        <>
          <Ionicons color={String(theme.colors.accentText)} name="add" size={20} />
          <ReedText style={{ color: theme.colors.accentText, flex: 1 }} variant="bodyStrong">Add exercise</ReedText>
        </>
      ) : (
        <>
          <View style={styles.nextCopy}>
            <ReedText numberOfLines={1} style={[styles.nextTitle, { color: theme.colors.accentText }]} variant="bodyStrong">
              {next.title}
            </ReedText>
            <ReedText numberOfLines={1} style={[styles.nextDetail, { color: theme.colors.accentText, opacity: 0.8 }]} variant="caption">
              {next.detail}
            </ReedText>
          </View>
          {restCard ? <RestClock card={restCard} /> : <Ionicons color={String(theme.colors.accentText)} name="arrow-forward" size={20} />}
        </>
      )}
    </Pressable>
  );
}

function RestClock({ card }: { card: RestCard }) {
  const { theme } = useReedTheme();
  const remaining = useRestCountdown(card)?.remainingSeconds ?? 0;
  return <ReedText style={[styles.nextClock, { color: theme.colors.accentText }]} variant="bodyStrong">{formatClock(remaining)}</ReedText>;
}

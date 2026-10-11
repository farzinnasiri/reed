import { memo, useRef, useState } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { getTapScaleStyle } from '@/design/motion';
import { reedWorkoutReviewMetrics } from '@/design/system';
import { SessionArtwork } from './session-artwork';
import { formatCompactDuration } from './session-time-format';
import type { EndedSummary } from './use-workout-history';

export const SessionHistoryRow = memo(function SessionHistoryRow({
  session,
  onOpen,
  onDelete,
}: {
  session: EndedSummary;
  onOpen: (id: EndedSummary['sessionId']) => void;
  onDelete: (session: EndedSummary) => void;
}) {
  const { theme } = useReedTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const { presentation } = session;
  const date = new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(session.startedAt);
  const seconds =
    session.manualDurationSeconds ??
    Math.max(0, (session.endedAt - session.startedAt) / 1000);
  const review =
    session.manualDurationSeconds === undefined && seconds > 6 * 3600;
  const actions = () => {
    swipe.current?.close();
    onDelete(session);
  };
  return (
    <ReanimatedSwipeable
      ref={swipe}
      overshootRight={false}
      onSwipeableWillOpen={() => setSwipeOpen(true)}
      onSwipeableWillClose={() => setSwipeOpen(false)}
      rightThreshold={reedWorkoutReviewMetrics.swipeAction / 2}
      renderRightActions={() => (
        <HapticPressable
          accessibilityRole="button"
          disabled={!swipeOpen}
          accessibilityElementsHidden={!swipeOpen}
          aria-hidden={!swipeOpen}
          accessibilityLabel={`Delete ${presentation.title} from ${date}`}
          onPress={actions}
          style={{
            width: reedWorkoutReviewMetrics.swipeAction,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xxs,
            backgroundColor: theme.colors.dangerFill,
          }}
        >
          <Ionicons
            name="trash-outline"
            color={String(theme.colors.dangerInk)}
            size={20}
          />
          <ReedText tone="danger" variant="caption">
            Delete
          </ReedText>
        </HapticPressable>
      )}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.canvas,
          borderRadius: theme.radii.md,
        }}
      >
        <HapticPressable
          systemSwitch={false}
          accessibilityRole="button"
          accessibilityLabel={`Open ${presentation.title}, ${date}`}
          accessibilityHint="Opens workout details. Swipe left to reveal Delete."
          accessibilityActions={[{ name: 'delete', label: 'Delete workout' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'delete') actions();
          }}
          onPress={() => onOpen(session.sessionId)}
          style={({ pressed, hovered }) => [
            {
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.xs,
              borderRadius: theme.radii.md,
              backgroundColor:
                pressed || hovered
                  ? theme.colors.surfaceRaised
                  : theme.colors.canvas,
            },
            getTapScaleStyle(pressed),
          ]}
        >
          <SessionArtwork category={presentation.category} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <ReedText variant="bodyStrong" numberOfLines={2}>
              {presentation.title}
            </ReedText>
            <ReedText tone="secondary" variant="caption">
              {date} · {formatCompactDuration(seconds)}
            </ReedText>
            <ReedText
              tone={review ? 'danger' : 'muted'}
              variant="caption"
              numberOfLines={2}
            >
              {review
                ? 'Review duration'
                : presentation.sets
                  ? `${presentation.sets} ${presentation.sets === 1 ? 'set' : 'sets'}${presentation.areas.length ? ` · ${presentation.areas.slice(0, 3).join(' · ')}` : ''}`
                  : 'No sets logged'}
            </ReedText>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.xxs,
            }}
          >
            <ReedText variant="micro" tone="accent">
              View
            </ReedText>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={String(theme.colors.accentInk)}
            />
          </View>
        </HapticPressable>
      </View>
    </ReanimatedSwipeable>
  );
});

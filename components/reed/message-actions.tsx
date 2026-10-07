import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Portal, PortalHost } from '@gorhom/portal';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  MESSAGE_REACTIONS,
  type MessageReaction,
} from '@/domains/reed/reactions';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { getTapScaleStyle, reedMotion } from '@/design/motion';
import { reedMessageActionMetrics as metrics } from '@/design/system';
import { useEntryAnimation } from '@/design/use-entry-animation';
import * as haptics from '@/design/haptics';
import { useUserOperation } from '@/lib/use-user-operation';
import { usePresenceActivity } from './presence/use-presence-activity';

const MESSAGE_ACTIONS_HOST = 'reed-message-actions';

/** Mounted in the authenticated shell so list clipping and workout sheets cannot hide the picker. */
export function MessageActionsHost() {
  return <PortalHost name={MESSAGE_ACTIONS_HOST} />;
}

/** Message-local controls and one anchored picker; it never changes the row's height on open. */
export function MessageActions({
  children,
  text,
  messageId,
  reaction,
}: {
  children: ReactNode;
  text: string;
  messageId?: string;
  reaction?: MessageReaction;
}) {
  const { theme } = useReedTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const active = usePresenceActivity();
  const trigger = useRef<View>(null);
  const picker = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [currentReaction, setCurrentReaction] = useState(reaction);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const highlight = useRef<number | null>(null);
  const pickerRect = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const scrollOffset = useRef(0);
  const moved = useRef(false);
  const saving = useRef(false);
  const [atEnd, setAtEnd] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setReaction = useMutation(api.reed.setMessageReaction);
  const {
    run: saveReaction,
    isWorking,
    errorMessage,
  } = useUserOperation(
    'reed.message_reaction',
    'Could not save the reaction. Try again.',
  );
  const { run: copyText, errorMessage: copyError } = useUserOperation(
    'reed.message_copy',
    'Could not copy the response. Try again.',
  );
  const canReact = Boolean(messageId);
  const padding = theme.spacing.xs;
  const pickerWidth = Math.min(
    width - theme.spacing.chromeGutter * 2,
    MESSAGE_REACTIONS.length * metrics.targetSize +
      padding * 2 +
      metrics.moreSize,
  );
  const pickerHeight = metrics.targetSize + padding * 2;
  const scrollWidth = pickerWidth - padding * 2 - metrics.moreSize;
  const maxOffset = Math.max(
    0,
    MESSAGE_REACTIONS.length * metrics.targetSize - scrollWidth,
  );
  const left = anchor
    ? Math.max(
        theme.spacing.chromeGutter,
        Math.min(
          anchor.x - pickerWidth / 2,
          width - pickerWidth - theme.spacing.chromeGutter,
        ),
      )
    : 0;
  const top = anchor
    ? Math.max(
        insets.top + padding,
        Math.min(
          anchor.y - pickerHeight - padding,
          height - insets.bottom - pickerHeight - padding,
        ),
      )
    : 0;

  const [previousReaction, setPreviousReaction] = useState({
    messageId,
    reaction,
  });
  if (
    previousReaction.messageId !== messageId ||
    previousReaction.reaction !== reaction
  ) {
    setPreviousReaction({ messageId, reaction });
    setCurrentReaction(reaction);
  }
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) {
      setAnchor(null);
      setHighlighted(null);
    }
  }
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  const close = useCallback(() => {
    setAnchor(null);
    highlight.current = null;
    setHighlighted(null);
    pickerRect.current = null;
  }, []);
  useEffect(() => {
    if (!anchor) return;
    if (Platform.OS === 'web') {
      const escape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      };
      document.addEventListener('keydown', escape);
      return () => document.removeEventListener('keydown', escape);
    }
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => back.remove();
  }, [anchor, close]);

  const choose = useCallback(
    async (emoji: MessageReaction) => {
      if (!messageId || saving.current) return;
      saving.current = true;
      const previous = currentReaction;
      const next = emoji === previous ? null : emoji;
      setCurrentReaction(next ?? undefined);
      haptics.selection();
      close();
      const result = await saveReaction(() =>
        setReaction({
          messageId: messageId as Id<'reedMessages'>,
          reaction: next,
        }),
      );
      saving.current = false;
      if (result.status !== 'success') {
        setCurrentReaction(previous);
        haptics.warning();
      }
    },
    [close, currentReaction, messageId, saveReaction, setReaction],
  );

  const openAt = useCallback(
    (x: number, y: number) => {
      if (!canReact || saving.current) return;
      moved.current = false;
      scrollOffset.current = 0;
      highlight.current = null;
      setHighlighted(null);
      setAtEnd(false);
      setAnchor({ x, y });
      haptics.selection();
    },
    [canReact],
  );
  const track = useCallback(
    (x: number, y: number) => {
      moved.current = true;
      const rect = pickerRect.current;
      const index =
        rect &&
        x >= rect.x + padding &&
        x < rect.x + rect.width - padding - metrics.moreSize &&
        y >= rect.y &&
        y <= rect.y + rect.height
          ? Math.floor(
              (x - rect.x - padding + scrollOffset.current) /
                metrics.targetSize,
            )
          : null;
      const next =
        index !== null && index >= 0 && index < MESSAGE_REACTIONS.length
          ? index
          : null;
      if (highlight.current === next) return;
      highlight.current = next;
      setHighlighted(next);
      if (next !== null) haptics.selection();
    },
    [padding],
  );
  const release = useCallback(
    (x: number, y: number) => {
      if (!moved.current) return; // A hold without sliding leaves the picker open for tapping/scrolling.
      track(x, y);
      const emoji =
        highlight.current === null
          ? undefined
          : MESSAGE_REACTIONS[highlight.current];
      if (emoji) void choose(emoji);
      else close();
    },
    [choose, close, track],
  );
  // Gesture builders register these callbacks; they do not execute them during render.
  /* eslint-disable react-hooks/refs */
  const hold = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canReact)
        .activateAfterLongPress(reedMotion.messageActions.holdMs)
        .shouldCancelWhenOutside(false)
        .runOnJS(true)
        .onStart((event) => openAt(event.absoluteX, event.absoluteY))
        .onUpdate((event) => {
          // Pan also emits an update at activation; a stationary hold must stay open on release.
          if (
            Math.hypot(event.translationX, event.translationY) >=
            reedMotion.messageActions.slideActivation
          ) {
            track(event.absoluteX, event.absoluteY);
          }
        })
        .onEnd((event) => release(event.absoluteX, event.absoluteY))
        .onFinalize((_event, success) => {
          if (!success) close();
        }),
    [canReact, close, openAt, release, track],
  );
  /* eslint-enable react-hooks/refs */

  async function copy() {
    const result = await copyText(() => Clipboard.setStringAsync(text));
    if (result.status !== 'success') return;
    setCopied(true);
    haptics.selection();
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(
      () => setCopied(false),
      reedMotion.messageActions.copyFeedbackMs,
    );
  }

  return (
    <View>
      <GestureDetector gesture={hold}>
        <View collapsable={false}>{children}</View>
      </GestureDetector>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xxs,
        }}
      >
        {canReact ? (
          <Pressable
            ref={trigger}
            accessibilityRole="button"
            accessibilityLabel={
              currentReaction
                ? `Change reaction ${currentReaction}`
                : 'React to response'
            }
            accessibilityHint="Opens reactions beside this message."
            disabled={isWorking}
            onPress={() =>
              trigger.current?.measureInWindow((x, y, w) =>
                openAt(x + w / 2, y),
              )
            }
            style={({ pressed }) => [
              {
                minWidth: metrics.targetSize,
                minHeight: metrics.targetSize,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radii.pill,
                backgroundColor: currentReaction
                  ? theme.colors.surfaceRaised
                  : undefined,
              },
              getTapScaleStyle(pressed),
            ]}
          >
            {currentReaction ? (
              <ReedText variant="body">{currentReaction}</ReedText>
            ) : (
              <Ionicons
                name="happy-outline"
                size={18}
                color={String(theme.colors.inkMuted)}
              />
            )}
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copied ? 'Response copied' : 'Copy response'}
          accessibilityHint="Copies this Reed response to the clipboard."
          onPress={() => void copy()}
          style={({ pressed }) => [
            {
              width: metrics.targetSize,
              minHeight: metrics.targetSize,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.xs,
            },
            getTapScaleStyle(pressed),
          ]}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={16}
            color={String(
              copied ? theme.colors.accentInk : theme.colors.inkMuted,
            )}
          />
        </Pressable>
      </View>
      {errorMessage || copyError ? (
        <ReedText accessibilityRole="alert" tone="danger" variant="caption">
          {errorMessage ?? copyError}
        </ReedText>
      ) : null}
      {anchor ? (
        <Portal hostName={MESSAGE_ACTIONS_HOST}>
          <View
            accessibilityViewIsModal
            style={[
              StyleSheet.absoluteFill,
              { pointerEvents: 'auto', zIndex: 70 },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close reactions"
              onPress={close}
              style={StyleSheet.absoluteFill}
            />
            <View
              ref={picker}
              onLayout={() =>
                picker.current?.measureInWindow((x, y, w, h) => {
                  pickerRect.current = { x, y, width: w, height: h };
                })
              }
              style={{
                position: 'absolute',
                left,
                top,
                width: pickerWidth,
                height: pickerHeight,
              }}
            >
              <PickerEnter>
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    padding,
                    backgroundColor: theme.colors.surfaceRaised,
                    borderRadius: theme.radii.lg,
                  }}
                >
                  <ScrollView
                    ref={scroll}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="always"
                    style={{ flex: 1 }}
                    scrollEventThrottle={16}
                    onScroll={(event) => {
                      scrollOffset.current = event.nativeEvent.contentOffset.x;
                      setAtEnd(scrollOffset.current >= maxOffset - 1);
                    }}
                  >
                    {MESSAGE_REACTIONS.map((emoji, index) => (
                      <Pressable
                        key={emoji}
                        accessibilityRole="button"
                        accessibilityLabel={`React ${emoji}`}
                        accessibilityHint={
                          currentReaction === emoji
                            ? 'Removes your current reaction.'
                            : undefined
                        }
                        accessibilityState={{
                          selected: currentReaction === emoji,
                        }}
                        disabled={isWorking}
                        onPress={() => void choose(emoji)}
                        style={({ pressed }) => [
                          {
                            width: metrics.targetSize,
                            height: metrics.targetSize,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: theme.radii.sm,
                            backgroundColor:
                              highlighted === index || currentReaction === emoji
                                ? theme.colors.accentSoft
                                : undefined,
                          },
                          getTapScaleStyle(pressed),
                        ]}
                      >
                        <ReedText
                          variant="title"
                          style={{ fontSize: metrics.emojiSize }}
                        >
                          {emoji}
                        </ReedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {maxOffset > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        atEnd ? 'First reactions' : 'More reactions'
                      }
                      onPress={() =>
                        scroll.current?.scrollTo({
                          x: atEnd
                            ? 0
                            : Math.min(
                                maxOffset,
                                scrollOffset.current + metrics.targetSize * 4,
                              ),
                          animated: false,
                        })
                      }
                      style={({ pressed }) => [
                        {
                          width: metrics.moreSize,
                          height: metrics.targetSize,
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                        getTapScaleStyle(pressed),
                      ]}
                    >
                      <Ionicons
                        name={atEnd ? 'chevron-back' : 'chevron-forward'}
                        size={18}
                        color={String(theme.colors.inkSecondary)}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </PickerEnter>
            </View>
          </View>
        </Portal>
      ) : null}
    </View>
  );
}

function PickerEnter({ children }: { children: ReactNode }) {
  const enter = useEntryAnimation({
    spring: 'snappy',
    translateY: 0,
    fromScale: reedMotion.messageActions.enterScale,
  });
  return <Animated.View style={[{ flex: 1 }, enter]}>{children}</Animated.View>;
}

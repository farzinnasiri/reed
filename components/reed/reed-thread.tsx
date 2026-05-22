import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Animated, Pressable, ScrollView, View, type ScrollView as ScrollViewType } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { createTiming, getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { styles } from './reed.styles';
import type { ReedMessage } from './reed.types';

export function ReedThread({
  contentPaddingBottom,
  contentPaddingTop,
  hasMoreMessages,
  isMessageSaved,
  isReady,
  messages,
  onLoadOlderMessages,
  onSaveCoachItem,
  scrollRef,
}: {
  contentPaddingBottom: number;
  contentPaddingTop: number;
  hasMoreMessages: boolean;
  isMessageSaved: (message: ReedMessage) => boolean;
  isReady: boolean;
  messages: ReedMessage[];
  onLoadOlderMessages: () => void;
  onSaveCoachItem: (message: ReedMessage) => void;
  scrollRef: RefObject<ScrollViewType | null>;
}) {
  const { theme } = useReedTheme();
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  function handleScrollToBottom() {
    scrollRef.current?.scrollToEnd({ animated: true });
    setShowScrollToBottom(false);
  }

  return (
    <View style={[styles.threadRoot, !isReady && styles.threadRootHidden]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: contentPaddingBottom,
            paddingHorizontal: theme.spacing.sm,
            paddingTop: contentPaddingTop,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (!isReady) {
            scrollRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onScroll={event => {
          if (hasMoreMessages && event.nativeEvent.contentOffset.y < 80) {
            onLoadOlderMessages();
          }

          const distanceFromBottom = event.nativeEvent.contentSize.height
            - event.nativeEvent.layoutMeasurement.height
            - event.nativeEvent.contentOffset.y;
          setShowScrollToBottom(distanceFromBottom > 260);
        }}
        scrollEventThrottle={16}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.thread}>
          {messages.map((message, index) => {
            const previousMessage = messages[index - 1];
            const shouldShowDateIndicator = !previousMessage || !isSameMessageDay(previousMessage.createdAt, message.createdAt);

            return (
              <View key={message.id} style={styles.messageCluster}>
                {shouldShowDateIndicator ? <DateIndicator createdAt={message.createdAt} /> : null}
                <MessageRow
                  isSaved={isMessageSaved(message)}
                  message={message}
                  onSaveCoachItem={onSaveCoachItem}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>

      {showScrollToBottom ? (
        <Pressable
          accessibilityLabel="Scroll to latest message"
          accessibilityRole="button"
          onPress={handleScrollToBottom}
          style={({ pressed }) => [
            styles.scrollToBottomButton,
            {
              backgroundColor: theme.colors.controlFill,
              borderColor: theme.colors.controlBorder,
              bottom: Math.max(88, contentPaddingBottom - theme.spacing.md),
            },
            getTapScaleStyle(pressed),
          ]}
        >
          <Ionicons color={String(theme.colors.textMuted)} name="arrow-down" size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

function MessageRow({
  isSaved,
  message,
  onSaveCoachItem,
}: {
  isSaved: boolean;
  message: ReedMessage;
  onSaveCoachItem: (message: ReedMessage) => void;
}) {
  const { theme } = useReedTheme();
  const isAssistant = message.role === 'assistant';
  const isPendingAssistant = isAssistant && message.status === 'pending';
  const showActionBar = isAssistant && message.status === 'sent' && (message.text?.trim().length ?? 0) > 0;
  const messageText = message.text ?? '';
  const bubbleCornerStyle = isAssistant ? styles.messageBubbleLeft : styles.messageBubbleRight;
  const [copiedFeedbackMessageId, setCopiedFeedbackMessageId] = useState<string | null>(null);
  const isCopiedFeedbackVisible = copiedFeedbackMessageId === message.id;

  function handleSave() {
    onSaveCoachItem(message);
    void Haptics.selectionAsync();
  }

  async function handleCopy() {
    await Clipboard.setStringAsync(messageText);
    setCopiedFeedbackMessageId(message.id);
    void Haptics.selectionAsync();
    setTimeout(() => setCopiedFeedbackMessageId(current => (current === message.id ? null : current)), 1200);
  }

  if (isPendingAssistant) {
    return (
      <View style={styles.messageRowLeft}>
        <View style={[styles.typingBubble, { backgroundColor: theme.colors.controlFill, borderColor: theme.colors.controlBorder }]}>
          <TypingDots />
        </View>
      </View>
    );
  }

  return (
    <View style={isAssistant ? styles.messageRowLeft : styles.messageRowRight}>
      <View style={isAssistant ? styles.assistantMessageGroup : styles.userMessageGroup}>
        <View
          style={[
            styles.messageBubble,
            bubbleCornerStyle,
            {
              backgroundColor: isAssistant ? theme.colors.controlFill : theme.colors.accentPrimary,
              borderColor: isAssistant ? theme.colors.controlBorder : theme.colors.accentPrimary,
            },
          ]}
        >
          <ReedText
            style={{ color: isAssistant ? undefined : theme.colors.accentPrimaryText }}
            variant="body"
          >
            {messageText}
          </ReedText>

          {showActionBar ? (
            <View style={styles.messageActionBar}>
              <View style={styles.messageActionCluster}>
                <Pressable
                  accessibilityHint="Saves this Reed response as a coach item."
                  accessibilityLabel="Save as coach item"
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={handleSave}
                  style={({ pressed }) => [styles.messageInlineAction, getTapScaleStyle(pressed)]}
                >
                  <Ionicons
                    color={String(theme.colors.textMuted)}
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={15}
                  />
                </Pressable>
                <Pressable
                  accessibilityHint="Copies this Reed response to the clipboard."
                  accessibilityLabel="Copy response"
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => void handleCopy()}
                  style={({ pressed }) => [styles.messageInlineAction, getTapScaleStyle(pressed)]}
                >
                  <Ionicons
                    color={String(isCopiedFeedbackVisible ? theme.colors.accentPrimary : theme.colors.textMuted)}
                    name={isCopiedFeedbackVisible ? 'checkmark' : 'copy-outline'}
                    size={15}
                  />
                </Pressable>
              </View>

              <ReedText style={{ color: theme.colors.textMuted }} variant="caption">
                {formatMessageTime(message.createdAt)}
              </ReedText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function DateIndicator({ createdAt }: { createdAt: number }) {
  const { theme } = useReedTheme();

  return (
    <View style={styles.dateIndicatorRow}>
      <View style={[styles.dateIndicatorPill, { backgroundColor: theme.colors.controlFill, borderColor: theme.colors.controlBorder }]}>
        <ReedText style={{ color: theme.colors.textMuted }} variant="caption">
          {formatMessageDate(createdAt)}
        </ReedText>
      </View>
    </View>
  );
}

function formatMessageTime(createdAt: number) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMessageDate(createdAt: number) {
  const messageDate = new Date(createdAt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameMessageDay(messageDate.getTime(), today.getTime())) return 'Today';
  if (isSameMessageDay(messageDate.getTime(), yesterday.getTime())) return 'Yesterday';

  return messageDate.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: messageDate.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

function isSameMessageDay(left: number, right: number) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

function TypingDots() {
  const { theme } = useReedTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        createTiming(progress, 1, 700),
        createTiming(progress, 0, 700),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <View style={styles.typingDotsRow}>
      {[0, 1, 2].map(index => {
        const phase = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: index === 0 ? [0.42, 0.72, 0.42] : index === 1 ? [0.56, 0.42, 0.72] : [0.72, 0.56, 0.42],
        });
        return (
          <Animated.View
            key={index}
            style={[
              styles.typingDot,
              {
                backgroundColor: theme.colors.textMuted,
                opacity: phase,
                transform: [{ translateY: Animated.multiply(phase, -1) }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

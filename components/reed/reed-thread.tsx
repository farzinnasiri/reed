import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, type RefObject } from 'react';
import { Animated, Pressable, ScrollView, View, type ScrollView as ScrollViewType } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { createTiming, getTapScaleStyle, reedMotion } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { styles } from './reed.styles';
import type { ReedMessage } from './reed.types';

export function ReedThread({
  contentPaddingBottom,
  contentPaddingTop,
  messages,
  onReplyToMessage,
  onSaveCoachItem,
  scrollRef,
}: {
  contentPaddingBottom: number;
  contentPaddingTop: number;
  messages: ReedMessage[];
  onReplyToMessage: (message: ReedMessage) => void;
  onSaveCoachItem: (message: ReedMessage) => void;
  scrollRef: RefObject<ScrollViewType | null>;
}) {
  const { theme } = useReedTheme();

  return (
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
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.thread}>
        {messages.map(message => (
          <MessageRow
            key={message.id}
            message={message}
            onReplyToMessage={onReplyToMessage}
            onSaveCoachItem={onSaveCoachItem}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function MessageRow({
  message,
  onReplyToMessage,
  onSaveCoachItem,
}: {
  message: ReedMessage;
  onReplyToMessage: (message: ReedMessage) => void;
  onSaveCoachItem: (message: ReedMessage) => void;
}) {
  const { theme } = useReedTheme();
  const isAssistant = message.role === 'assistant';
  const isPendingAssistant = isAssistant && message.status === 'pending';
  const showSideActions = isAssistant && message.status === 'sent' && (message.text?.trim().length ?? 0) > 0;
  const messageText = message.text ?? '';
  const bubbleCornerStyle = isAssistant ? styles.messageBubbleLeft : styles.messageBubbleRight;
  const enterProgress = useRef(new Animated.Value(message.status === 'sent' ? 0 : 1)).current;

  useEffect(() => {
    if (message.status !== 'sent') return;
    enterProgress.setValue(0);
    createTiming(enterProgress, 1, reedMotion.durations.mode).start();
  }, [enterProgress, message.status]);

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
    <Animated.View
      style={[
        isAssistant ? styles.messageRowLeft : styles.messageRowRight,
        {
          opacity: enterProgress,
          transform: [
            {
              translateY: enterProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [reedMotion.distances.listInsertY, 0],
              }),
            },
          ],
        },
      ]}
    >
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
        </View>

        {showSideActions ? (
          <View style={styles.messageSideActions}>
            <Pressable
              accessibilityHint="Saves this Reed response as a coach item."
              accessibilityLabel="Save as coach item"
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => onSaveCoachItem(message)}
              style={({ pressed }) => [
                styles.messageSideAction,
                { borderColor: theme.colors.controlBorder },
                getTapScaleStyle(pressed),
              ]}
            >
              <Ionicons color={String(theme.colors.textMuted)} name="bookmark-outline" size={12} />
            </Pressable>
            <Pressable
              accessibilityHint="Starts a reply to this Reed response."
              accessibilityLabel="Reply to this response"
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => onReplyToMessage(message)}
              style={({ pressed }) => [
                styles.messageSideAction,
                { borderColor: theme.colors.controlBorder },
                getTapScaleStyle(pressed),
              ]}
            >
              <Ionicons color={String(theme.colors.textMuted)} name="return-up-back-outline" size={12} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function TypingDots() {
  const { theme } = useReedTheme();

  return (
    <View style={styles.typingDotsRow}>
      {[0, 1, 2].map(index => (
        <View
          key={index}
          style={[
            styles.typingDot,
            {
              backgroundColor: theme.colors.textMuted,
              opacity: 0.42 + index * 0.16,
            },
          ]}
        />
      ))}
    </View>
  );
}

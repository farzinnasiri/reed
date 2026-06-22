import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Bubble,
  Composer,
  GiftedChat,
  InputToolbar,
  MessageText,
  Send,
  type BubbleProps,
  type ComposerProps,
  type IMessage,
  type InputToolbarProps,
  type SendProps,
} from 'react-native-gifted-chat';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

export const REED_CHAT_USER = { _id: 'reed', name: 'Reed' } as const;
export const VIEWER_CHAT_USER = { _id: 'viewer', name: 'You' } as const;

export type ReedChatMessage = IMessage;

type ReedChatProps = Omit<
  Parameters<typeof GiftedChat<ReedChatMessage>>[0],
  'renderAvatar' | 'renderBubble' | 'renderDay' | 'renderTime' | 'user'
> & {
  composerAccessory?: ReactNode;
  user?: Parameters<typeof GiftedChat<ReedChatMessage>>[0]['user'];
};

export function ReedGiftedChat({
  composerAccessory,
  user = VIEWER_CHAT_USER,
  ...props
}: ReedChatProps) {
  const { theme } = useReedTheme();
  const textInputProps = (props.textInputProps ?? {}) as { style?: unknown; [key: string]: unknown };

  return (
    <GiftedChat<ReedChatMessage>
      {...props}
      colorScheme={theme.mode}
      isAvatarVisibleForEveryMessage={false}
      isDayAnimationEnabled={false}
      isUserAvatarVisible={false}
      renderAvatar={null}
      renderBubble={bubbleProps => <ReedChatBubble {...bubbleProps} />}
      renderComposer={composerProps => <ReedChatComposer {...composerProps} />}
      renderDay={() => null}
      renderInputToolbar={toolbarProps => (
        <ReedChatInputToolbar {...toolbarProps} composerAccessory={composerAccessory} />
      )}
      renderSend={sendProps => <ReedChatSend {...sendProps} />}
      renderTime={() => null}
      textInputProps={{
        placeholderTextColor: String(theme.colors.textMuted),
        ...textInputProps,
        style: [
          {
            color: theme.colors.textPrimary,
            fontFamily: theme.typography.body.fontFamily,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          },
          textInputProps.style,
        ],
      }}
      user={user}
    />
  );
}

export function ReedChatBubble(props: BubbleProps<ReedChatMessage>) {
  const { theme } = useReedTheme();
  const isLeft = props.position === 'left';
  const bubbleFill = isLeft ? theme.colors.controlFill : theme.colors.accentPrimary;
  const bubbleBorder = isLeft ? theme.colors.controlBorder : theme.colors.accentPrimary;
  const textColor = isLeft ? theme.colors.textPrimary : theme.colors.accentPrimaryText;

  return (
    <View style={[styles.bubbleFrame, isLeft ? styles.bubbleFrameLeft : styles.bubbleFrameRight]}>
      <Bubble<ReedChatMessage>
        {...props}
        containerStyle={{
          left: styles.bubbleContainer,
          right: styles.bubbleContainer,
        }}
        renderMessageText={messageTextProps => (
          <MessageText
            {...messageTextProps}
            containerStyle={{
              left: styles.messageTextContainer,
              right: styles.messageTextContainer,
            }}
          />
        )}
        renderTime={() => null}
        textStyle={{
          left: {
            color: textColor,
            fontFamily: theme.typography.bodyStrong.fontFamily,
            fontSize: theme.typography.bodyStrong.fontSize,
            lineHeight: theme.typography.bodyStrong.lineHeight,
          },
          right: {
            color: textColor,
            fontFamily: theme.typography.body.fontFamily,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
          },
        }}
        wrapperStyle={{
          left: [
            styles.bubbleWrapper,
            {
              backgroundColor: bubbleFill,
              borderColor: bubbleBorder,
            },
          ],
          right: [
            styles.bubbleWrapper,
            {
              backgroundColor: bubbleFill,
              borderColor: bubbleBorder,
            },
          ],
        }}
      />
    </View>
  );
}

function ReedChatInputToolbar({
  composerAccessory,
  ...props
}: InputToolbarProps<ReedChatMessage> & { composerAccessory?: ReactNode }) {
  const { theme } = useReedTheme();

  return (
    <View style={styles.inputToolbarWrap}>
      <InputToolbar<ReedChatMessage>
        {...props}
        containerStyle={[
          styles.inputToolbar,
          {
            backgroundColor: theme.colors.controlFill,
            borderColor: theme.colors.controlBorder,
          },
        ]}
        primaryStyle={styles.inputToolbarPrimary}
      />
      {composerAccessory}
    </View>
  );
}

function ReedChatComposer(props: ComposerProps) {
  const { theme } = useReedTheme();

  return (
    <Composer
      {...props}
      textInputProps={{
        ...props.textInputProps,
        placeholder: props.textInputProps?.placeholder ?? 'Message Reed',
        style: [
          styles.composerInput,
          {
            color: theme.colors.textPrimary,
            fontFamily: theme.typography.body.fontFamily,
          },
          props.textInputProps?.style,
        ],
      }}
    />
  );
}

function ReedChatSend(props: SendProps<ReedChatMessage>) {
  const { theme } = useReedTheme();
  const disabled = !props.text?.trim();

  return (
    <Send<ReedChatMessage>
      {...props}
      containerStyle={styles.sendContainer}
    >
      <Pressable
        accessibilityHint="Sends your message to Reed."
        accessibilityLabel="Send message"
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={({ pressed }) => [
          styles.sendButton,
          {
            backgroundColor: disabled ? theme.colors.controlFill : theme.colors.accentPrimary,
            borderColor: disabled ? theme.colors.controlBorder : theme.colors.accentPrimary,
          },
          getTapScaleStyle(pressed, disabled),
        ]}
      >
        <Ionicons
          color={String(disabled ? theme.colors.textMuted : theme.colors.accentPrimaryText)}
          name="arrow-up"
          size={18}
        />
      </Pressable>
    </Send>
  );
}

export function ReedChatTypingBubble() {
  const { theme } = useReedTheme();

  return (
    <View style={[styles.typingRow, styles.bubbleFrameLeft]}>
      <View
        style={[
          styles.typingBubble,
          {
            backgroundColor: theme.colors.controlFill,
            borderColor: theme.colors.controlBorder,
          },
        ]}
      >
        {[0, 1, 2].map(index => (
          <View
            key={index}
            style={[
              styles.typingDot,
              {
                backgroundColor: theme.colors.textMuted,
                opacity: 0.48 + index * 0.16,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export function ReedChatAvatar() {
  const { theme } = useReedTheme();

  return (
    <View style={[styles.avatar, { backgroundColor: theme.colors.accentPrimary }]}>
      <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="bodyStrong">
        R
      </ReedText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  bubbleFrame: {
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
  bubbleFrameLeft: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    marginLeft: 8,
    maxWidth: '88%',
  },
  bubbleFrameRight: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
    marginRight: 8,
    maxWidth: '88%',
  },
  bubbleContainer: {
    flexShrink: 1,
    maxWidth: '100%',
  },
  bubbleWrapper: {
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    marginLeft: 0,
    marginRight: 0,
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  composerInput: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 34,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  inputToolbar: {
    borderRadius: reedRadii.xl,
    borderTopWidth: 0,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  inputToolbarPrimary: {
    alignItems: 'center',
  },
  inputToolbarWrap: {
    paddingBottom: 0,
  },
  messageTextContainer: {
    marginHorizontal: 10,
    marginVertical: 7,
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 0,
  },
  typingBubble: {
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  typingDot: {
    borderRadius: reedRadii.pill,
    height: 7,
    width: 7,
  },
  typingRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
});

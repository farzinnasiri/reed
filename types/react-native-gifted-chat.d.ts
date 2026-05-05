declare module 'react-native-gifted-chat' {
  import type { ComponentProps, ReactNode } from 'react';
  import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

  export type User = {
    _id: string | number;
    name?: string;
    avatar?: string | number | ((props: unknown) => ReactNode);
  };

  export type IMessage = {
    _id: string | number;
    text: string;
    createdAt: Date | number;
    user: User;
    image?: string;
    video?: string;
    audio?: string;
    system?: boolean;
    sent?: boolean;
    received?: boolean;
    pending?: boolean;
  };

  export type LeftRightStyle<T> = {
    left?: StyleProp<T>;
    right?: StyleProp<T>;
  };

  export type BubbleProps<TMessage extends IMessage = IMessage> = {
    currentMessage: TMessage;
    position: 'left' | 'right';
    user?: User;
    nextMessage?: TMessage;
    previousMessage?: TMessage;
    containerStyle?: LeftRightStyle<ViewStyle>;
    wrapperStyle?: LeftRightStyle<ViewStyle>;
    textStyle?: LeftRightStyle<TextStyle>;
    renderMessageText?: (props: MessageTextProps<TMessage>) => ReactNode;
    renderTime?: () => ReactNode;
  };

  export type MessageTextProps<TMessage extends IMessage = IMessage> = {
    currentMessage: TMessage;
    position?: 'left' | 'right';
    containerStyle?: LeftRightStyle<ViewStyle>;
    textStyle?: LeftRightStyle<TextStyle>;
  };

  export type ComposerProps = {
    text?: string;
    textInputProps?: any;
  };

  export type InputToolbarProps<TMessage extends IMessage = IMessage> = {
    containerStyle?: StyleProp<ViewStyle>;
    primaryStyle?: StyleProp<ViewStyle>;
    renderActions?: (props: unknown) => ReactNode;
    renderComposer?: (props: ComposerProps) => ReactNode;
    renderSend?: (props: SendProps<TMessage>) => ReactNode;
    text?: string;
    textInputProps?: any;
  };

  export type SendProps<TMessage extends IMessage = IMessage> = {
    text?: string;
    containerStyle?: StyleProp<ViewStyle>;
    children?: ReactNode;
    onSend?: (messages: TMessage[], shouldResetInputToolbar?: boolean) => void;
  };

  export function Bubble<TMessage extends IMessage = IMessage>(props: BubbleProps<TMessage>): ReactNode;
  export function Composer(props: ComposerProps): ReactNode;
  export function GiftedChat<TMessage extends IMessage = IMessage>(
    props: {
      messages?: TMessage[];
      onSend?: (messages: TMessage[]) => void;
      user?: User;
      renderAvatar?: null | ((props: unknown) => ReactNode);
      renderBubble?: (props: BubbleProps<TMessage>) => ReactNode;
      renderComposer?: (props: ComposerProps) => ReactNode;
      renderDay?: () => ReactNode;
      renderInputToolbar?: (props: InputToolbarProps<TMessage>) => ReactNode;
      renderSend?: (props: SendProps<TMessage>) => ReactNode;
      renderTime?: () => ReactNode;
      renderActions?: (props: unknown) => ReactNode;
      renderTypingIndicator?: () => ReactNode;
      textInputProps?: any;
      listProps?: Record<string, unknown>;
      messagesContainerStyle?: StyleProp<ViewStyle>;
      colorScheme?: 'light' | 'dark';
      isAlignedTop?: boolean;
      isAvatarVisibleForEveryMessage?: boolean;
      isDayAnimationEnabled?: boolean;
      isInverted?: boolean;
      isSendButtonAlwaysVisible?: boolean;
      isTyping?: boolean;
      isUserAvatarVisible?: boolean;
      keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
    } & Record<string, unknown>,
  ): ReactNode;
  export function InputToolbar<TMessage extends IMessage = IMessage>(props: InputToolbarProps<TMessage>): ReactNode;
  export function MessageText<TMessage extends IMessage = IMessage>(props: MessageTextProps<TMessage>): ReactNode;
  export function Send<TMessage extends IMessage = IMessage>(props: SendProps<TMessage>): ReactNode;
}

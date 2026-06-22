import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analytics } from '@/lib/analytics';
import { Platform, View, type ScrollView as ScrollViewType } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { KeyboardEvents } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReedTheme } from '@/design/provider';
import { ReedText } from '@/components/ui/reed-text';
import { ReedCoachItemsPage } from './reed-coach-items-page';
import { ReedComposer } from './reed-composer';
import { ReedHeader } from './reed-header';
import { ReedImageEditor } from './reed-image-editor';
import { createLocalMockReedRuntime } from './reed.runtime';
import { styles } from './reed.styles';
import { ReedThread } from './reed-thread';
import type { ReedSurfaceProps } from './reed.types';
import { useReedAttachments } from './use-reed-attachments';
import { useReedConversation } from './use-reed-conversation';
import { useReedPresence } from './use-reed-presence';
import { useSpeechDraft } from '@/lib/speech/use-speech-draft';

export function ReedSurface({ displayName, dockReservedSpace }: ReedSurfaceProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewType | null>(null);
  const hasInitialScrollSettledRef = useRef(false);
  const hasInitialComposerAlignmentRef = useRef(false);
  const [isViewingCoachItems, setIsViewingCoachItems] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [composerDockHeight, setComposerDockHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isThreadReady, setIsThreadReady] = useState(false);
  const [voiceToastMessage, setVoiceToastMessage] = useState<string | null>(null);
  const {
    attachFromCamera,
    attachFromFiles,
    attachFromLibrary,
    attachments,
    cancelImageEditor,
    canAttachMore,
    clearAttachments,
    editingImage,
    isPreparingAttachments,
    lastError: lastAttachmentError,
    readyAttachmentIds,
    removeAttachment,
    uploadEditedImage,
  } = useReedAttachments();

  const runtime = useMemo(() => createLocalMockReedRuntime(), []);
  const presence = useQuery(api.reed.getPresence, {});
  const quickActions = useQuery(api.reed.listQuickActions, {});
  const { isOnline: isReedOnline, label: reedPresenceLabel, markOnline, shouldDelayAssistantStart } = useReedPresence(presence?.lastMessageAt ?? null);
  const {
    coachItems,
    hasMoreMessages,
    isLoadingInitialMessages,
    isMessageSaved,
    loadOlderMessages,
    messages,
    pendingRunId,
    resolveCoachItem,
    retryAssistantMessage,
    saveCoachItem,
    sendPrompt,
  } = useReedConversation({
    displayName,
    markOnline,
    runtime,
    shouldDelayAssistantStart,
  });
  const showVoiceToast = useCallback((message: string) => {
    setVoiceToastMessage(message);
  }, []);
  const {
    reset: resetVoice,
    retry: retryVoice,
    start: startVoice,
    state: speechState,
    stop: stopVoice,
  } = useSpeechDraft('chat', transcript => {
    setComposerText(current => current.trim() ? `${current.trimEnd()} ${transcript}` : transcript);
  }, { onError: showVoiceToast });
  const voiceState = useMemo(() => ({
    error: speechState.error,
    status: speechState.status,
    transcript: speechState.status === 'transcribing'
      ? 'Transcribing...'
      : speechState.status === 'failed'
        ? speechState.error ?? 'Could not transcribe audio.'
        : '',
    voiceLevel: speechState.voiceLevel,
  }), [speechState.error, speechState.status, speechState.voiceLevel]);

  const openCoachItems = useMemo(
    () => coachItems.filter(item => item.status === 'open'),
    [coachItems],
  );
  const visibleQuickActions = quickActions ?? [];
  const shouldShowQuickActions = !isReedOnline && voiceState.status === 'idle' && visibleQuickActions.length > 0;
  const headerTopInset = insets.top + theme.spacing.sm;
  const contentTopPadding = headerTopInset + 44 + theme.spacing.lg;
  const keyboardLift = Platform.OS === 'android' ? Math.max(0, keyboardHeight - insets.bottom) : 0;
  const composerBottomPadding = keyboardLift > 0 ? theme.spacing.xs : dockReservedSpace + theme.spacing.xs;
  const scrollBottomSpace = composerDockHeight > 0
    ? keyboardLift + composerDockHeight + theme.spacing.lg
    : composerBottomPadding + keyboardLift + theme.spacing.xxxl;
  const latestMessageSignature = useMemo(() => {
    const latest = messages[messages.length - 1];
    if (!latest) return 'empty';
    return `${latest.id}:${latest.status}:${latest.text.length}:${messages.length}`;
  }, [messages]);

  useEffect(() => {
    const showSubscriptions = [
      KeyboardEvents.addListener('keyboardWillShow', event => {
        setKeyboardHeight(event.height);
      }),
      KeyboardEvents.addListener('keyboardDidShow', event => {
        setKeyboardHeight(event.height);
      }),
    ];
    const hideSubscriptions = [
      KeyboardEvents.addListener('keyboardWillHide', () => {
        setKeyboardHeight(0);
      }),
      KeyboardEvents.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
      }),
    ];

    return () => {
      showSubscriptions.forEach(subscription => subscription.remove());
      hideSubscriptions.forEach(subscription => subscription.remove());
    };
  }, []);

  useEffect(() => {
    if (isLoadingInitialMessages) {
      return;
    }

    if (messages.length === 0) {
      setIsThreadReady(true);
      return;
    }

    if (hasInitialScrollSettledRef.current) {
      return;
    }

    const timeout = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
      requestAnimationFrame(() => {
        hasInitialScrollSettledRef.current = true;
        if (composerDockHeight > 0 && !hasInitialComposerAlignmentRef.current) {
          hasInitialComposerAlignmentRef.current = true;
          scrollRef.current?.scrollToEnd({ animated: false });
          requestAnimationFrame(() => setIsThreadReady(true));
        }
      });
    }, 0);
    return () => clearTimeout(timeout);
  }, [composerDockHeight, isLoadingInitialMessages, messages.length]);

  useEffect(() => {
    if (!hasInitialScrollSettledRef.current || hasInitialComposerAlignmentRef.current || composerDockHeight <= 0) {
      return;
    }

    hasInitialComposerAlignmentRef.current = true;
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
      requestAnimationFrame(() => setIsThreadReady(true));
    }, 0);
    return () => clearTimeout(timeout);
  }, [composerDockHeight]);

  useEffect(() => {
    if (!voiceToastMessage) return;

    const timeout = setTimeout(() => setVoiceToastMessage(null), 3400);
    return () => clearTimeout(timeout);
  }, [voiceToastMessage]);

  useEffect(() => {
    if (!isThreadReady) return;
    if (!hasInitialScrollSettledRef.current) return;
    if (keyboardLift <= 0 && voiceState.status === 'idle') return;

    const timeout = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timeout);
  }, [keyboardLift, voiceState.status]);

  useEffect(() => {
    if (!isThreadReady || !hasInitialScrollSettledRef.current) return;

    const first = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 40);
    const second = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 180);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [isThreadReady, latestMessageSignature]);

  function clearComposerState() {
    setComposerText('');
    clearAttachments();
    resetVoice();
  }

  function sendTyped(text: string) {
    if (sendPrompt(text, 'typed', readyAttachmentIds)) {
      analytics.reedMessageSent({
        source: 'typed',
        hasAttachments: readyAttachmentIds.length > 0,
      });
      clearComposerState();
    }
  }

  function sendVoiceDraft(text: string) {
    if (sendPrompt(text, 'voice', readyAttachmentIds)) {
      analytics.reedMessageSent({
        source: 'voice',
        hasAttachments: false,
      });
      clearComposerState();
    }
  }

  if (isViewingCoachItems) {
    return (
      <ReedCoachItemsPage
        contentTopPadding={contentTopPadding}
        dockReservedSpace={dockReservedSpace}
        items={coachItems}
        onBack={() => setIsViewingCoachItems(false)}
        onResolve={resolveCoachItem}
        topInset={headerTopInset}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ReedHeader
        label={reedPresenceLabel}
        onOpenCoachItems={() => setIsViewingCoachItems(true)}
        openItemsCount={openCoachItems.length}
        topInset={headerTopInset}
      />

      <ReedThread
        contentPaddingBottom={scrollBottomSpace}
        contentPaddingTop={contentTopPadding}
        hasMoreMessages={hasMoreMessages}
        messages={messages}
        isReady={isThreadReady}
        onLoadOlderMessages={loadOlderMessages}
        onRetryAssistantMessage={retryAssistantMessage}
        isMessageSaved={isMessageSaved}
        onSaveCoachItem={saveCoachItem}
        scrollRef={scrollRef}
      />

      {voiceToastMessage ? (
        <VoiceToast
          message={voiceToastMessage}
          onDismiss={() => setVoiceToastMessage(null)}
          top={insets.top + theme.spacing.sm}
        />
      ) : null}

      <View
        onLayout={event => {
          const nextHeight = Math.round(event.nativeEvent.layout.height);
          if (nextHeight > 0 && nextHeight !== composerDockHeight) {
            setComposerDockHeight(nextHeight);
          }
        }}
        style={[
          styles.composerDock,
          {
            bottom: keyboardLift,
            paddingBottom: composerBottomPadding,
            paddingHorizontal: theme.spacing.sm,
          },
        ]}
      >
        <ReedComposer
          attachments={attachments}
          canAttachMore={canAttachMore}
          composerText={composerText}
          disabled={Boolean(pendingRunId)}
          isPreparingAttachments={isPreparingAttachments}
          lastAttachmentError={lastAttachmentError}
          onChangeComposerText={setComposerText}
          onPickCamera={() => void attachFromCamera()}
          onPickFiles={() => void attachFromFiles()}
          onPickLibrary={() => void attachFromLibrary()}
          onQuickAction={prompt => {
            if (sendPrompt(prompt, 'quick-action', readyAttachmentIds)) {
              analytics.reedMessageSent({
                source: 'quick-action',
                hasAttachments: readyAttachmentIds.length > 0,
              });
              clearComposerState();
            }
          }}
          onRemoveAttachment={removeAttachment}
          onRetryVoice={() => void retryVoice()}
          onSendTyped={sendTyped}
          onSendVoiceDraft={sendVoiceDraft}
          onStartVoice={() => void startVoice()}
          onStopVoice={() => void stopVoice()}
          quickActions={visibleQuickActions}
          shouldShowQuickActions={shouldShowQuickActions}
          voiceState={voiceState}
        />
      </View>

      <ReedImageEditor
        image={editingImage}
        onCancel={cancelImageEditor}
        onUseImage={uploadEditedImage}
        visible={Boolean(editingImage)}
      />
    </View>
  );
}

function VoiceToast({
  message,
  onDismiss,
  top,
}: {
  message: string;
  onDismiss: () => void;
  top: number;
}) {
  const { theme } = useReedTheme();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.voiceToastContainer,
        {
          paddingHorizontal: theme.spacing.sm,
          top,
        },
      ]}
    >
      <View
        accessibilityRole="alert"
        onTouchEnd={onDismiss}
        style={[
          styles.voiceToast,
          {
            backgroundColor: theme.colors.dangerFill,
            borderColor: theme.colors.dangerBorder,
          },
        ]}
      >
        <ReedText tone="danger" variant="caption">{message}</ReedText>
      </View>
    </View>
  );
}

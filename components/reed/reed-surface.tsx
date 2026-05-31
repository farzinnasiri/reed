import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, View, type ScrollView as ScrollViewType } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReedTheme } from '@/design/provider';
import { ReedAiSettingsPage } from './reed-ai-settings-page';
import { ReedCoachItemsPage } from './reed-coach-items-page';
import { ReedComposer } from './reed-composer';
import { ReedHeader } from './reed-header';
import { createLocalMockReedRuntime } from './reed.runtime';
import { styles } from './reed.styles';
import { ReedThread } from './reed-thread';
import type { ReedSurfaceProps } from './reed.types';
import { useReedAttachments } from './use-reed-attachments';
import { useReedConversation } from './use-reed-conversation';
import { useReedPresence } from './use-reed-presence';
import { useReedVoiceDraft } from './use-reed-voice-draft';

export function ReedSurface({ displayName, dockReservedSpace }: ReedSurfaceProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewType | null>(null);
  const hasInitialScrollSettledRef = useRef(false);
  const hasInitialComposerAlignmentRef = useRef(false);
  const [isViewingAiSettings, setIsViewingAiSettings] = useState(false);
  const [isViewingCoachItems, setIsViewingCoachItems] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [composerDockHeight, setComposerDockHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isThreadReady, setIsThreadReady] = useState(false);
  const {
    attachFromCamera,
    attachFromFiles,
    attachFromLibrary,
    attachments,
    canAttachMore,
    clearAttachments,
    isPreparingAttachments,
    lastError: lastAttachmentError,
    readyAttachmentIds,
    removeAttachment,
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
    saveCoachItem,
    sendPrompt,
  } = useReedConversation({
    displayName,
    markOnline,
    runtime,
    shouldDelayAssistantStart,
  });
  const { resetVoice, startVoice, stopVoice, voiceState } = useReedVoiceDraft(messages);

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

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', event => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
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
    if (!isThreadReady) return;
    if (!hasInitialScrollSettledRef.current) return;
    if (keyboardLift <= 0 && voiceState.status === 'idle') return;

    const timeout = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timeout);
  }, [keyboardLift, voiceState.status]);

  function clearComposerState() {
    setComposerText('');
    clearAttachments();
    resetVoice();
  }

  function sendTyped(text: string) {
    if (sendPrompt(text, 'typed', readyAttachmentIds)) {
      clearComposerState();
    }
  }

  function sendVoiceDraft(text: string) {
    if (sendPrompt(text, 'voice', readyAttachmentIds)) {
      clearComposerState();
    }
  }

  if (isViewingAiSettings) {
    return (
      <ReedAiSettingsPage
        contentTopPadding={contentTopPadding}
        dockReservedSpace={dockReservedSpace}
        onBack={() => setIsViewingAiSettings(false)}
        topInset={headerTopInset}
      />
    );
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
        onOpenAiSettings={() => setIsViewingAiSettings(true)}
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
        isMessageSaved={isMessageSaved}
        onSaveCoachItem={saveCoachItem}
        scrollRef={scrollRef}
      />

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
              clearComposerState();
            }
          }}
          onRemoveAttachment={removeAttachment}
          onSendTyped={sendTyped}
          onSendVoiceDraft={sendVoiceDraft}
          onStartVoice={() => startVoice(Boolean(pendingRunId))}
          onStopVoice={() => {
            const nextText = stopVoice(composerText);
            if (nextText !== composerText) {
              setComposerText(nextText);
            }
          }}
          quickActions={visibleQuickActions}
          shouldShowQuickActions={shouldShowQuickActions}
          voiceState={voiceState}
        />
      </View>
    </View>
  );
}

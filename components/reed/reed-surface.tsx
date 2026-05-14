import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, View, type ScrollView as ScrollViewType } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReedTheme } from '@/design/provider';
import { ReedCoachItemsPage } from './reed-coach-items-page';
import { ReedComposer } from './reed-composer';
import { ReedHeader } from './reed-header';
import { createLocalMockReedRuntime } from './reed.runtime';
import { styles } from './reed.styles';
import { ReedThread } from './reed-thread';
import type { ReedSurfaceProps } from './reed.types';
import { useReedConversation } from './use-reed-conversation';
import { useReedPresence } from './use-reed-presence';
import { useReedVoiceDraft } from './use-reed-voice-draft';

export function ReedSurface({ displayName, dockReservedSpace }: ReedSurfaceProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewType | null>(null);
  const [isViewingCoachItems, setIsViewingCoachItems] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [composerDockHeight, setComposerDockHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const runtime = useMemo(() => createLocalMockReedRuntime(), []);
  const presence = useQuery(api.reed.getPresence, {});
  const { isOnline: isReedOnline, label: reedPresenceLabel, markOnline, shouldDelayAssistantStart } = useReedPresence(presence?.lastMessageAt ?? null);
  const {
    coachItems,
    hasMoreMessages,
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
  const shouldShowQuickActions = !isReedOnline && voiceState.status === 'idle';
  const headerTopInset = insets.top + theme.spacing.sm;
  const contentTopPadding = headerTopInset + 44 + theme.spacing.lg;
  const keyboardLift = Platform.OS === 'android' ? Math.max(0, keyboardHeight - insets.bottom) : 0;
  const composerBottomPadding = keyboardLift > 0 ? theme.spacing.xs : dockReservedSpace + theme.spacing.xs;
  const scrollBottomSpace = composerDockHeight > 0
    ? composerBottomPadding + keyboardLift + composerDockHeight + theme.spacing.lg
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
    const timeout = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timeout);
  }, [keyboardLift, messages, openCoachItems.length, voiceState.status]);

  function clearComposerState() {
    setComposerText('');
    resetVoice();
  }

  function sendTyped(text: string) {
    if (sendPrompt(text, 'typed')) {
      clearComposerState();
    }
  }

  function sendVoiceDraft(text: string) {
    if (sendPrompt(text, 'voice')) {
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
          composerText={composerText}
          disabled={Boolean(pendingRunId)}
          onChangeComposerText={setComposerText}
          onQuickAction={prompt => {
            if (sendPrompt(prompt, 'quick-action')) {
              clearComposerState();
            }
          }}
          onSendTyped={sendTyped}
          onSendVoiceDraft={sendVoiceDraft}
          onStartVoice={() => startVoice(Boolean(pendingRunId))}
          onStopVoice={() => {
            const nextText = stopVoice(composerText);
            if (nextText !== composerText) {
              setComposerText(nextText);
            }
          }}
          shouldShowQuickActions={shouldShowQuickActions}
          voiceState={voiceState}
        />
      </View>
    </View>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, type ScrollView as ScrollViewType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReedTheme } from '@/design/provider';
import { ReedCoachItemsPage } from './reed-coach-items-page';
import { ReedComposer } from './reed-composer';
import { ReedHeader } from './reed-header';
import { summarizeReplyQuote } from './reed.presenter';
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

  const runtime = useMemo(() => createLocalMockReedRuntime(), []);
  const { label: reedPresenceLabel, markOnline, shouldDelayAssistantStart } = useReedPresence();
  const {
    coachItems,
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
  const hasUserMessage = useMemo(
    () => messages.some(message => message.role === 'user'),
    [messages],
  );

  const shouldShowQuickActions = !hasUserMessage && voiceState.status === 'idle';
  const headerTopInset = insets.top + theme.spacing.sm;
  const contentTopPadding = headerTopInset + 44 + theme.spacing.lg;
  const scrollBottomSpace = composerDockHeight > 0
    ? dockReservedSpace + composerDockHeight + theme.spacing.lg
    : dockReservedSpace + theme.spacing.xxxl;

  useEffect(() => {
    const timeout = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timeout);
  }, [messages, openCoachItems.length, voiceState.status]);

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

  function handleReplyToMessage(messageText: string) {
    const quote = summarizeReplyQuote(messageText);
    resetVoice();
    setComposerText(quote ? `About “${quote}”: ` : 'About that: ');
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
        messages={messages}
        onReplyToMessage={message => handleReplyToMessage(message.text)}
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
          { paddingBottom: dockReservedSpace + theme.spacing.xs, paddingHorizontal: theme.spacing.sm },
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

'use client';

import { useQuery } from 'convex/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent } from 'react';
import { api } from '@/lib/api';
import { LoopMark } from './loop-mark';
import { ChatIcon } from './reed-chat/chat-icon';
import { ReedChatComposer } from './reed-chat/reed-chat-composer';
import { ReedChatThread } from './reed-chat/reed-chat-thread';
import type { QuickAction } from './reed-chat/reed-chat-types';
import { useReedAttachments } from './reed-chat/use-reed-attachments';
import { useReedConversation } from './reed-chat/use-reed-conversation';
import { useReedPresence } from './reed-chat/use-reed-presence';
import { useReedVoice } from './reed-chat/use-reed-voice';

type Presence = { lastMessageAt: number | null };

export function ReedChat() {
  const presenceResult = useQuery(api.reed.getPresence, {}) as Presence | undefined;
  const quickActions = useQuery(api.reed.listQuickActions, {}) as QuickAction[] | undefined;
  const {
    clearSendError,
    hasMoreMessages,
    isLoadingInitialMessages,
    isLoadingOlderMessages,
    loadOlderMessages,
    messages,
    pendingRunId,
    retryAssistantMessage,
    sendError,
    sendPrompt,
  } = useReedConversation();
  const {
    attachments,
    canAttachMore,
    clearAttachments,
    isPreparing,
    lastError: attachmentError,
    prepareFiles,
    readyAttachments,
    removeAttachment,
  } = useReedAttachments();
  const { isOnline, label: presenceLabel, markOnline } = useReedPresence(presenceResult?.lastMessageAt ?? null);
  const [draft, setDraft] = useState('');
  const [draftSource, setDraftSource] = useState<'typed' | 'voice'>('typed');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldFollowLatestRef = useRef(true);
  const initialScrollCompleteRef = useRef(false);
  const preservedScrollRef = useRef<{ height: number; top: number } | null>(null);

  const handleVoiceText = useCallback((text: string) => {
    setDraft(current => current.trim() ? `${current.trimEnd()} ${text}` : text);
    setDraftSource('voice');
  }, []);
  const voice = useReedVoice(handleVoiceText);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || isLoadingInitialMessages) return;

    if (preservedScrollRef.current && !isLoadingOlderMessages) {
      const previous = preservedScrollRef.current;
      preservedScrollRef.current = null;
      scroller.scrollTop = previous.top + scroller.scrollHeight - previous.height;
      return;
    }

    if (!initialScrollCompleteRef.current) {
      initialScrollCompleteRef.current = true;
      scroller.scrollTop = scroller.scrollHeight;
      return;
    }

    if (shouldFollowLatestRef.current) {
      scroller.scrollTo({ behavior: 'smooth', top: scroller.scrollHeight });
    }
  }, [isLoadingInitialMessages, isLoadingOlderMessages, messages]);

  useEffect(() => {
    if (pendingRunId) markOnline();
  }, [markOnline, pendingRunId]);

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const scroller = event.currentTarget;
    const distanceFromBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    shouldFollowLatestRef.current = distanceFromBottom < 180;
    setShowScrollToBottom(distanceFromBottom > 260);

    if (scroller.scrollTop < 100 && hasMoreMessages && !isLoadingOlderMessages) handleLoadOlder();
  }

  function handleLoadOlder() {
    const scroller = scrollRef.current;
    if (!scroller || !hasMoreMessages || isLoadingOlderMessages) return;
    preservedScrollRef.current = { height: scroller.scrollHeight, top: scroller.scrollTop };
    loadOlderMessages();
  }

  function scrollToBottom() {
    shouldFollowLatestRef.current = true;
    scrollRef.current?.scrollTo({ behavior: 'smooth', top: scrollRef.current.scrollHeight });
    setShowScrollToBottom(false);
  }

  async function sendCurrentDraft() {
    const sent = await sendPrompt(draft, draftSource, readyAttachments);
    if (!sent) return;
    setDraft('');
    setDraftSource('typed');
    clearAttachments();
    voice.reset();
    markOnline();
    shouldFollowLatestRef.current = true;
  }

  async function sendQuickAction(prompt: string) {
    const sent = await sendPrompt(prompt, 'quick-action', readyAttachments);
    if (!sent) return;
    setDraft('');
    setDraftSource('typed');
    clearAttachments();
    voice.reset();
    markOnline();
    shouldFollowLatestRef.current = true;
  }

  return (
    <section className="reed-chat-page">
      <header className="reed-chat-header">
        <div className="reed-chat-identity">
          <span className="reed-chat-avatar">R</span>
          <div><strong>Reed</strong><span><i className={isOnline ? 'online' : undefined} />{presenceLabel}</span></div>
        </div>
        <div className="reed-chat-header-mark">
          <LoopMark expression={pendingRunId ? 'thinking' : 'idle'} size="small" />
        </div>
      </header>

      <div className="reed-chat-body">
        <ReedChatThread
          hasMoreMessages={hasMoreMessages}
          isLoadingInitialMessages={isLoadingInitialMessages}
          isLoadingOlderMessages={isLoadingOlderMessages}
          messages={messages}
          onLoadOlderMessages={handleLoadOlder}
          onRetryAssistantMessage={message => {
            markOnline();
            void retryAssistantMessage(message);
          }}
          onScroll={handleScroll}
          scrollRef={scrollRef}
        />

        {showScrollToBottom ? (
          <button aria-label="Scroll to latest message" className="reed-scroll-to-bottom" onClick={scrollToBottom} type="button">
            <ChatIcon name="arrow-down" />
          </button>
        ) : null}

        <ReedChatComposer
          attachments={attachments}
          canAttachMore={canAttachMore}
          disabled={Boolean(pendingRunId)}
          draft={draft}
          error={sendError ?? attachmentError}
          isPreparingAttachments={isPreparing}
          onChangeDraft={value => {
            setDraft(value);
            setDraftSource('typed');
            clearSendError();
          }}
          onFiles={prepareFiles}
          onQuickAction={prompt => void sendQuickAction(prompt)}
          onRemoveAttachment={removeAttachment}
          onRetryVoice={voice.retry}
          onSend={() => void sendCurrentDraft()}
          onStartVoice={voice.start}
          onStopVoice={voice.stop}
          quickActions={quickActions ?? []}
          showQuickActions={!isOnline && voice.state.status === 'idle'}
          voiceState={voice.state}
        />
      </div>
    </section>
  );
}

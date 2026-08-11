'use client';

import { useMutation, usePaginatedQuery } from 'convex/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { ChatMessage, ComposerSource, ServerMessage } from './reed-chat-types';

const INITIAL_MESSAGE_LIMIT = 20;
const MESSAGE_PAGE_SIZE = 30;
const AGENT_THINKING_PRELUDE_DELAY_MS = 820;

type PageStatus = 'CanLoadMore' | 'Exhausted' | 'LoadingFirstPage' | 'LoadingMore';

type PaginatedMessages = {
  loadMore: (count: number) => void;
  results: ServerMessage[];
  status: PageStatus;
};

function renderMessageId(message: ServerMessage, lastUserNonce: string | null) {
  if (message.role === 'user' && message.clientNonce) return `optimistic-user-${message.clientNonce}`;
  if (message.role === 'assistant' && lastUserNonce) return `optimistic-assistant-${lastUserNonce}`;
  return message._id;
}

function mapMessages(messages: ServerMessage[]) {
  let lastUserNonce: string | null = null;

  return messages.map<ChatMessage>(message => {
    if (message.role === 'user') lastUserNonce = message.clientNonce ?? null;
    const id = renderMessageId(message, lastUserNonce);
    if (message.role === 'assistant') lastUserNonce = null;

    const isAgentThinkingMessage = message.source === 'system'
      && message.role === 'assistant'
      && message.status === 'sent'
      && Boolean(message.content.trim());

    return {
      attachments: message.attachments?.map(attachment => ({
        id: attachment._id,
        status: attachment.status,
        url: attachment.url,
      })) ?? [],
      createdAt: message.createdAt,
      id,
      isAgentThinkingMessage,
      role: message.role,
      serverId: message._id,
      source: message.source === 'quick-action' || message.source === 'voice' ? message.source : 'typed',
      status: message.status,
      text: message.content || (message.status === 'pending' ? '' : message.error ?? ''),
    };
  });
}

export function useReedConversation() {
  const page = usePaginatedQuery(
    api.reed.listMessagesPaginated,
    {},
    { initialNumItems: INITIAL_MESSAGE_LIMIT },
  ) as PaginatedMessages;
  const sendMessage = useMutation(api.reed.sendMessage);
  const retryMessage = useMutation(api.reed.retryAssistantMessage);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [revealedPreludeIds, setRevealedPreludeIds] = useState<Set<string>>(() => new Set());
  const [mountedAt] = useState(() => Date.now());
  const revealTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const serverMessages = useMemo(
    () => page.status === 'LoadingFirstPage' ? [] : [...page.results].reverse(),
    [page.results, page.status],
  );
  const persistedMessages = useMemo(() => mapMessages(serverMessages), [serverMessages]);
  const messages = useMemo(() => {
    const visibleOptimistic = optimisticMessages.filter(message => {
      const nonce = message.id.replace(/^optimistic-(user|assistant)-/, '');
      const serverUser = serverMessages.find(serverMessage => serverMessage.clientNonce === nonce);
      if (message.role === 'user') return !serverUser;

      return !serverUser || !serverMessages.some(serverMessage =>
        serverMessage.role === 'assistant' && serverMessage.createdAt >= message.createdAt,
      );
    });

    return persistedMessages.concat(visibleOptimistic).sort((left, right) => left.createdAt - right.createdAt);
  }, [optimisticMessages, persistedMessages, serverMessages]);

  const pendingRunId = useMemo(
    () => messages.find(message => message.role === 'assistant' && message.status === 'pending')?.id ?? null,
    [messages],
  );

  useEffect(() => {
    const now = Date.now();
    for (const message of messages) {
      if (!message.isAgentThinkingMessage || revealedPreludeIds.has(message.id)) continue;
      if (now - message.createdAt >= 15_000) continue;
      if (revealTimersRef.current[message.id]) continue;

      revealTimersRef.current[message.id] = setTimeout(() => {
        setRevealedPreludeIds(current => new Set(current).add(message.id));
        delete revealTimersRef.current[message.id];
      }, AGENT_THINKING_PRELUDE_DELAY_MS);
    }

    const liveIds = new Set(messages.map(message => message.id));
    for (const [id, timer] of Object.entries(revealTimersRef.current)) {
      if (!liveIds.has(id)) {
        clearTimeout(timer);
        delete revealTimersRef.current[id];
      }
    }
  }, [messages, revealedPreludeIds]);

  useEffect(() => () => {
    Object.values(revealTimersRef.current).forEach(clearTimeout);
    revealTimersRef.current = {};
  }, []);

  const visibleMessages = useMemo(() => {
    const result: ChatMessage[] = [];
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      const isRecentPrelude = message.isAgentThinkingMessage && mountedAt - message.createdAt < 15_000;
      if (isRecentPrelude && !revealedPreludeIds.has(message.id)) {
        result.push({ ...message, status: 'pending', text: '' });
        const next = messages[index + 1];
        if (next?.role === 'assistant' && next.status === 'pending') index += 1;
        continue;
      }
      result.push(message);
    }
    return result;
  }, [messages, mountedAt, revealedPreludeIds]);

  const sendPrompt = useCallback(async (
    prompt: string,
    source: ComposerSource,
    attachments: Array<{ storageId: string }> = [],
  ) => {
    const text = prompt.trim();
    if ((!text && attachments.length === 0) || pendingRunId) return false;

    const createdAt = Date.now();
    const nonce = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${createdAt}-${Math.random().toString(36).slice(2)}`;
    const optimisticIds = new Set([`optimistic-user-${nonce}`, `optimistic-assistant-${nonce}`]);
    setSendError(null);
    setOptimisticMessages(current => current.concat(
      {
        attachments: [],
        createdAt,
        id: `optimistic-user-${nonce}`,
        isAgentThinkingMessage: false,
        role: 'user',
        source,
        status: 'sent',
        text: attachments.length > 0
          ? `${text || 'Attached images'}\n${attachments.length} image${attachments.length === 1 ? '' : 's'}`
          : text,
      },
      {
        attachments: [],
        createdAt: createdAt + 1,
        id: `optimistic-assistant-${nonce}`,
        isAgentThinkingMessage: false,
        role: 'assistant',
        source: 'typed',
        status: 'pending',
        text: '',
      },
    ));

    try {
      await sendMessage({
        attachments: attachments.length ? attachments : undefined,
        clientNonce: nonce,
        clientNow: createdAt,
        clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        content: text,
        source,
      });
      setOptimisticMessages(current => current.filter(message => !optimisticIds.has(message.id)));
      return true;
    } catch (error) {
      setOptimisticMessages(current => current.filter(message => !optimisticIds.has(message.id)));
      setSendError(error instanceof Error ? error.message : 'Could not send this message.');
      return false;
    }
  }, [pendingRunId, sendMessage]);

  const retryAssistantMessage = useCallback(async (message: ChatMessage) => {
    if (message.role !== 'assistant' || message.status !== 'failed' || !message.serverId || pendingRunId) return;
    setSendError(null);
    try {
      await retryMessage({
        assistantMessageId: message.serverId,
        clientNow: Date.now(),
        clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not retry this response.');
    }
  }, [pendingRunId, retryMessage]);

  return {
    clearSendError: () => setSendError(null),
    hasMoreMessages: page.status === 'CanLoadMore',
    isLoadingInitialMessages: page.status === 'LoadingFirstPage',
    isLoadingOlderMessages: page.status === 'LoadingMore',
    loadOlderMessages: () => {
      if (page.status === 'CanLoadMore') page.loadMore(MESSAGE_PAGE_SIZE);
    },
    messages: visibleMessages,
    pendingRunId,
    retryAssistantMessage,
    sendError,
    sendPrompt,
  };
}

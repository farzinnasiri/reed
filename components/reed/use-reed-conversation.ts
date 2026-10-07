import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConvexConnectionState, useMutation, useQuery } from 'convex/react';
import * as haptics from '@/design/haptics';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { startClientWideEvent } from '@/lib/client-observability';
import { isThinkingPrelude } from '@/domains/reed/message-semantics';
import { useFiveMinuteNow } from '@/components/home/use-five-minute-now';
import type { ReedMessageContext } from '@/convex/reedSessionContext';
import type { ComposerSource, ReedMessage } from './reed.types';

import { useReedHistory, type ServerReedMessage } from './use-reed-history';

function getRenderMessageId(message: ServerReedMessage, lastUserNonce: string | null) {
  if (message.role === 'user' && message.clientNonce) return `optimistic-user-${message.clientNonce}`;
  if (message.role === 'assistant' && lastUserNonce) return `optimistic-assistant-${lastUserNonce}`;
  return message._id;
}

export function useReedConversation() {
  const globalSettings = useQuery(api.aiSettings.get, {});
  const now = useFiveMinuteNow();
  const presence = useQuery(api.reed.getPresence, { now });
  const history = useReedHistory(presence);
  const { fetchedMessages } = history;
  const effectiveFetchedMessages = fetchedMessages;
  const sendReedMessage = useMutation(api.reed.sendMessage);
  const retryReedAssistantMessage = useMutation(api.reed.retryAssistantMessage);
  const [optimisticMessages, setOptimisticMessages] = useState<ReedMessage[]>([]);
  const [pendingSendNonce, setPendingSendNonce] = useState<string | null>(null);
  const connection = useConvexConnectionState();
  const pendingRef = useRef<string | null>(null);
  const attempts = useRef(new Map<string, { text: string; source: ComposerSource; attachments: Array<{ storageId: Id<'_storage'> }>; createdAt: number; context?: ReedMessageContext }>());


  const persistedMessages = useMemo<ReedMessage[]>(() => {
    if (!effectiveFetchedMessages) return [];

    let lastUserNonce: string | null = null;
    return effectiveFetchedMessages.filter(message => !(isThinkingPrelude(message))).map((message: ServerReedMessage) => {
      if (message.role === 'user') {
        lastUserNonce = message.clientNonce ?? null;
      }
      const renderId = getRenderMessageId(message, lastUserNonce);
      if (message.role === 'assistant') {
        lastUserNonce = null;
      }

      const rawSource = message.source;
      // Real replies are also stored as `system` (created pending, completed later). Only the prelude
      // is inserted already sent, so it is the one whose completion time equals its creation time.
      const isAgentThinkingMessage = isThinkingPrelude(message);

      return {
        createdAt: message.createdAt,
        chapterId: message.chapterId,
        attachments: message.attachments?.map(attachment => ({
          id: attachment._id,
          mediaType: attachment.mediaType,
          status: attachment.status,
          url: attachment.url,
        })),
        id: renderId,
        isAgentThinkingMessage,
        isCoachNote: rawSource === 'background_coach',
        relatedSession: message.relatedSession ?? null,
        replies: message.replies,
        replyRecovery: message.replyRecovery,
        role: message.role,
        reaction: message.reaction,
        serverId: message._id,
        source: rawSource === 'system' || rawSource === 'background_coach' ? 'typed' : (rawSource as ComposerSource),
        status: message.status,
        text: message.content || (message.status === 'pending' ? '' : message.error ?? ''),
        widget: message.widget,
      };
    });
  }, [effectiveFetchedMessages]);

  const messages = useMemo(() => {
    if (history.isLoadingInitialMessages) return optimisticMessages;
    if (!effectiveFetchedMessages) return persistedMessages;

    const visibleOptimistic = optimisticMessages.filter(message => {
      const nonce = message.id.replace(/^optimistic-(user|assistant)-/, '');
      const serverUserExists = effectiveFetchedMessages.some((serverMessage: ServerReedMessage) => serverMessage.clientNonce === nonce);
      if (message.role === 'user') return !serverUserExists;

      const serverAssistantExists = serverUserExists && effectiveFetchedMessages.some((serverMessage: ServerReedMessage) =>
        serverMessage.role === 'assistant' && serverMessage.createdAt >= message.createdAt,
      );
      return !serverAssistantExists;
    });

    return persistedMessages.concat(visibleOptimistic).sort((left, right) => left.createdAt - right.createdAt);
  }, [effectiveFetchedMessages, history.isLoadingInitialMessages, optimisticMessages, persistedMessages]);

  const pendingRunId = useMemo(() => {
    const pending = messages.find(message => message.role === 'assistant' && message.status === 'pending');
    const acknowledged = pendingSendNonce && fetchedMessages?.some(row => row.clientNonce === pendingSendNonce);
    return pending?.id ?? (acknowledged ? null : pendingSendNonce);
  }, [fetchedMessages, messages, pendingSendNonce]);
  useEffect(() => { pendingRef.current = pendingRunId; }, [pendingRunId]);

  const [previousFetchedMessages, setPreviousFetchedMessages] = useState(fetchedMessages);
  if (previousFetchedMessages !== fetchedMessages) {
    setPreviousFetchedMessages(fetchedMessages);
    const acknowledged = new Set(fetchedMessages?.flatMap(row => row.clientNonce ? [row.clientNonce] : []) ?? []);
    if (pendingSendNonce && acknowledged.has(pendingSendNonce)) setPendingSendNonce(null);
    const remaining = optimisticMessages.filter(row => !acknowledged.has(row.id.replace(/^optimistic-(user|assistant)-/, '')));
    if (remaining.length !== optimisticMessages.length) setOptimisticMessages(remaining);
  }

  const submitAttempt = useCallback((nonce: string) => {
    const attempt = attempts.current.get(nonce);
    if (!attempt) return;
    pendingRef.current = nonce;
    setPendingSendNonce(nonce);
    setOptimisticMessages(current => current.filter(message => message.id !== `optimistic-assistant-${nonce}`).map(message => message.id === `optimistic-user-${nonce}` ? { ...message, status: 'pending' as const } : message).concat({
      createdAt: attempt.createdAt + 1, id: `optimistic-assistant-${nonce}`, role: 'assistant', source: 'typed', status: 'pending', text: '',
    }));
    const event = startClientWideEvent('reed.message_send', {
      'attachment.count': attempt.attachments.length, 'message.has_attachments': attempt.attachments.length > 0,
      'message.has_text': attempt.text.length > 0, 'message.source': attempt.source, 'screen.name': 'reed', 'send.step': 'convex_mutation',
    });
    void sendReedMessage({
      clientNonce: nonce, clientNow: Date.now(), clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      content: attempt.text, attachments: attempt.attachments, source: attempt.source, ...(attempt.context ? { context: attempt.context } : {}),
    }).then(() => {
      event.end({ 'send.step': 'saved' });
      attempts.current.delete(nonce);
    }).catch(error => {
      event.fail(error, 'reed-message-send-convex-mutation-failed', { 'send.step': 'failed' });
      if (pendingRef.current === nonce) pendingRef.current = null;
      setPendingSendNonce(current => current === nonce ? null : current);
      setOptimisticMessages(current => current.filter(message => message.id !== `optimistic-assistant-${nonce}`).map(message => message.id === `optimistic-user-${nonce}` ? { ...message, status: 'failed' as const } : message));
      haptics.warning();
    });
  }, [sendReedMessage]);

  const sendPrompt = useCallback((prompt: string, source: ComposerSource, attachments: Array<{ storageId: Id<'_storage'> }> = [], context?: ReedMessageContext) => {
    const text = prompt.trim();
    if ((!text && attachments.length === 0) || pendingRef.current) return false;
    const now = Date.now();
    const nonce = `${now}-${Math.random().toString(36).slice(2)}`;
    attempts.current.set(nonce, { text, source, attachments, createdAt: now, context });
    setOptimisticMessages(current => current.concat({
      createdAt: now, id: `optimistic-user-${nonce}`, role: 'user', source, status: 'pending',
      text: text || `Attached ${attachments.length} image${attachments.length === 1 ? '' : 's'}`,
    }));
    submitAttempt(nonce);
    return `optimistic-user-${nonce}`;
  }, [submitAttempt]);

  const retryUserMessage = useCallback((message: ReedMessage) => {
    if (message.role !== 'user' || message.status !== 'failed' || pendingRef.current) return;
    submitAttempt(message.id.replace(/^optimistic-user-/, ''));
  }, [submitAttempt]);

  const retryAssistantMessage = useCallback((message: ReedMessage) => {
    if (message.role !== 'assistant' || message.status !== 'failed' || !message.serverId || pendingRunId) return;
    void retryReedAssistantMessage({
      assistantMessageId: message.serverId as Id<'reedMessages'>,
      clientNow: Date.now(),
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).catch(error => {
      const operation = startClientWideEvent('reed.retry');
      operation.fail(error, 'reed-assistant-retry-failed');
      haptics.warning();
    });
  }, [pendingRunId, retryReedAssistantMessage]);

  return {
    ...history,
    globalSettings,
    presence,
    messages,
    isOffline: !connection.isWebSocketConnected,
    hasSendError: messages.at(-1)?.status === 'failed' || optimisticMessages.some(message => message.role === 'user' && message.status === 'failed'),
    retryUserMessage,
    pendingRunId,
    sendPrompt,
    retryAssistantMessage,
  };
}

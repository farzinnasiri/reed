import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { summarizeCoachItemTitle } from './reed.presenter';
import type { CoachItem, ComposerSource, ReedMessage } from './reed.types';

const INITIAL_MESSAGE_LIMIT = 40;
const MESSAGE_PAGE_SIZE = 30;
const COACH_ITEMS_STORAGE_KEY = 'reed.coachItems.v1';

type ServerReedMessage = {
  _id: string;
  clientNonce?: string;
  content: string;
  createdAt: number;
  error?: string;
  role: 'assistant' | 'user';
  source: 'quick-action' | 'typed' | 'voice' | 'system';
  status: 'failed' | 'pending' | 'sent';
};

function getRenderMessageId(message: ServerReedMessage, lastUserNonce: string | null) {
  if (message.role === 'user' && message.clientNonce) return `optimistic-user-${message.clientNonce}`;
  if (message.role === 'assistant' && lastUserNonce) return `optimistic-assistant-${lastUserNonce}`;
  return message._id;
}

const INITIAL_COACH_ITEMS: CoachItem[] = [
  {
    body: 'Revisit after two lower-body sessions.',
    id: 'coach-item-1',
    status: 'open',
    title: 'Lower-body recovery',
    type: 'check_in',
  },
];

export function useReedConversation({
  markOnline,
}: {
  displayName: string;
  markOnline: () => void;
  runtime: unknown;
  shouldDelayAssistantStart: () => boolean;
}) {
  const [messageLimit, setMessageLimit] = useState(INITIAL_MESSAGE_LIMIT);
  const fetchedMessagesPage = useQuery(api.reed.listMessages, { limit: messageLimit });
  const fetchedMessages: ServerReedMessage[] | undefined = Array.isArray(fetchedMessagesPage)
    ? fetchedMessagesPage as ServerReedMessage[]
    : fetchedMessagesPage?.messages as ServerReedMessage[] | undefined;
  const fetchedHasMore = Array.isArray(fetchedMessagesPage)
    ? fetchedMessagesPage.length >= messageLimit
    : Boolean(fetchedMessagesPage?.hasMore);
  const sendReedMessage = useMutation(api.reed.sendMessage);
  const [coachItems, setCoachItems] = useState<CoachItem[]>(INITIAL_COACH_ITEMS);
  const [hasLoadedCoachItems, setHasLoadedCoachItems] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ReedMessage[]>([]);
  const [pendingSendNonce, setPendingSendNonce] = useState<string | null>(null);
  const lastSeenAssistantMessageIdRef = useRef<string | null>(null);

  const persistedMessages = useMemo<ReedMessage[]>(() => {
    if (!fetchedMessages) return [];

    let lastUserNonce: string | null = null;
    return fetchedMessages.map((message: ServerReedMessage) => {
      if (message.role === 'user') {
        lastUserNonce = message.clientNonce ?? null;
      }

      return {
        createdAt: message.createdAt,
        id: getRenderMessageId(message, lastUserNonce),
        role: message.role,
        source: message.source === 'system' ? 'typed' : message.source,
        status: message.status === 'failed' ? 'sent' : message.status,
        text: message.content || (message.status === 'pending' ? '' : message.error ?? ''),
      };
    });
  }, [fetchedMessages]);

  const messages = useMemo(() => {
    if (fetchedMessagesPage === undefined) return optimisticMessages;
    if (!fetchedMessages) return persistedMessages;

    const visibleOptimistic = optimisticMessages.filter(message => {
      const nonce = message.id.replace(/^optimistic-(user|assistant)-/, '');
      const serverUserExists = fetchedMessages.some((serverMessage: ServerReedMessage) => serverMessage.clientNonce === nonce);
      if (message.role === 'user') return !serverUserExists;

      const serverAssistantExists = serverUserExists && fetchedMessages.some((serverMessage: ServerReedMessage) =>
        serverMessage.role === 'assistant' && serverMessage.createdAt >= message.createdAt,
      );
      return !serverAssistantExists;
    });

    return persistedMessages.concat(visibleOptimistic).sort((left, right) => left.createdAt - right.createdAt);
  }, [fetchedMessages, fetchedMessagesPage, optimisticMessages, persistedMessages]);

  const pendingRunId = useMemo(() => {
    const pending = messages.find(message => message.role === 'assistant' && message.status === 'pending');
    return pending?.id ?? pendingSendNonce;
  }, [messages, pendingSendNonce]);

  useEffect(() => {
    let isMounted = true;

    void AsyncStorage.getItem(COACH_ITEMS_STORAGE_KEY)
      .then(value => {
        if (!isMounted) return;
        if (!value) {
          setHasLoadedCoachItems(true);
          return;
        }
        const parsed = JSON.parse(value) as CoachItem[];
        setCoachItems(Array.isArray(parsed) ? parsed : INITIAL_COACH_ITEMS);
        setHasLoadedCoachItems(true);
      })
      .catch(() => {
        if (isMounted) setHasLoadedCoachItems(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedCoachItems) return;
    void AsyncStorage.setItem(COACH_ITEMS_STORAGE_KEY, JSON.stringify(coachItems));
  }, [coachItems, hasLoadedCoachItems]);

  useEffect(() => {
    const latest = messages.at(-1);
    if (latest?.role !== 'assistant' || latest.status !== 'sent') return;
    if (lastSeenAssistantMessageIdRef.current === latest.id) return;

    lastSeenAssistantMessageIdRef.current = latest.id;
    markOnline();
    setPendingSendNonce(current => (current === null ? current : null));
    setOptimisticMessages(current => (current.length === 0 ? current : []));
  }, [markOnline, messages]);

  const hasMoreMessages = fetchedHasMore;
  const loadOlderMessages = useCallback(() => {
    if (!hasMoreMessages) return;
    setMessageLimit(current => Math.min(current + MESSAGE_PAGE_SIZE, 200));
  }, [hasMoreMessages]);

  const sendPrompt = useCallback((prompt: string, source: ComposerSource) => {
    const text = prompt.trim();
    if (!text || pendingRunId) return false;

    const now = Date.now();
    const nonce = `${now}-${Math.random().toString(36).slice(2)}`;
    setPendingSendNonce(nonce);
    setOptimisticMessages(current => current.concat(
      {
        createdAt: now,
        id: `optimistic-user-${nonce}`,
        role: 'user',
        source,
        status: 'sent',
        text,
      },
      {
        createdAt: now + 1,
        id: `optimistic-assistant-${nonce}`,
        role: 'assistant',
        source: 'typed',
        status: 'pending',
        text: '',
      },
    ));
    markOnline();

    void sendReedMessage({ clientNonce: nonce, content: text, source })
      .then(() => {
        markOnline();
      })
      .catch(() => {
        setPendingSendNonce(current => (current === nonce ? null : current));
        setOptimisticMessages(current => current.concat({
          createdAt: Date.now(),
          id: `error-${nonce}`,
          role: 'assistant',
          source: 'typed',
          status: 'sent',
          text: 'I could not send that. Check your connection and try again.',
        }));
      });

    return true;
  }, [markOnline, pendingRunId, sendReedMessage]);

  const saveCoachItem = useCallback((message: ReedMessage) => {
    if (!message.text.trim()) return;
    const title = summarizeCoachItemTitle(message.text);
    setCoachItems(current => current.some(item => item.sourceMessageId === message.id || item.title === title)
      ? current
      : [{ body: message.text, id: `coach-item-${Date.now()}`, sourceMessageId: message.id, status: 'open', title, type: 'focus' }, ...current]);
  }, []);

  const isMessageSaved = useCallback((message: ReedMessage) => {
    if (!message.text.trim()) return false;
    const title = summarizeCoachItemTitle(message.text);
    return coachItems.some(item => item.sourceMessageId === message.id || item.title === title);
  }, [coachItems]);

  const resolveCoachItem = useCallback((itemId: string) => {
    setCoachItems(current => current.map(item => (item.id === itemId ? { ...item, status: 'resolved' } : item)));
  }, []);

  return {
    coachItems,
    hasMoreMessages,
    isMessageSaved,
    loadOlderMessages,
    messages,
    pendingRunId,
    resolveCoachItem,
    saveCoachItem,
    sendPrompt,
  };
}

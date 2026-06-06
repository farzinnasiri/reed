import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { summarizeCoachItemTitle } from './reed.presenter';
import type { CoachItem, ComposerSource, ReedMessage } from './reed.types';

const INITIAL_MESSAGE_LIMIT = 20;
const MESSAGE_PAGE_SIZE = 30;
const COACH_ITEMS_STORAGE_KEY = 'reed.coachItems.v1';
const RECENT_MESSAGES_STORAGE_KEY = 'reed.recentMessages.v1';
const RECENT_MESSAGES_CACHE_LIMIT = INITIAL_MESSAGE_LIMIT;

type ServerReedMessage = {
  _id: string;
  attachments?: Array<{
    _id: string;
    mediaType: 'image/jpeg';
    sortOrder: number;
    status: 'pending' | 'analyzed' | 'failed';
    url: string;
  }>;
  clientNonce?: string;
  completedAt?: number;
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
  const messagesPage = usePaginatedQuery(
    api.reed.listMessagesPaginated,
    {},
    { initialNumItems: INITIAL_MESSAGE_LIMIT },
  );
  const [cachedMessages, setCachedMessages] = useState<ServerReedMessage[] | null>(null);
  const fetchedMessages = messagesPage.status === 'LoadingFirstPage'
    ? undefined
    : ([...messagesPage.results].reverse() as ServerReedMessage[]);
  const fetchedMessagesCacheKey = fetchedMessages
    ? fetchedMessages.map(message => `${message._id}:${message.status}:${message.completedAt ?? ''}`).join('|')
    : '';
  const effectiveFetchedMessages = fetchedMessages ?? cachedMessages ?? undefined;
  const fetchedHasMore = messagesPage.status === 'CanLoadMore';
  const sendReedMessage = useMutation(api.reed.sendMessage);
  const retryReedAssistantMessage = useMutation(api.reed.retryAssistantMessage);
  const [coachItems, setCoachItems] = useState<CoachItem[]>(INITIAL_COACH_ITEMS);
  const [hasLoadedCoachItems, setHasLoadedCoachItems] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ReedMessage[]>([]);
  const [pendingSendNonce, setPendingSendNonce] = useState<string | null>(null);
  const lastSeenAssistantMessageIdRef = useRef<string | null>(null);
  const hasEstablishedAssistantBaselineRef = useRef(false);

  const persistedMessages = useMemo<ReedMessage[]>(() => {
    if (!effectiveFetchedMessages) return [];

    let lastUserNonce: string | null = null;
    return effectiveFetchedMessages.map((message: ServerReedMessage) => {
      if (message.role === 'user') {
        lastUserNonce = message.clientNonce ?? null;
      }

      return {
        createdAt: message.createdAt,
        attachments: message.attachments?.map(attachment => ({
          id: attachment._id,
          mediaType: attachment.mediaType,
          status: attachment.status,
          url: attachment.url,
        })),
        id: getRenderMessageId(message, lastUserNonce),
        role: message.role,
        serverId: message._id,
        source: message.source === 'system' ? 'typed' : message.source,
        status: message.status,
        text: message.content || (message.status === 'pending' ? '' : message.error ?? ''),
      };
    });
  }, [effectiveFetchedMessages]);

  const messages = useMemo(() => {
    if (messagesPage.status === 'LoadingFirstPage' && !cachedMessages) return optimisticMessages;
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
  }, [cachedMessages, effectiveFetchedMessages, messagesPage.status, optimisticMessages, persistedMessages]);

  const pendingRunId = useMemo(() => {
    const pending = messages.find(message => message.role === 'assistant' && message.status === 'pending');
    return pending?.id ?? pendingSendNonce;
  }, [messages, pendingSendNonce]);


  useEffect(() => {
    let isMounted = true;

    void AsyncStorage.getItem(RECENT_MESSAGES_STORAGE_KEY)
      .then(value => {
        if (!isMounted || !value) return;
        const parsed = JSON.parse(value) as ServerReedMessage[];
        if (Array.isArray(parsed)) {
          setCachedMessages(parsed);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!fetchedMessages || fetchedMessages.length === 0) return;
    const recent = fetchedMessages.slice(-RECENT_MESSAGES_CACHE_LIMIT);
    setCachedMessages(current => {
      if (
        current?.length === recent.length &&
        current.every((message, index) =>
          message._id === recent[index]?._id &&
          message.status === recent[index]?.status &&
          message.completedAt === recent[index]?.completedAt &&
          message.content === recent[index]?.content
        )
      ) {
        return current;
      }
      return recent;
    });
    void AsyncStorage.setItem(RECENT_MESSAGES_STORAGE_KEY, JSON.stringify(recent));
  }, [fetchedMessagesCacheKey]);

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

    if (!hasEstablishedAssistantBaselineRef.current) {
      hasEstablishedAssistantBaselineRef.current = true;
      return;
    }

    markOnline();
    setPendingSendNonce(current => (current === null ? current : null));
    setOptimisticMessages(current => (current.length === 0 ? current : []));
  }, [markOnline, messages]);

  const hasMoreMessages = fetchedHasMore;
  const loadOlderMessages = useCallback(() => {
    if (messagesPage.status !== 'CanLoadMore') return;
    messagesPage.loadMore(MESSAGE_PAGE_SIZE);
  }, [messagesPage]);

  const sendPrompt = useCallback((prompt: string, source: ComposerSource, attachments: Array<{ storageId: Id<'_storage'> }> = []) => {
    const text = prompt.trim();
    if ((!text && attachments.length === 0) || pendingRunId) return false;

    const now = Date.now();
    const nonce = `${now}-${Math.random().toString(36).slice(2)}`;
    setPendingSendNonce(nonce);
    const nextOptimisticMessages: ReedMessage[] = [
      {
        createdAt: now,
        id: `optimistic-user-${nonce}`,
        role: 'user',
        source,
        status: 'sent',
        text: attachments.length > 0
          ? `${text || 'Attached images'}\n${attachments.length} image${attachments.length === 1 ? '' : 's'}`
          : text,
      },
    ];
    nextOptimisticMessages.push({
      createdAt: now + 1,
      id: `optimistic-assistant-${nonce}`,
      role: 'assistant',
      source: 'typed',
      status: 'pending',
      text: '',
    });
    setOptimisticMessages(current => current.concat(nextOptimisticMessages));
    markOnline();

    void sendReedMessage({
      clientNonce: nonce,
      clientNow: now,
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      content: text,
      attachments,
      source,
    })
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

  const retryAssistantMessage = useCallback((message: ReedMessage) => {
    if (message.role !== 'assistant' || message.status !== 'failed' || !message.serverId || pendingRunId) return;
    markOnline();
    void retryReedAssistantMessage({
      assistantMessageId: message.serverId as Id<'reedMessages'>,
      clientNow: Date.now(),
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).catch(() => {});
  }, [markOnline, pendingRunId, retryReedAssistantMessage]);

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
    isLoadingInitialMessages: messagesPage.status === 'LoadingFirstPage',
    isMessageSaved,
    loadOlderMessages,
    messages,
    pendingRunId,
    resolveCoachItem,
    saveCoachItem,
    sendPrompt,
    retryAssistantMessage,
  };
}

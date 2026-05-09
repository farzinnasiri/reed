import { useCallback, useEffect, useRef, useState } from 'react';
import { summarizeCoachItemTitle } from './reed.presenter';
import type { ReedRuntime } from './reed.runtime';
import type { CoachItem, ComposerSource, ReedMessage } from './reed.types';

const INITIAL_MESSAGES: ReedMessage[] = [];
const INITIAL_COACH_ITEMS: CoachItem[] = [
  {
    body: 'Revisit after two lower-body sessions.',
    id: 'coach-item-1',
    status: 'open',
    title: 'Lower-body recovery',
    type: 'check_in',
  },
];

const REED_ONLINE_DELAY_MS = 450;

export function useReedConversation({
  displayName,
  markOnline,
  runtime,
  shouldDelayAssistantStart,
}: {
  displayName: string;
  markOnline: () => void;
  runtime: ReedRuntime;
  shouldDelayAssistantStart: () => boolean;
}) {
  const [messages, setMessages] = useState<ReedMessage[]>(INITIAL_MESSAGES);
  const [coachItems, setCoachItems] = useState<CoachItem[]>(INITIAL_COACH_ITEMS);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const assistantStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistantReplyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      if (assistantStartTimeoutRef.current) {
        clearTimeout(assistantStartTimeoutRef.current);
      }
      if (assistantReplyTimeoutRef.current) {
        clearTimeout(assistantReplyTimeoutRef.current);
      }
    };
  }, []);

  const queueAssistantResponse = useCallback((prompt: string, source: ComposerSource) => {
    const now = Date.now();
    const assistantMessageId = `assistant-${now}`;
    const responseDelayMs = source === 'voice' ? 1600 : 1000;
    const typingDelayMs = shouldDelayAssistantStart() ? REED_ONLINE_DELAY_MS : 0;

    setPendingRunId(assistantMessageId);
    if (assistantStartTimeoutRef.current) {
      clearTimeout(assistantStartTimeoutRef.current);
    }
    if (assistantReplyTimeoutRef.current) {
      clearTimeout(assistantReplyTimeoutRef.current);
    }

    assistantStartTimeoutRef.current = setTimeout(() => {
      if (isUnmountedRef.current) {
        return;
      }

      markOnline();
      setMessages(current => current.concat({
        createdAt: Date.now(),
        id: assistantMessageId,
        role: 'assistant',
        source,
        status: 'pending',
        text: '',
      }));

      assistantReplyTimeoutRef.current = setTimeout(() => {
        void runtime
          .getAssistantReply({ displayName, prompt, source })
          .then(reply => {
            if (isUnmountedRef.current) {
              return;
            }
            setMessages(current =>
              current.map(message =>
                message.id === assistantMessageId
                  ? { ...message, status: 'sent', text: reply }
                  : message,
              ),
            );
            setPendingRunId(current => (current === assistantMessageId ? null : current));
            markOnline();
            assistantReplyTimeoutRef.current = null;
          })
          .catch(() => {
            if (isUnmountedRef.current) {
              return;
            }
            setMessages(current =>
              current.map(message =>
                message.id === assistantMessageId
                  ? { ...message, status: 'sent', text: 'Something went wrong. Please try again.' }
                  : message,
              ),
            );
            setPendingRunId(current => (current === assistantMessageId ? null : current));
            assistantReplyTimeoutRef.current = null;
          });
      }, responseDelayMs);
    }, typingDelayMs);
  }, [displayName, markOnline, runtime, shouldDelayAssistantStart]);

  const sendPrompt = useCallback((prompt: string, source: ComposerSource) => {
    const text = prompt.trim();
    if (!text || pendingRunId) {
      return false;
    }

    const now = Date.now();
    setMessages(current =>
      current.concat({
        createdAt: now,
        id: `user-${now}`,
        role: 'user',
        source,
        status: 'sent',
        text,
      }),
    );

    queueAssistantResponse(text, source);
    return true;
  }, [pendingRunId, queueAssistantResponse]);

  const saveCoachItem = useCallback((message: ReedMessage) => {
    if (!message.text.trim()) {
      return;
    }

    const title = summarizeCoachItemTitle(message.text);
    setCoachItems(current => {
      if (current.some(item => item.title === title)) {
        return current;
      }

      return [
        {
          body: message.text,
          id: `coach-item-${Date.now()}`,
          status: 'open',
          title,
          type: 'focus',
        },
        ...current,
      ];
    });
  }, []);

  const resolveCoachItem = useCallback((itemId: string) => {
    setCoachItems(current =>
      current.map(item => (item.id === itemId ? { ...item, status: 'resolved' } : item)),
    );
  }, []);

  return {
    coachItems,
    messages,
    pendingRunId,
    resolveCoachItem,
    saveCoachItem,
    sendPrompt,
  };
}

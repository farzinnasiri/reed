import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

const SEEN_COACH_MESSAGE_KEY = 'reed:home:seen-coach-message-key:v1';

export function useCoachMessageUnread(message: string | null | undefined) {
  const messageKey = useMemo(() => getCoachMessageKey(message), [message]);
  const [seenMessageKey, setSeenMessageKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let isActive = true;
    void AsyncStorage.getItem(SEEN_COACH_MESSAGE_KEY)
      .then(value => {
        if (isActive) {
          setSeenMessageKey(value);
        }
      })
      .catch(() => {
        if (isActive) {
          setSeenMessageKey(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!messageKey || seenMessageKey !== null) {
      return;
    }

    setSeenMessageKey(messageKey);
    void AsyncStorage.setItem(SEEN_COACH_MESSAGE_KEY, messageKey).catch(() => {
      setSeenMessageKey(current => (current === messageKey ? null : current));
    });
  }, [messageKey, seenMessageKey]);

  const markCoachMessageRead = useCallback(() => {
    if (!messageKey) {
      return;
    }

    setSeenMessageKey(messageKey);
    void AsyncStorage.setItem(SEEN_COACH_MESSAGE_KEY, messageKey).catch(() => {
      setSeenMessageKey(current => (current === messageKey ? null : current));
    });
  }, [messageKey]);

  return {
    hasUnreadCoachMessage: Boolean(messageKey && seenMessageKey !== undefined && seenMessageKey !== null && seenMessageKey !== messageKey),
    markCoachMessageRead,
  };
}

function getCoachMessageKey(message: string | null | undefined) {
  const normalized = message?.trim();
  if (!normalized) {
    return null;
  }

  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `coach:${(hash >>> 0).toString(36)}:${normalized.length}`;
}

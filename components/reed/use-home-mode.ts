import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { ReedMessage } from './reed.types';
import { useFiveMinuteNow } from '@/components/home/use-five-minute-now';

const LAST_SEEN_COACH_NOTE_KEY = 'reed:home:last-seen-coach-note:v1';

export type HomeMode = 'chat' | 'today';

/**
 * Which middle home opens in (plan decision 2.4). Today mode when Reed has a coach note you have
 * not seen, or when the conversation has gone cold (more than an hour since the last message,
 * using the server chapter rule); otherwise chat, resumed at the bottom. The mode is decided once
 * the data is in; sending or opening Chat history enters chat, and Back to Today returns. A new
 * coach note or cold conversation on returning home or foregrounding starts Today. The "seen" marker is the creation time of the newest coach note shown, kept on this
 * device.
 */
export function useHomeMode({
  isLoadingMessages,
  messages,
}: {
  isLoadingMessages: boolean;
  messages: ReedMessage[];
}) {
  const now = useFiveMinuteNow();
  const presence = useQuery(api.reed.getPresence, { now });
  const isFocused = useIsFocused();
  // undefined until storage has answered; null when nothing was ever stored.
  const [seenAt, setSeenAt] = useState<number | null | undefined>(undefined);
  const [state, setState] = useState<{ mode: HomeMode; note: ReedMessage | null } | null>(null);
  const [wasFocused, setWasFocused] = useState(isFocused);
  const latestNote = findLatestCoachNote(messages);

  useEffect(() => {
    let isActive = true;
    void AsyncStorage.getItem(LAST_SEEN_COACH_NOTE_KEY)
      .then(value => {
        const parsed = value === null ? null : Number(value);
        if (isActive) setSeenAt(parsed !== null && Number.isFinite(parsed) ? parsed : null);
      })
      .catch(() => {
        if (isActive) setSeenAt(null);
      });
    return () => {
      isActive = false;
    };
  }, []);

  if (!state && presence !== undefined && !isLoadingMessages && seenAt !== undefined) {
    const unseenNote = seenAt !== null && latestNote && latestNote.createdAt > seenAt ? latestNote : null;
    setState({ mode: unseenNote || presence.wouldStartNewChapter ? 'today' : 'chat', note: unseenNote });
    if (seenAt === null) setSeenAt(latestNote?.createdAt ?? 0);
  }
  // Persist the baseline or newly seen note; foreground callbacks read committed inputs.
  useEffect(() => {
    if (seenAt !== undefined && seenAt !== null) {
      void AsyncStorage.setItem(LAST_SEEN_COACH_NOTE_KEY, String(seenAt)).catch(() => {});
    }
  }, [seenAt]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', status => {
      if (status !== 'active' || !state || state.mode === 'today' || presence === undefined || seenAt === undefined) return;
      const unseenNote = seenAt !== null && latestNote && latestNote.createdAt > seenAt ? latestNote : null;
      if (unseenNote || presence.wouldStartNewChapter) setState({ mode: 'today', note: unseenNote });
    });
    return () => subscription.remove();
  }, [latestNote, presence, seenAt, state]);
  if (wasFocused !== isFocused) {
    setWasFocused(isFocused);
    if (isFocused && state) {
      const unseenNote = seenAt !== undefined && seenAt !== null && latestNote && latestNote.createdAt > seenAt ? latestNote : null;
      if (state.mode === 'chat' && (unseenNote || presence?.wouldStartNewChapter)) setState({ mode: 'today', note: unseenNote });
      if (unseenNote) setSeenAt(unseenNote.createdAt);
    }
  }
  if (isFocused && state && seenAt !== undefined && seenAt !== null && latestNote && latestNote.createdAt > seenAt) {
    setSeenAt(latestNote.createdAt);
  }

  const enterChat = useCallback(() => {
    setState(current => (current && current.mode === 'today' ? { mode: 'chat', note: current.note } : current));
  }, []);
  const enterToday = useCallback(() => {
    setState(current => current ? { mode: 'today', note: current.note } : current);
  }, []);

  return {
    enterChat,
    enterToday,
    mode: state?.mode ?? null,
    /** The unseen coach note today mode opened with, if that is why it opened. */
    note: state?.note ?? null,
  };
}

function findLatestCoachNote(messages: ReedMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.isCoachNote && message.role === 'assistant' && message.status === 'sent') return message;
  }
  return null;
}

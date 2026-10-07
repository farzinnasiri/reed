import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useReedReducedMotion } from '@/design/use-reed-reduced-motion';
import { useLowPower } from './use-low-power';
import { reedMotion } from '@/design/motion';
import { useMascot } from '../mascot';
import type { ReedMessage, VoiceComposerStatus } from '../reed.types';
import { deriveReedPresence, presenceExpressions, type PresenceBeat, type ReedDraftLevel } from './presence-state';
import { usePresenceActivity } from './use-presence-activity';
import { replyRevealDuration } from '../thread/reply-reveal';
import { usePendingPresence } from './use-pending-presence';

type PresenceInput = {
  attachmentCount: number;
  draftLevel: ReedDraftLevel;
  hasActiveSession: boolean;
  hasAttachmentError: boolean;
  isComposerFocused: boolean;
  isPreparingAttachments: boolean;
  isReady: boolean;
  isReplyPending: boolean;
  replyRecovery?: ReedMessage['replyRecovery'];
  messages: ReedMessage[];
  voiceStatus: VoiceComposerStatus;
};

export function useReedPresence(input: PresenceInput) {
  const active = usePresenceActivity();
  const reduced = useReedReducedMotion();
  const lowPower = useLowPower();
  const [beat, setBeat] = useState<PresenceBeat>(null);
  const [previousActive, setPreviousActive] = useState(active);
  if (previousActive !== active) { setPreviousActive(active); setBeat(null); }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const state = deriveReedPresence({ ...input, beat: active ? beat : null, hasError: input.hasAttachmentError });
  const sharedState = useSharedValue(state);
  const wordAt = useSharedValue(0);
  const receivedAt = useSharedValue(0);
  const pendingPresence = usePendingPresence({ active, pending: input.isReplyPending, recovering: Boolean(input.replyRecovery), transcribing: input.voiceStatus === 'transcribing', varyGlyphs: !reduced && !lowPower });
  const mascot = useMascot(state === 'thinking' ? pendingPresence.expression : presenceExpressions[state], { enabled: active });
  const { act, lookAt, play, react } = mascot;

  const clearBeat = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setBeat(null);
  }, []);
  const receive = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    receivedAt.set(Date.now());
    setBeat('received');
    act('hop');
    timer.current = setTimeout(clearBeat, reedMotion.presence.receivedMs);
  }, [act, clearBeat, receivedAt]);

  useEffect(() => { sharedState.set(state); }, [sharedState, state]);
  useEffect(() => {
    const target = state === 'speaking' ? 'message'
      : state === 'waitingOnYou' ? 'suggestions'
        : state === 'following' ? 'composer' : 'center';
    lookAt(target);
  }, [lookAt, state]);

  // Baseline the initial history, then acknowledge only a newer completed reply.
  const lastReply = input.messages.findLast(message => message.role === 'assistant'
    && message.status === 'sent' && !message.isAgentThinkingMessage);
  const seenReply = useRef<{ id: string | null; createdAt: number } | null>(null);
  const lastReplyId = lastReply?.id ?? null;
  const lastReplyAt = lastReply?.createdAt ?? 0;
  const hasReplies = Boolean(lastReply?.replies?.length);
  useLayoutEffect(() => {
    if (!input.isReady) return;
    const previous = seenReply.current;
    seenReply.current = { id: lastReplyId, createdAt: lastReplyAt };
    if (!active || !previous || !lastReplyId || previous.id === lastReplyId || lastReplyAt <= previous.createdAt) return;
    if (timer.current) clearTimeout(timer.current);
    setBeat('speaking');
    timer.current = setTimeout(() => {
      setBeat(hasReplies ? 'waitingOnYou' : null);
      timer.current = hasReplies ? setTimeout(clearBeat, reedMotion.presence.waitingMs) : null;
    }, reduced ? reedMotion.reply.reducedMs : replyRevealDuration() + (lastReply?.widget ? reedMotion.reply.widgetSettleMs : 0));
  }, [active, clearBeat, hasReplies, input.isReady, lastReplyAt, lastReplyId, lastReply?.text, lastReply?.widget, reduced]);

  const previousAttachments = useRef(input.attachmentCount);
  useEffect(() => {
    if (active && input.attachmentCount > previousAttachments.current && !input.isReplyPending) play([{ expression: 'surprised', ms: 700 }, { expression: 'curious', ms: 1400 }]);
    previousAttachments.current = input.attachmentCount;
  }, [active, input.attachmentCount, input.isReplyPending, play]);

  const previousDraft = useRef('');
  const lastWordAt = useRef(0);
  const onDraftChanged = useCallback((text: string) => {
    const grew = text.length > previousDraft.current.length;
    previousDraft.current = text;
    const now = Date.now();
    if (active && !input.isReplyPending && grew && /[\s.,!?;:]$/u.test(text)
      && text.trim().length > 0 && now - lastWordAt.current >= reedMotion.presence.wordThrottleMs) {
      lastWordAt.current = now;
      wordAt.set(now);
      act('tick');
    }
  }, [act, active, input.isReplyPending, wordAt]);

  useEffect(() => {
    if (!active && timer.current) clearTimeout(timer.current);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [active]);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mountedAt] = useState(Date.now);
  const activityAt = useRef(mountedAt);
  const asleep = useRef(false);
  const [sleeping, setSleeping] = useState(false);
  const wake = useCallback(() => {
    activityAt.current = Date.now();
    if (asleep.current) { asleep.current = false; setSleeping(false); react('surprised', reedMotion.presence.hopMs); act('hop'); }
  }, [act, react]);
  const canIdle = active && !lowPower && state === 'resting';
  useEffect(() => {
    if (!canIdle) { if (idleTimer.current) clearTimeout(idleTimer.current); wake(); return; }
    function tick() {
      const age = Date.now() - activityAt.current;
      if (age >= reedMotion.touch.sleepyMs) {
        asleep.current = true; setSleeping(true); play([{ expression: 'sleepy', ms: reedMotion.touch.sleepyMs, speed: 0.7, transition: 'slow' }]);
        idleTimer.current = setTimeout(tick, reedMotion.touch.glanceMinMs);
      } else {
        if (age >= reedMotion.touch.idleMs && !reduced) {
          lookAt(Math.random() > 0.5 ? 'left' : 'right');
          idleTimer.current = setTimeout(() => { lookAt('center'); idleTimer.current = setTimeout(tick, reedMotion.touch.glanceMinMs + Math.random() * (reedMotion.touch.glanceMaxMs - reedMotion.touch.glanceMinMs)); }, reedMotion.presence.waitingMs);
        } else idleTimer.current = setTimeout(tick, reduced ? reedMotion.touch.glanceMinMs : Math.max(1, reedMotion.touch.idleMs - age));
      }
    }
    idleTimer.current = setTimeout(tick, reedMotion.touch.idleMs);
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [canIdle, lookAt, play, reduced, wake]);

  return { active, sleeping, hint: input.voiceStatus === 'listening' ? 'Listening' : pendingPresence.hint, mascot, onDraftChanged: (text: string) => { wake(); onDraftChanged(text); }, touch: wake, receive, receivedAt, sharedState, state, wordAt };
}

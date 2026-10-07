import type { MascotExpression } from '../mascot/mascot-engine';
import type { VoiceComposerStatus } from '../reed.types';

export type ReedPresenceState =
  | 'resting' | 'listening' | 'following' | 'received' | 'thinking'
  | 'speaking' | 'waitingOnYou' | 'concerned' | 'watching' | 'celebrating';
export type ReedDraftLevel = 'none' | 'short' | 'long';
export type PresenceBeat = 'received' | 'speaking' | 'waitingOnYou' | null;

export function getReedDraftLevel(text: string): ReedDraftLevel {
  const length = text.trim().length;
  return length === 0 ? 'none' : length >= 90 ? 'long' : 'short';
}

export function deriveReedPresence(input: {
  beat: PresenceBeat;
  draftLevel: ReedDraftLevel;
  hasActiveSession: boolean;
  hasError: boolean;
  isComposerFocused: boolean;
  isPreparingAttachments: boolean;
  isReplyPending: boolean;
  voiceStatus: VoiceComposerStatus;
}): ReedPresenceState {
  if (input.voiceStatus === 'listening') return 'listening';
  if (input.voiceStatus === 'transcribing') return 'thinking';
  if (input.isReplyPending) return input.beat === 'received' ? 'received' : 'thinking';
  if (input.hasError || input.voiceStatus === 'failed') return 'concerned';
  if (input.beat === 'received' || input.beat === 'speaking') return input.beat;
  if (input.draftLevel !== 'none') return 'following';
  if (input.isComposerFocused) return 'listening';
  if (input.beat === 'waitingOnYou') return 'waitingOnYou';
  if (input.isPreparingAttachments || input.hasActiveSession) return 'watching';
  return 'resting';
}

export const presenceExpressions = {
  resting: 'idle',
  listening: 'listening',
  following: 'focused',
  received: 'surprised',
  thinking: 'thinking',
  speaking: 'speaking',
  waitingOnYou: 'encouraging',
  concerned: 'concerned',
  watching: 'watching',
  celebrating: 'happy',
} as const satisfies Record<ReedPresenceState, MascotExpression>;

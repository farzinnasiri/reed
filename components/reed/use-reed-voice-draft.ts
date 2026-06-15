import { useCallback, useEffect, useRef, useState } from 'react';
import { pickVoiceTranscript } from './reed.presenter';
import type { ReedMessage, VoiceComposerState } from './reed.types';

export function useReedVoiceDraft(messages: ReedMessage[]) {
  const [voiceState, setVoiceState] = useState<VoiceComposerState>({ status: 'idle', transcript: '', voiceLevel: 0 });
  const messagesRef = useRef(messages);
  const voiceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (voiceTimeoutRef.current) {
        clearTimeout(voiceTimeoutRef.current);
      }
    };
  }, []);

  const resetVoice = useCallback(() => {
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }
    setVoiceState({ status: 'idle', transcript: '', voiceLevel: 0 });
  }, []);

  const startVoice = useCallback((disabled: boolean) => {
    if (disabled) {
      return;
    }

    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
    }

    setVoiceState({ status: 'listening', transcript: '', voiceLevel: 0 });
    voiceTimeoutRef.current = setTimeout(() => {
      setVoiceState({ status: 'ready', transcript: pickVoiceTranscript(messagesRef.current), voiceLevel: 0 });
      voiceTimeoutRef.current = null;
    }, 1200);
  }, []);

  const stopVoice = useCallback((existingComposerText: string) => {
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }

    if (voiceState.status === 'listening') {
      setVoiceState({ status: 'ready', transcript: pickVoiceTranscript(messagesRef.current), voiceLevel: 0 });
      return existingComposerText;
    }

    if (voiceState.status === 'ready' && voiceState.transcript.trim() && existingComposerText.trim().length === 0) {
      const draft = voiceState.transcript;
      setVoiceState({ status: 'idle', transcript: '', voiceLevel: 0 });
      return draft;
    }

    setVoiceState({ status: 'idle', transcript: '', voiceLevel: 0 });
    return existingComposerText;
  }, [voiceState]);

  return {
    resetVoice,
    setVoiceState,
    startVoice,
    stopVoice,
    voiceState,
  };
}

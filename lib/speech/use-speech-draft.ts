import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { RecordingPresets, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import {
  clearLocalSpeechRecording,
  startLocalSpeechRecording,
  stopLocalSpeechRecording,
  type LocalSpeechRecording,
} from './audio-recording';
import { transcribeLocalSpeechRecording, type SpeechTranscriptionActor } from './transcription-api';

export type SpeechDraftStatus = 'failed' | 'idle' | 'listening' | 'transcribing';

export type SpeechDraftState = {
  error: string | null;
  status: SpeechDraftStatus;
  voiceLevel: number;
};

const SPEECH_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

export function useSpeechDraft(
  actor: SpeechTranscriptionActor,
  onText: (text: string) => void,
  options: { onError?: (message: string) => void } = {},
) {
  const { onError } = options;
  const { getToken } = useAuth();
  const recorder = useAudioRecorder(SPEECH_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 80);
  const recordingStartedAtRef = useRef(0);
  const cachedRecordingRef = useRef<LocalSpeechRecording | null>(null);
  const generation = useRef(0);
  const status = useRef<SpeechDraftStatus | 'resetting'>('idle');
  const pendingStart = useRef<Promise<number> | null>(null);
  const [state, setState] = useState<Omit<SpeechDraftState, 'voiceLevel'>>({ error: null, status: 'idle' });

  useEffect(() => () => {
    generation.current += 1;
    const start = pendingStart.current;
    void (async () => {
      await start?.catch(() => undefined);
      if (start || status.current === 'listening' || recordingStartedAtRef.current > 0) await recorder.stop().catch(() => undefined);
      await clearLocalSpeechRecording(cachedRecordingRef.current);
    })();
  }, [recorder]);

  const fail = useCallback((error: unknown, operation: number) => {
    if (generation.current !== operation) return;
    const message = toSpeechDraftError(error);
    status.current = onError ? 'idle' : 'failed';
    onError?.(message);
    setState({ error: onError ? null : message, status: status.current });
  }, [onError]);

  const transcribeRecording = useCallback(async (recording: LocalSpeechRecording, operation: number) => {
    if (generation.current !== operation) return;
    status.current = 'transcribing';
    setState({ error: null, status: 'transcribing' });
    try {
      const result = await transcribeLocalSpeechRecording({ actor, getToken, recording });
      if (generation.current !== operation) return;
      onText(result.text);
      cachedRecordingRef.current = null;
      status.current = 'idle';
      setState({ error: null, status: 'idle' });
    } catch (error) {
      fail(error, operation);
    } finally {
      // Keep failed recordings for retry; cleanup cannot turn delivered text into a retry.
      if (cachedRecordingRef.current !== recording) await clearLocalSpeechRecording(recording);
    }
  }, [actor, fail, getToken, onText]);

  const start = useCallback(async () => {
    if (status.current !== 'idle' && status.current !== 'failed') return;
    const operation = ++generation.current;
    status.current = 'listening';
    setState({ error: null, status: 'listening' });
    const previous = cachedRecordingRef.current;
    cachedRecordingRef.current = null;
    void clearLocalSpeechRecording(previous);
    const starting = startLocalSpeechRecording(recorder);
    pendingStart.current = starting;
    try {
      const startedAt = await starting;
      if (generation.current === operation) recordingStartedAtRef.current = startedAt;
    } catch (error) {
      fail(error, operation);
    } finally {
      if (pendingStart.current === starting) pendingStart.current = null;
    }
  }, [fail, recorder]);

  const stop = useCallback(async () => {
    if (status.current !== 'listening') return;
    const operation = generation.current;
    status.current = 'transcribing';
    setState({ error: null, status: 'transcribing' });
    try {
      await pendingStart.current;
      if (generation.current !== operation) return;
      const recording = await stopLocalSpeechRecording(recorder, recordingStartedAtRef.current);
      if (generation.current !== operation) {
        await clearLocalSpeechRecording(recording);
        return;
      }
      cachedRecordingRef.current = recording;
      await transcribeRecording(recording, operation);
    } catch (error) {
      fail(error, operation);
    } finally {
      if (generation.current === operation) recordingStartedAtRef.current = 0;
    }
  }, [fail, recorder, transcribeRecording]);

  const retry = useCallback(async () => {
    const recording = cachedRecordingRef.current;
    if (!recording || (status.current !== 'failed' && status.current !== 'idle')) return;
    await transcribeRecording(recording, ++generation.current);
  }, [transcribeRecording]);

  const reset = useCallback(async () => {
    const operation = ++generation.current;
    const hadRecording = status.current === 'listening' || pendingStart.current !== null || recordingStartedAtRef.current > 0;
    status.current = 'resetting';
    const cached = cachedRecordingRef.current;
    cachedRecordingRef.current = null;
    await pendingStart.current?.catch(() => undefined);
    if (hadRecording) await recorder.stop().catch(() => undefined);
    await clearLocalSpeechRecording(cached);
    if (generation.current !== operation) return;
    recordingStartedAtRef.current = 0;
    status.current = 'idle';
    setState({ error: null, status: 'idle' });
  }, [recorder]);

  return {
    retry,
    reset,
    start,
    state: {
      ...state,
      voiceLevel: state.status === 'listening' ? normalizeMeteringLevel(recorderState.metering) : 0,
    },
    stop,
  };
}

function toSpeechDraftError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Could not transcribe audio.';
}

function normalizeMeteringLevel(metering: number | undefined) {
  if (typeof metering !== 'number' || !Number.isFinite(metering)) return 0;

  const silenceFloor = -52;
  const voiceCeiling = -12;
  if (metering <= silenceFloor) return 0;

  return Math.min(1, Math.max(0, (metering - silenceFloor) / (voiceCeiling - silenceFloor)));
}

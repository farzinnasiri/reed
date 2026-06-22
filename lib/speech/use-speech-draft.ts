import { useCallback, useEffect, useRef, useState } from 'react';
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
  const recorder = useAudioRecorder(SPEECH_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 80);
  const recordingStartedAtRef = useRef(0);
  const cachedRecordingRef = useRef<LocalSpeechRecording | null>(null);
  const [state, setState] = useState<Omit<SpeechDraftState, 'voiceLevel'>>({ error: null, status: 'idle' });

  useEffect(() => () => {
    clearLocalSpeechRecording(cachedRecordingRef.current).catch(() => {});
  }, []);

  const transcribeRecording = useCallback(async (recording: LocalSpeechRecording) => {
    setState({ error: null, status: 'transcribing' });
    try {
      const result = await transcribeLocalSpeechRecording({ actor, recording });
      onText(result.text);
      await clearLocalSpeechRecording(recording);
      if (cachedRecordingRef.current?.uri === recording.uri) {
        cachedRecordingRef.current = null;
      }
      setState({ error: null, status: 'idle' });
    } catch (error) {
      const message = toSpeechDraftError(error);
      onError?.(message);
      setState({ error: onError ? null : message, status: onError ? 'idle' : 'failed' });
    }
  }, [actor, onError, onText]);

  const start = useCallback(async () => {
    if (state.status === 'listening' || state.status === 'transcribing') return;
    setState({ error: null, status: 'listening' });
    try {
      recordingStartedAtRef.current = await startLocalSpeechRecording(recorder);
    } catch (error) {
      recordingStartedAtRef.current = 0;
      const message = toSpeechDraftError(error);
      onError?.(message);
      setState({ error: onError ? null : message, status: onError ? 'idle' : 'failed' });
    }
  }, [onError, recorder, state.status]);

  const stop = useCallback(async () => {
    if (state.status !== 'listening') return;
    try {
      const recording = await stopLocalSpeechRecording(recorder, recordingStartedAtRef.current);
      cachedRecordingRef.current = recording;
      await transcribeRecording(recording);
    } catch (error) {
      const message = toSpeechDraftError(error);
      onError?.(message);
      setState({ error: onError ? null : message, status: onError ? 'idle' : 'failed' });
    } finally {
      recordingStartedAtRef.current = 0;
    }
  }, [onError, recorder, state.status, transcribeRecording]);

  const retry = useCallback(async () => {
    const recording = cachedRecordingRef.current;
    if (!recording || state.status === 'transcribing') return;
    await transcribeRecording(recording);
  }, [state.status, transcribeRecording]);

  const reset = useCallback(async () => {
    const cachedRecording = cachedRecordingRef.current;
    cachedRecordingRef.current = null;
    await clearLocalSpeechRecording(cachedRecording);
    if (state.status === 'listening') {
      await recorder.stop().catch(() => {});
      recordingStartedAtRef.current = 0;
    }
    setState({ error: null, status: 'idle' });
  }, [recorder, state.status]);

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

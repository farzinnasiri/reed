import { authClient } from '@/lib/auth-client';
import { appEnv } from '@/lib/env';
import { startClientWideEvent } from '@/lib/client-observability';
import { Platform } from 'react-native';
import type { LocalSpeechRecording } from './audio-recording';

export type SpeechTranscriptionActor = 'chat' | 'session_notes';

export type SpeechTranscriptionResponse = {
  text: string;
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [700, 1600];

export class SpeechTranscriptionError extends Error {
  code: string;
  retryable: boolean;

  constructor(message: string, code: string, retryable: boolean) {
    super(message);
    this.name = 'SpeechTranscriptionError';
    this.code = code;
    this.retryable = retryable;
  }
}

export async function transcribeLocalSpeechRecording(args: {
  actor: SpeechTranscriptionActor;
  recording: LocalSpeechRecording;
}): Promise<SpeechTranscriptionResponse> {
  const event = startClientWideEvent('speech.transcription', {
    'speech.actor': args.actor,
    'speech.duration_ms': Math.round(args.recording.durationMs),
    'speech.mime_type': args.recording.mimeType,
  });
  let lastError: SpeechTranscriptionError | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      event.set({ 'speech.attempt': attempt + 1 });
      const result = await transcribeOnce(args, step => event.set({ 'speech.step': step }));
      event.end({
        'speech.attempts': attempt + 1,
        'speech.transcript_length_bucket': transcriptLengthBucket(result.text),
      });
      return result;
    } catch (error) {
      const normalized = normalizeTranscriptionError(error);
      lastError = normalized;
      if (!normalized.retryable || attempt === MAX_ATTEMPTS - 1) {
        event.fail(normalized, `speech_transcription_${normalized.code}`, {
          'speech.attempts': attempt + 1,
          'speech.error_code': normalized.code,
          'speech.retryable': normalized.retryable,
        });
        throw normalized;
      }
      await wait(RETRY_DELAYS_MS[attempt] ?? 1600);
    }
  }

  const fallbackError = lastError ?? new SpeechTranscriptionError('Transcription failed.', 'transcription_failed', true);
  event.fail(fallbackError, `speech_transcription_${fallbackError.code}`, {
    'speech.error_code': fallbackError.code,
    'speech.retryable': fallbackError.retryable,
  });
  throw fallbackError;
}

async function transcribeOnce(args: {
  actor: SpeechTranscriptionActor;
  recording: LocalSpeechRecording;
}, onStep: (step: string) => void) {
  onStep('auth_token');
  const tokenResult = await authClient.convex.token({ fetchOptions: { throw: false } });
  const token = tokenResult.data?.token;
  if (!token) {
    throw new SpeechTranscriptionError('You need to be signed in to transcribe audio.', 'unauthorized', false);
  }

  onStep('form_data');
  const audio = await getFormDataAudio(args.recording);
  const mimeType = args.recording.mimeType;
  const formData = new FormData();
  formData.append('actor', args.actor);
  formData.append('audio', audio, getRecordingFilename(mimeType));

  onStep('http_request');
  const response = await fetch(`${appEnv.convexSiteUrl}/speech/transcribe`, {
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: 'POST',
  });

  onStep('response_parse');
  const payload = await response.json().catch(() => ({})) as { code?: string; error?: string; text?: string };
  if (!response.ok) {
    throw new SpeechTranscriptionError(
      payload.error || 'Transcription failed.',
      payload.code || 'transcription_failed',
      response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }

  const text = payload.text?.trim();
  if (!text) {
    throw new SpeechTranscriptionError('No speech was detected.', 'empty_transcript', false);
  }

  return { text };
}

async function getFormDataAudio(recording: LocalSpeechRecording) {
  if (Platform.OS === 'web') {
    const audio = await fetch(recording.uri).then(response => response.blob());
    return audio;
  }

  return {
    name: getRecordingFilename(recording.mimeType),
    type: recording.mimeType,
    uri: recording.uri,
  } as unknown as Blob;
}

function normalizeTranscriptionError(error: unknown) {
  if (error instanceof SpeechTranscriptionError) return error;
  return new SpeechTranscriptionError('Network error while transcribing audio.', 'network', true);
}

function getRecordingFilename(mimeType: string) {
  const extension = mimeType.includes('webm')
    ? 'webm'
    : mimeType.includes('wav')
      ? 'wav'
      : mimeType.includes('aac')
        ? 'aac'
        : 'm4a';
  return `speech-${Date.now()}.${extension}`;
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function transcriptLengthBucket(text: string) {
  if (text.length < 40) return 'lt_40';
  if (text.length < 160) return '40_160';
  if (text.length < 600) return '160_600';
  return 'gt_600';
}

import { authClient } from '@/lib/auth-client';
import { appEnv } from '@/lib/env';
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
  let lastError: SpeechTranscriptionError | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await transcribeOnce(args);
    } catch (error) {
      const normalized = normalizeTranscriptionError(error);
      lastError = normalized;
      if (!normalized.retryable || attempt === MAX_ATTEMPTS - 1) {
        throw normalized;
      }
      await wait(RETRY_DELAYS_MS[attempt] ?? 1600);
    }
  }

  throw lastError ?? new SpeechTranscriptionError('Transcription failed.', 'transcription_failed', true);
}

async function transcribeOnce(args: {
  actor: SpeechTranscriptionActor;
  recording: LocalSpeechRecording;
}) {
  const tokenResult = await authClient.convex.token({ fetchOptions: { throw: false } });
  const token = tokenResult.data?.token;
  if (!token) {
    throw new SpeechTranscriptionError('You need to be signed in to transcribe audio.', 'unauthorized', false);
  }

  const audio = await fetch(args.recording.uri).then(response => response.blob());
  const mimeType = audio.type || args.recording.mimeType;
  const formData = new FormData();
  formData.append('actor', args.actor);
  formData.append('audio', audio, getRecordingFilename(mimeType));

  const response = await fetch(`${appEnv.convexSiteUrl}/speech/transcribe`, {
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: 'POST',
  });

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

import { ChatOpenAI } from '@langchain/openai';

export type SpeechActor = 'chat' | 'session_notes';

type SpeechTranscriptionInput = {
  actor: SpeechActor;
  file: File;
};

type SpeechTranscriptionResult = {
  text: string;
};

const OPENAI_TRANSCRIPTION_MODEL = process.env.REED_STT_MODEL ?? 'gpt-4o-mini-transcribe';
const NOTE_POLISH_MODEL = process.env.REED_NOTE_POLISH_MODEL ?? 'gpt-5.4-mini-2026-03-17';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const NOTE_POLISH_SYSTEM_PROMPT = [
  'Rewrite spoken workout notes into a concise first-person note.',
  'Preserve the user meaning and details. Do not answer, greet, advise, or add new information.',
  'Output only the note text.',
].join(' ');

export async function transcribeSpeech(input: SpeechTranscriptionInput): Promise<SpeechTranscriptionResult> {
  return transcribeSpeechWithOpenAI(input);
}

async function transcribeSpeechWithOpenAI(input: SpeechTranscriptionInput): Promise<SpeechTranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new SpeechServiceError('OpenAI API key is not configured.', 'configuration');
  }

  if (input.file.size <= 0) {
    throw new SpeechServiceError('Recording is empty.', 'empty_audio');
  }

  if (input.file.size > MAX_AUDIO_BYTES) {
    throw new SpeechServiceError('Recording is too large.', 'too_large');
  }

  const formData = new FormData();
  formData.append('model', OPENAI_TRANSCRIPTION_MODEL);
  formData.append('file', input.file);
  formData.append('prompt', getTranscriptionPrompt(input.actor));
  formData.append('response_format', 'json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    body: formData,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new SpeechServiceError(await readOpenAIError(response), isRetryableStatus(response.status) ? 'retryable' : 'provider');
  }

  const payload = await response.json() as { text?: string };
  const transcript = payload.text?.trim() ?? '';
  if (!transcript) {
    throw new SpeechServiceError('No speech was detected.', 'empty_transcript');
  }

  if (input.actor === 'session_notes') {
    return { text: await polishSessionNote(transcript) };
  }

  return { text: transcript };
}

async function polishSessionNote(transcript: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new SpeechServiceError('OpenAI API key is not configured.', 'configuration');
  }

  const model = new ChatOpenAI({
    apiKey,
    model: NOTE_POLISH_MODEL,
    temperature: 0.2,
  });
  const response = await model.invoke([
    ['system', NOTE_POLISH_SYSTEM_PROMPT],
    ['human', transcript],
  ]);
  const text = typeof response.content === 'string'
    ? response.content
    : response.content.map(part => typeof part === 'string' ? part : part.type === 'text' ? part.text : '').join('');
  return text.trim() || transcript;
}

function getTranscriptionPrompt(actor: SpeechActor) {
  if (actor === 'session_notes') {
    return 'Workout notes. Preserve exercise names, body areas, pain descriptions, reps, loads, and informal wording.';
  }
  return 'Casual coaching chat about training, recovery, exercises, pain, sets, reps, and workout planning.';
}

async function readOpenAIError(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return `OpenAI transcription failed with status ${response.status}.`;

  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? `OpenAI transcription failed with status ${response.status}.`;
  } catch {
    return `OpenAI transcription failed with status ${response.status}.`;
  }
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export class SpeechServiceError extends Error {
  code: 'configuration' | 'empty_audio' | 'empty_transcript' | 'provider' | 'retryable' | 'too_large';

  constructor(message: string, code: SpeechServiceError['code']) {
    super(message);
    this.name = 'SpeechServiceError';
    this.code = code;
  }
}

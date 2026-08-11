import type { ActionCtx } from './_generated/server';
import { SpeechServiceError, transcribeSpeech, type SpeechActor } from './speech';

const ALLOWED_ACTORS = new Set(['chat', 'session_notes']);

export async function transcribeSpeechHttp(ctx: ActionCtx, request: Request) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return jsonResponse({ error: 'Not authenticated.', code: 'unauthorized' }, 401);
  }

  try {
    const input = await readSpeechInput(request);
    const result = await transcribeSpeech(input);
    return jsonResponse(result, 200);
  } catch (error) {
    if (error instanceof SpeechRequestError) {
      return jsonResponse({ error: error.message, code: 'bad_request' }, 400);
    }
    if (error instanceof SpeechServiceError) {
      const status = error.code === 'configuration'
        ? 500
        : error.code === 'too_large'
          ? 413
          : error.code === 'retryable'
            ? 503
            : 422;
      return jsonResponse({ error: error.message, code: error.code }, status);
    }
    return jsonResponse({ error: 'Transcription failed.', code: 'transcription_failed' }, 500);
  }
}

async function readSpeechInput(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return await readRawSpeechInput(request, contentType);
  }

  let formData: Pick<globalThis.FormData, 'get'>;
  try {
    formData = await request.formData() as unknown as Pick<globalThis.FormData, 'get'>;
  } catch {
    throw new SpeechRequestError('Invalid transcription request.');
  }

  const actor = formData.get('actor');
  const file = formData.get('audio');
  if (typeof actor !== 'string' || !ALLOWED_ACTORS.has(actor)) {
    throw new SpeechRequestError('Invalid transcription target.');
  }
  if (!(file instanceof File)) {
    throw new SpeechRequestError('Missing audio recording.');
  }

  return { actor: actor as SpeechActor, file };
}

async function readRawSpeechInput(request: Request, contentType: string) {
  const actor = request.headers.get('x-reed-speech-actor');
  if (typeof actor !== 'string' || !ALLOWED_ACTORS.has(actor)) {
    throw new SpeechRequestError('Invalid transcription target.');
  }

  const bytes = await request.arrayBuffer().catch(() => null);
  if (!bytes || bytes.byteLength <= 0) {
    throw new SpeechRequestError('Missing audio recording.');
  }

  return {
    actor: actor as SpeechActor,
    file: new File([bytes], getSpeechFilename(request), {
      type: contentType || 'application/octet-stream',
    }),
  };
}

function getSpeechFilename(request: Request) {
  const filename = request.headers.get('x-reed-speech-filename')?.trim();
  if (!filename) return 'speech.m4a';
  return filename.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80) || 'speech.m4a';
}

class SpeechRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpeechRequestError';
  }
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
    },
    status,
  });
}

export function speechCorsResponse() {
  return new Response(null, {
    headers: corsHeaders(),
    status: 204,
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Headers': 'authorization, content-type, x-reed-speech-actor, x-reed-speech-filename',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
  };
}

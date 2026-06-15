import type { GenericCtx } from '@convex-dev/better-auth';
import type { DataModel } from './_generated/dataModel';
import { authComponent } from './auth';
import { SpeechServiceError, transcribeSpeech, type SpeechActor } from './speech';

const ALLOWED_ACTORS = new Set(['chat', 'session_notes']);

export async function transcribeSpeechHttp(ctx: GenericCtx<DataModel>, request: Request) {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) {
    return jsonResponse({ error: 'Not authenticated.', code: 'unauthorized' }, 401);
  }

  let formData: Pick<globalThis.FormData, 'get'>;
  try {
    formData = await request.formData() as unknown as Pick<globalThis.FormData, 'get'>;
  } catch {
    return jsonResponse({ error: 'Invalid transcription request.', code: 'bad_request' }, 400);
  }

  const actor = formData.get('actor');
  const file = formData.get('audio');
  if (actor !== 'chat' && actor !== 'session_notes' && typeof actor !== 'string') {
    return jsonResponse({ error: 'Invalid transcription target.', code: 'bad_request' }, 400);
  }
  if (typeof actor !== 'string' || !ALLOWED_ACTORS.has(actor)) {
    return jsonResponse({ error: 'Invalid transcription target.', code: 'bad_request' }, 400);
  }
  if (!(file instanceof File)) {
    return jsonResponse({ error: 'Missing audio recording.', code: 'bad_request' }, 400);
  }

  try {
    const result = await transcribeSpeech({ actor: actor as SpeechActor, file });
    return jsonResponse(result, 200);
  } catch (error) {
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
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
  };
}

import { beforeEach, expect, test, vi } from 'vitest';
import type { ActionCtx } from './_generated/server';
import { transcribeSpeechHttp } from './speechHttp';
const transcribe = vi.hoisted(() => vi.fn(async (_input: { actor: string; file: File }) => ({ text: 'I prefer morning sessions.' })));
vi.mock('./speech', () => ({
  transcribeSpeech: transcribe,
  SpeechServiceError: class extends Error { code = 'retryable'; },
}));
const context = (signedIn = true) => ({ auth: { getUserIdentity: async () => signedIn ? { subject: 'test' } : null } }) as ActionCtx;
beforeEach(() => transcribe.mockClear());

test.each(['raw', 'multipart'])('authenticated onboarding voice notes accept %s audio', async format => {
  const audio = new File(['audio-fixture'], 'note.webm', { type: 'audio/webm' });
  const form = new FormData();
  form.set('actor', 'onboarding_notes'); form.set('audio', audio);
  const request = new Request('https://example.test/speech/transcribe', format === 'raw'
    ? { method: 'POST', body: audio, headers: { 'content-type': 'audio/webm', 'x-reed-speech-actor': 'onboarding_notes' } }
    : { method: 'POST', body: form });
  const response = await transcribeSpeechHttp(context(), request);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ text: 'I prefer morning sessions.' });
  expect(transcribe.mock.calls[0]?.[0]).toMatchObject({ actor: 'onboarding_notes' });
});
test('onboarding transcription stays authenticated and rejects unknown actors', async () => {
  const request = () => new Request('https://example.test/speech/transcribe', { method: 'POST', body: 'audio', headers: { 'x-reed-speech-actor': 'invalid' } });
  expect((await transcribeSpeechHttp(context(false), request())).status).toBe(401);
  expect((await transcribeSpeechHttp(context(), request())).status).toBe(400);
  expect(transcribe).not.toHaveBeenCalled();
});

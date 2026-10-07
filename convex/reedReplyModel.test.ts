// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { invokeCoachReply } from './reedReplyModel';
import { coachReplyPreset } from './aiSettingsValues';

const primary = coachReplyPreset('z-ai/glm-5.3-flash');
const backup = coachReplyPreset('minimax/minimax-m3');
const prompt = { system: 'Return a JSON response.', user: 'Synthetic retry check.' };
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('OPENROUTER_API_KEY', 'test-placeholder');
  vi.stubEnv('LANGFUSE_PUBLIC_KEY', '');
  vi.stubEnv('LANGFUSE_SECRET_KEY', '');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function completion(content: string, finishReason = 'stop') {
  return new Response(JSON.stringify({ id: 'synthetic', choices: [{ index: 0, finish_reason: finishReason, message: { role: 'assistant', content } }], usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } }), { headers: { 'Content-Type': 'application/json' } });
}
function upstreamError() {
  return new Response(JSON.stringify({ error: { message: 'Synthetic provider failure.' } }), { status: 503, headers: { 'Content-Type': 'application/json' } });
}
function requests(responses: (() => Response)[]) {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input, init) => {
    expect(String(input)).toBe('https://openrouter.ai/api/v1/chat/completions');
    bodies.push(JSON.parse(String(init?.body)));
    return responses[Math.min(bodies.length - 1, responses.length - 1)]();
  }));
  return bodies;
}
async function finish<T>(pending: Promise<T>) {
  // Real LangChain/OpenAI requests with synthetic HTTP responses, not a mocked retry loop.
  await vi.advanceTimersByTimeAsync(5000);
  return await pending;
}

test('a successful primary needs one request and no recovery status', async () => {
  const bodies = requests([() => completion('{"response":"Ready."}')]);
  const progress = vi.fn();
  expect(await finish(invokeCoachReply(prompt, primary, backup, progress))).toEqual({ response: 'Ready.' });
  expect(bodies.map(b => b.model)).toEqual([primary.model]);
  expect(progress).not.toHaveBeenCalled();
});

test('one error retries the primary with the same prompt and publishes recovery', async () => {
  const bodies = requests([upstreamError, () => completion('{"response":"Recovered."}')]);
  const progress = vi.fn();
  await finish(invokeCoachReply(prompt, primary, backup, progress));
  expect(bodies.map(b => b.model)).toEqual([primary.model, primary.model]);
  expect(bodies[1].messages).toEqual(bodies[0].messages);
  expect(progress.mock.calls).toEqual([['retrying']]);
});

test('two failures use the backup once with its own contract, and the next turn returns to the primary', async () => {
  const bodies = requests([upstreamError, upstreamError, () => completion('{"response":"Backup reply.","replies":["Yes"]}')]);
  const progress = vi.fn();
  expect(await finish(invokeCoachReply(prompt, primary, backup, progress))).toEqual({ response: 'Backup reply.', replies: ['Yes'] });
  expect(bodies.map(b => b.model)).toEqual([primary.model, primary.model, backup.model]);
  expect(progress.mock.calls).toEqual([['retrying'], ['backup']]);
  expect(bodies[2].messages).toEqual(bodies[0].messages);
  expect(bodies[2].reasoning).toEqual({ enabled: true, exclude: true });
  expect(bodies[2].provider).toMatchObject({ only: backup.routing.providers, max_price: backup.routing.maxPrice });
  await finish(invokeCoachReply(prompt, primary, backup, progress));
  expect(bodies.at(-1)?.model).toBe(primary.model);
  expect(primary.model).toBe('z-ai/glm-5.3-flash');
});

test('three errors reject after exactly three HTTP calls, including invalid and exhausted output', async () => {
  const bodies = requests([() => completion(''), () => completion('{"response":null}'), () => completion('{"response":"Truncated"}', 'length')]);
  const progress = vi.fn();
  const rejected = expect(invokeCoachReply(prompt, primary, backup, progress)).rejects.toThrow('token budget');
  await vi.advanceTimersByTimeAsync(5000);
  await rejected;
  expect(bodies.map(b => b.model)).toEqual([primary.model, primary.model, backup.model]);
  expect(progress.mock.calls).toEqual([['retrying'], ['backup']]);
});

test('a timed-out request is aborted before retry, and its late response cannot win', async () => {
  let firstSignal: AbortSignal | undefined;
  let releaseFirst: ((response: Response) => void) | undefined;
  let count = 0;
  vi.stubGlobal('fetch', vi.fn(async (_input, init) => {
    count++;
    if (count > 1) return completion('{"response":"Retry won."}');
    firstSignal = init.signal;
    return await new Promise<Response>(resolve => { releaseFirst = resolve; });
  }));
  const progress = vi.fn();
  const pending = invokeCoachReply(prompt, primary, backup, progress);
  await vi.advanceTimersByTimeAsync(90_000);
  expect(firstSignal?.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await pending).toEqual({ response: 'Retry won.' });
  releaseFirst?.(completion('{"response":"Late discarded response."}'));
  await vi.advanceTimersByTimeAsync(0);
  expect(count).toBe(2);
  expect(progress.mock.calls).toEqual([['retrying']]);
});

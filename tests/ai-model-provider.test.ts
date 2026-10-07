import assert from 'node:assert/strict';
import test from 'node:test';
import { createChatModel, openRouterRequestSettings, providerForModel, supportedModelSettings } from '../convex/aiModelProvider';
import { coachReplyPreset, validateCoachReplySettings } from '../convex/aiSettingsValues';

test('configured Reed chat models route to their own provider', () => {
  assert.equal(providerForModel('grok-4.3'), 'xai');
  assert.equal(providerForModel('gpt-5.1-mini'), 'openai');
  assert.equal(providerForModel('o3'), 'openai');
  assert.equal(providerForModel('gemini-2.5-flash'), 'google');
  assert.throws(() => providerForModel('unsupported'), /Unsupported AI model provider/);
});

test('OpenRouter presets preserve the model-specific reasoning contract and bounded routing', () => {
  for (const model of ['z-ai/glm-5.3-flash', 'deepseek/deepseek-v4.1-flash', 'minimax/minimax-m3'] as const) {
    assert.equal(providerForModel(model), 'openrouter');
    const preset = coachReplyPreset(model);
    validateCoachReplySettings(preset);
    const request = openRouterRequestSettings(preset);
    assert.equal(request.reasoning.enabled, true);
    assert.equal(request.reasoning.exclude, true);
    assert.equal(request.reasoning.effort, model === 'minimax/minimax-m3' ? undefined : 'low');
    assert.deepEqual(request.provider.only, preset.routing.providers);
    assert.equal(request.provider.require_parameters, true);
    assert.equal(request.provider.preferred_min_throughput, 60);
  }
  assert.throws(() => validateCoachReplySettings({ ...coachReplyPreset('minimax/minimax-m3'), reasoning: { mode: 'effort', effort: 'low' } }), /native reasoning/);
  assert.throws(() => validateCoachReplySettings({ ...coachReplyPreset('z-ai/glm-5.3-flash'), maxCompletionTokens: NaN }), /Completion budget/);
});

test('LangChain sends OpenRouter chat extensions and can bind tools for later agent steps', async () => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = 'test-placeholder';
  try {
    const preset = coachReplyPreset('deepseek/deepseek-v4.1-flash');
    let requestBody: Record<string, unknown> | undefined;
    globalThis.fetch = async (input, init) => {
      assert.match(String(input), /openrouter\.ai\/api\/v1\/chat\/completions$/);
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: 'test', model: preset.model, choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'A real reply.' } }], usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } }), { headers: { 'Content-Type': 'application/json' } });
    };
    const model = createChatModel({ modelName: preset.model, openRouter: preset, maxRetries: 0 });
    const reply = await model.bindTools([{ type: 'function', function: { name: 'readTraining', description: 'Read training context', parameters: { type: 'object', properties: {} } } }]).invoke('Hello');
    assert.equal(reply.content, 'A real reply.');
    assert.equal(requestBody?.model, preset.model);
    assert.equal(requestBody?.max_tokens, 8192);
    assert.deepEqual(requestBody?.reasoning, { effort: 'low', enabled: true, exclude: true });
    assert.deepEqual(requestBody?.provider, openRouterRequestSettings(preset).provider);
    assert.equal((requestBody?.tools as unknown[]).length, 1);
    assert.equal(requestBody?.reasoning_effort, undefined);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  }
});

test('chat model settings retain xAI temperature and omit it for GPT-5', () => {
  assert.equal(supportedModelSettings({ modelName: 'grok-4.3', temperature: 0.45 }).temperature, 0.45);
  assert.equal(supportedModelSettings({ modelName: 'gpt-5.1-mini', temperature: 0.45 }).temperature, undefined);
});

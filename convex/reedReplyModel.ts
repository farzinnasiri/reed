"use node";

import { HumanMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createChatModel } from './aiModelProvider';
import { validateCoachReplySettings, type CoachReplySettings } from './aiSettingsValues';
import { traceText, withLangfuseGeneration } from './langfuseTracing';
import { parseReedChatResult, REED_PRESENTATION_PROMPT_VERSION } from './reedWidgets';

const ATTEMPT_TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 900;
export type ReplyRecoveryPhase = 'retrying' | 'backup';

/** Two primary attempts, then one backup, all using this turn's settings and prompt. */
export async function invokeCoachReply(
  prompt: { system: string; user: string },
  primary: CoachReplySettings,
  backup: CoachReplySettings,
  onRecovery: (phase: ReplyRecoveryPhase) => Promise<unknown>,
) {
  validateCoachReplySettings(primary);
  validateCoachReplySettings(backup);
  if (primary.model === backup.model) throw new Error('The backup must use a different coach model.');
  for (let attempt = 1; attempt <= 3; attempt++) {
    const settings = attempt === 3 ? backup : primary;
    try {
      return await withLangfuseGeneration({
        input: { system: traceText(prompt.system), user: traceText(prompt.user) },
        model: settings.model,
        modelParameters: { reasoningEffort: settings.reasoning.mode === 'effort' ? settings.reasoning.effort : 'native', maxCompletionTokens: settings.maxCompletionTokens, temperature: 0.45 },
        name: 'reed.chat.model',
        metadata: { attempt, backup: attempt === 3, outputContract: REED_PRESENTATION_PROMPT_VERSION, modelProvider: 'openrouter', routing: settings.routing },
      }, () => invokeOnce(prompt, settings));
    } catch (error) {
      // Provider errors can contain request content. Operational logs use safe metadata only.
      console.error('[REED_CHAT_MODEL_ATTEMPT_FAILED]', { attempt, model: settings.model });
      if (attempt === 3) throw error;
    }
    await onRecovery(attempt === 1 ? 'retrying' : 'backup');
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
  }
  throw new Error('Coach reply attempts exhausted.');
}

async function invokeOnce(prompt: { system: string; user: string }, settings: CoachReplySettings) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      generateReply(prompt, settings, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Coach model response timed out.'));
        }, ATTEMPT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function generateReply(prompt: { system: string; user: string }, settings: CoachReplySettings, signal: AbortSignal) {
  const model = createChatModel({ modelName: settings.model, temperature: 0.45, maxRetries: 0, openRouter: settings });
  const agent = createAgent({ model, tools: [], systemPrompt: prompt.system });
  const result = await agent.invoke({ messages: [new HumanMessage(prompt.user)] }, { recursionLimit: 4, signal });
  const message = result.messages.at(-1);
  const metadata = message?.response_metadata;
  if (metadata && 'finish_reason' in metadata && metadata.finish_reason === 'length') throw new Error('Coach completion exhausted its token budget.');
  const content = message?.content;
  const text = typeof content === 'string' ? content : Array.isArray(content)
    ? content.map(part => typeof part === 'string' ? part : 'text' in part && typeof part.text === 'string' ? part.text : '').join('') : '';
  // Invalid envelopes and empty output are failures, not canned coaching answers. The parser
  // still recovers usable text when optional presentation metadata is malformed.
  const reply = parseReedChatResult(text, '');
  if (!reply.response.trim()) throw new Error('Coach model returned an unusable response.');
  return reply;
}

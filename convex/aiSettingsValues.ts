import { v, type Infer } from 'convex/values';

export const coachModelValidator = v.union(
  v.literal('z-ai/glm-5.3-flash'),
  v.literal('deepseek/deepseek-v4.1-flash'),
  v.literal('minimax/minimax-m3'),
);
export const coachReplySettingsValidator = v.object({
  model: coachModelValidator,
  reasoning: v.union(
    v.object({ mode: v.literal('effort'), effort: v.union(v.literal('low'), v.literal('high'), v.literal('max')) }),
    v.object({ mode: v.literal('native') }),
  ),
  maxCompletionTokens: v.number(),
  routing: v.object({
    providers: v.array(v.string()),
    preferredMinThroughput: v.number(),
    maxPrice: v.object({ prompt: v.number(), completion: v.number() }),
  }),
});
export type CoachReplySettings = Infer<typeof coachReplySettingsValidator>;
export type CoachModel = CoachReplySettings['model'];

// Only this model is active by default. Alternatives are selected through aiSettings.setCoachReply.
const DEFAULT_COACH_MODEL: CoachModel = 'z-ai/glm-5.3-flash';
// const DEFAULT_COACH_MODEL: CoachModel = 'deepseek/deepseek-v4.1-flash';
// const DEFAULT_COACH_MODEL: CoachModel = 'minimax/minimax-m3';

export function coachReplyPreset(model: CoachModel): CoachReplySettings {
  return {
    model,
    reasoning: model === 'minimax/minimax-m3' ? { mode: 'native' } : { mode: 'effort', effort: 'low' },
    // Reasoning and visible output share this budget. Leave room for the structured reply.
    maxCompletionTokens: 8192,
    routing: {
      providers: model === 'z-ai/glm-5.3-flash' ? ['coreweave', 'fireworks/us']
        : model === 'deepseek/deepseek-v4.1-flash' ? ['relace', 'wafer'] : ['parasail', 'novita'],
      preferredMinThroughput: 60,
      // USD per million tokens, as required by OpenRouter's max_price contract.
      maxPrice: model === 'z-ai/glm-5.3-flash' ? { prompt: 0.25, completion: 0.8 }
        : { prompt: 0.35, completion: 1.3 },
    },
  };
}

export function defaultAiSettings() {
  return { coachReply: coachReplyPreset(DEFAULT_COACH_MODEL), coachReplyBackup: defaultCoachReplyBackup(DEFAULT_COACH_MODEL), revision: 0, updatedAt: 0 };
}

export function defaultCoachReplyBackup(primary: CoachModel): CoachReplySettings {
  return coachReplyPreset(primary === 'deepseek/deepseek-v4.1-flash' ? 'z-ai/glm-5.3-flash' : 'deepseek/deepseek-v4.1-flash');
}

export function validateCoachReplySettings(settings: CoachReplySettings) {
  if ((settings.model === 'minimax/minimax-m3') !== (settings.reasoning.mode === 'native')) {
    throw new Error('MiniMax M3 uses native reasoning; GLM and DeepSeek require an effort setting.');
  }
  const { routing, maxCompletionTokens } = settings;
  if (!Number.isSafeInteger(maxCompletionTokens) || maxCompletionTokens < 4096 || maxCompletionTokens > 32768) {
    throw new Error('Completion budget must be an integer between 4096 and 32768 tokens.');
  }
  if (routing.providers.length < 1 || routing.providers.length > 8
    || routing.providers.some(provider => !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(provider))) {
    throw new Error('Choose between one and eight OpenRouter provider slugs.');
  }
  if (!Number.isFinite(routing.preferredMinThroughput) || routing.preferredMinThroughput <= 50 || routing.preferredMinThroughput > 1000) {
    throw new Error('Preferred throughput must be greater than 50 and at most 1000 tokens/second.');
  }
  for (const price of Object.values(routing.maxPrice)) {
    if (!Number.isFinite(price) || price <= 0 || price > 100) throw new Error('Price ceilings must be positive USD per million tokens, at most 100.');
  }
}

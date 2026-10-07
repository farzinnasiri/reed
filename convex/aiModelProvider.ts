import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatXAI } from '@langchain/xai';
import { validateCoachReplySettings, type CoachReplySettings } from './aiSettingsValues';

export type AiModelProvider = 'google' | 'openai' | 'xai' | 'openrouter';

export function providerForModel(modelName: string): AiModelProvider {
  const normalized = modelName.trim().toLowerCase();
  if (normalized.includes('/')) return 'openrouter';
  if (normalized.startsWith('grok')) return 'xai';
  if (normalized.startsWith('gemini')) return 'google';
  if (normalized.startsWith('gpt') || normalized.startsWith('o') || normalized.startsWith('chatgpt')) return 'openai';
  throw new Error(`Unsupported AI model provider for model "${modelName}".`);
}

export function hasApiKeyForModel(modelName: string) {
  const provider = providerForModel(modelName);
  if (provider === 'openrouter') return Boolean(process.env.OPENROUTER_API_KEY);
  if (provider === 'xai') return Boolean(process.env.XAI_API_KEY);
  if (provider === 'google') return Boolean(process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY);
  return Boolean(process.env.OPENAI_API_KEY);
}

export function modelSupportsTemperature(modelName: string) {
  const normalized = modelName.trim().toLowerCase();
  return !(providerForModel(modelName) === 'openai' && normalized.startsWith('gpt-5'));
}

export function supportedModelSettings(args: {
  modelName: string;
  reasoningEffort?: string;
  temperature?: number;
}) {
  return {
    reasoningEffort: args.reasoningEffort,
    temperature: modelSupportsTemperature(args.modelName) ? args.temperature : undefined,
  };
}

export function createChatModel(args: {
  maxRetries?: number;
  modelName: string;
  reasoningEffort?: string;
  temperature?: number;
  openRouter?: CoachReplySettings;
}) {
  const provider = providerForModel(args.modelName);
  const settings = supportedModelSettings(args);
  if (provider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) throw new Error('OpenRouter API key is not configured.');
    if (!args.openRouter || args.openRouter.model !== args.modelName) throw new Error('OpenRouter model settings are required and must match the model.');
    validateCoachReplySettings(args.openRouter);
    const config = args.openRouter;
    return new ChatOpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      model: args.modelName,
      useResponsesApi: false,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'X-OpenRouter-Title': 'Reed' },
      },
      temperature: settings.temperature,
      maxRetries: args.maxRetries ?? 1,
      maxTokens: config.maxCompletionTokens,
      modelKwargs: openRouterRequestSettings(config),
    });
  }
  if (provider === 'xai') {
    if (!process.env.XAI_API_KEY) throw new Error(`xAI API key is not configured for ${args.modelName}.`);
    return new ChatXAI({
      apiKey: process.env.XAI_API_KEY,
      model: args.modelName,
      temperature: settings.temperature,
      maxRetries: args.maxRetries ?? 1,
      reasoningEffort: settings.reasoningEffort,
    } as ConstructorParameters<typeof ChatXAI>[0] & { reasoningEffort?: string });
  }
  if (provider === 'google') {
    const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error(`Google API key is not configured for ${args.modelName}.`);
    return new ChatGoogleGenerativeAI({
      apiKey,
      model: args.modelName,
      temperature: settings.temperature,
      maxRetries: args.maxRetries ?? 1,
    });
  }

  if (!process.env.OPENAI_API_KEY) throw new Error(`OpenAI API key is not configured for ${args.modelName}.`);
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: args.modelName,
    temperature: settings.temperature,
    maxRetries: args.maxRetries ?? 1,
    reasoning: settings.reasoningEffort ? { effort: settings.reasoningEffort } : undefined,
  } as ConstructorParameters<typeof ChatOpenAI>[0] & { reasoning?: { effort: string } });
}

/** OpenRouter's Chat Completions extensions stay here, outside the agent workflow. */
export function openRouterRequestSettings(config: CoachReplySettings) {
  return {
    reasoning: config.reasoning.mode === 'effort'
      ? { effort: config.reasoning.effort, enabled: true, exclude: true }
      : { enabled: true, exclude: true },
    provider: {
      only: config.routing.providers,
      allow_fallbacks: true,
      require_parameters: true,
      sort: 'throughput',
      preferred_min_throughput: config.routing.preferredMinThroughput,
      max_price: config.routing.maxPrice,
    },
  };
}

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';

export type AiModelProvider = 'google' | 'openai';

export function providerForModel(modelName: string): AiModelProvider {
  const normalized = modelName.trim().toLowerCase();
  if (normalized.startsWith('gemini')) return 'google';
  if (normalized.startsWith('gpt') || normalized.startsWith('o') || normalized.startsWith('chatgpt')) return 'openai';
  throw new Error(`Unsupported AI model provider for model "${modelName}".`);
}

export function hasApiKeyForModel(modelName: string) {
  const provider = providerForModel(modelName);
  if (provider === 'google') return Boolean(process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY);
  return Boolean(process.env.OPENAI_API_KEY);
}

export function createChatModel(args: {
  maxRetries?: number;
  modelName: string;
  temperature?: number;
}) {
  const provider = providerForModel(args.modelName);
  if (provider === 'google') {
    const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error(`Google API key is not configured for ${args.modelName}.`);
    return new ChatGoogleGenerativeAI({
      apiKey,
      model: args.modelName,
      temperature: args.temperature,
      maxRetries: args.maxRetries ?? 1,
    });
  }

  if (!process.env.OPENAI_API_KEY) throw new Error(`OpenAI API key is not configured for ${args.modelName}.`);
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: args.modelName,
    temperature: args.temperature,
    maxRetries: args.maxRetries ?? 1,
  });
}

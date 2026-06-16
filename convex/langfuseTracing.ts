"use node";

import { startActiveObservation, startObservation, propagateAttributes } from '@langfuse/tracing';
import type { LangfuseGenerationAttributes } from '@langfuse/tracing';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

const MAX_TEXT_LENGTH = 4_000;
const MAX_OBJECT_DEPTH = 4;
const MAX_ARRAY_ITEMS = 12;
const MAX_OBJECT_KEYS = 24;

type LangfuseRuntime = {
  processor: LangfuseSpanProcessor | null;
  sdk: NodeSDK | null;
  startAttempted: boolean;
};

const globalRuntime = globalThis as typeof globalThis & { __reedLangfuseRuntime?: LangfuseRuntime };

export type ReedTraceOptions = {
  input?: unknown;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  name: string;
  output?: unknown;
  sessionId?: string | null;
  tags?: string[];
  userId?: string | null;
  version?: string;
};

export type ReedGenerationOptions = {
  input?: unknown;
  metadata?: Record<string, unknown>;
  model: string;
  modelParameters?: Record<string, string | number | undefined>;
  name: string;
  output?: unknown;
};

export function isLangfuseTracingEnabled() {
  return !!process.env.LANGFUSE_PUBLIC_KEY && !!process.env.LANGFUSE_SECRET_KEY;
}

export async function withLangfuseTrace<T>(options: ReedTraceOptions, fn: () => Promise<T>): Promise<T> {
  const runtime = ensureLangfuseRuntime();
  if (!runtime) return fn();

  return propagateAttributes(
    {
      metadata: safeMetadata(options.metadata),
      sessionId: shortString(options.sessionId ?? undefined),
      tags: options.tags?.map(tag => tag.slice(0, 200)),
      traceName: options.name,
      userId: shortString(options.userId ?? undefined),
      version: options.version,
    },
    async () => {
      try {
        return await startActiveObservation(options.name, async observation => {
          try {
            const result = await fn();
            observation.update({
              input: traceSafe(options.input),
              output: traceSafe(options.output ?? inferTraceOutput(result)),
            });
            return result;
          } catch (error) {
            observation.update({
              input: traceSafe(options.input),
              level: 'ERROR',
              statusMessage: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        }, { asType: 'span' });
      } finally {
        await flushLangfuse(runtime);
      }
    },
  );
}

export async function withLangfuseGeneration<T>(options: ReedGenerationOptions, fn: () => Promise<T>): Promise<T> {
  const runtime = ensureLangfuseRuntime();
  if (!runtime) return fn();

  const observation = startObservation(options.name, {
    input: traceSafe(options.input),
    metadata: traceSafe(options.metadata) as Record<string, unknown>,
    model: options.model,
    modelParameters: safeModelParameters(options.modelParameters),
  }, { asType: 'generation' });

  try {
    const result = await fn();
    observation.update({
      output: traceSafe(options.output ?? inferTraceOutput(result)),
    });
    return result;
  } catch (error) {
    observation.update({
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    observation.end();
  }
}

export function traceText(value: string, maxLength = MAX_TEXT_LENGTH) {
  return truncateText(value, maxLength);
}

export function traceSafe(value: unknown): unknown {
  return sanitizeValue(value, 0);
}

function ensureLangfuseRuntime() {
  if (!isLangfuseTracingEnabled()) return null;
  const existing = globalRuntime.__reedLangfuseRuntime;
  if (existing?.startAttempted) return existing.processor ? existing : null;

  const runtime: LangfuseRuntime = { processor: null, sdk: null, startAttempted: true };
  globalRuntime.__reedLangfuseRuntime = runtime;

  try {
    const processor = new LangfuseSpanProcessor({
      baseUrl: process.env.LANGFUSE_BASE_URL,
      environment: process.env.CONVEX_DEPLOYMENT?.startsWith('prod:') ? 'production' : 'development',
      exportMode: 'immediate',
      flushAt: 1,
      mask: ({ data }) => traceSafe(data),
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
    });
    const sdk = new NodeSDK({ spanProcessors: [processor] });
    sdk.start();
    runtime.processor = processor;
    runtime.sdk = sdk;
  } catch (error) {
    console.error('[LANGFUSE_INIT_ERROR]', error instanceof Error ? { message: error.message, stack: error.stack } : error);
  }

  return runtime.processor ? runtime : null;
}

async function flushLangfuse(runtime: LangfuseRuntime) {
  if (!runtime.processor) return;
  try {
    await runtime.processor.forceFlush();
  } catch (error) {
    console.error('[LANGFUSE_FLUSH_ERROR]', error instanceof Error ? { message: error.message } : error);
  }
}

function inferTraceOutput(value: unknown) {
  if (typeof value === 'string') return value;
  if (isRecord(value)) {
    const output: Record<string, unknown> = {};
    if (typeof value.response === 'string') output.response = value.response;
    if (Array.isArray(value.agenda)) output.agenda = value.agenda;
    if (typeof value.text === 'string') output.text = value.text;
    if (typeof value.content === 'string') output.content = value.content;
    if (Object.keys(output).length > 0) return output;
  }
  return undefined;
}

function safeMetadata(metadata: ReedTraceOptions['metadata']) {
  const safe: Record<string, string> = {};
  if (!metadata) return safe;
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    safe[key.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 200)] = String(value).slice(0, 200);
  }
  return safe;
}

function safeModelParameters(parameters: ReedGenerationOptions['modelParameters']) {
  const safe: LangfuseGenerationAttributes['modelParameters'] = {};
  if (!parameters) return safe;
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined) safe[key] = value;
  }
  return safe;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return truncateText(maskString(value), MAX_TEXT_LENGTH);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_OBJECT_DEPTH) return '[Truncated]';
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map(item => sanitizeValue(item, depth + 1));
  if (!isRecord(value)) return String(value);

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
    output[key] = isSensitiveKey(key) ? '[Redacted]' : sanitizeValue(nested, depth + 1);
  }
  return output;
}

function maskString(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [Redacted]')
    .replace(/(sk|pk)-[A-Za-z0-9_-]{12,}/g, '$1-[Redacted]');
}

function isSensitiveKey(key: string) {
  return /authorization|api[_-]?key|secret|password|token/i.test(key);
}

function truncateText(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...[truncated]`;
}

function shortString(value: string | undefined) {
  return value ? value.slice(0, 200) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

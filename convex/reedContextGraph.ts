"use node";

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { createChatModel, hasApiKeyForModel, providerForModel, supportedModelSettings } from './aiModelProvider';
import { traceText, withLangfuseGeneration, withLangfuseObservation } from './langfuseTracing';
import type { ReedContextBlock, ReedContextToolCall, ReedTimeRange } from './reedContextTypes';

const CONTEXT_AGENT_PROMPT_KEY = 'reed_context_agent_system';
const CONTEXT_AGENT_MODEL_NAME = process.env.REED_CONTEXT_AGENT_MODEL ?? 'gpt-5.4-mini-2026-03-17';
const CONTEXT_AGENT_REASONING_EFFORT = process.env.REED_CONTEXT_AGENT_REASONING_EFFORT ?? 'low';
const MAX_CONTEXT_GRAPH_ITERATIONS = 3;
const MAX_CONTEXT_GRAPH_TOOL_CALLS = 4;

const ReedContextGraphAnnotation = Annotation.Root({
  analysis: Annotation<string>,
  availableToolNames: Annotation<string[]>,
  blocks: Annotation<ReedContextBlock[]>,
  clientNow: Annotation<number>,
  clientTimeZone: Annotation<string | undefined>,
  currentCall: Annotation<ReedContextToolCall | null>,
  iteration: Annotation<number>,
  maxIterations: Annotation<number>,
  maxToolCalls: Annotation<number>,
  prompt: Annotation<string>,
  promptHash: Annotation<string>,
  reason: Annotation<string>,
  recentMessages: Annotation<Array<{ role: string; content: string; createdAt?: number }>>,
  safetyFlags: Annotation<string[]>,
  stopReason: Annotation<ReedAgentStopReason | null>,
  toolCalls: Annotation<ReedContextToolCall[]>,
  uncertainties: Annotation<string[]>,
  userMessage: Annotation<string>,
});

type ReedContextGraphState = typeof ReedContextGraphAnnotation.State;

type ReedAgentStopReason = 'enough_evidence' | 'max_iterations' | 'needs_clarification' | 'no_agent_needed';

export type ReedAgentEvidencePacket = {
  blocks: ReedContextBlock[];
  metadata: {
    modelName: string;
    modelProvider: string;
    promptHash: string;
    stopReason: ReedAgentStopReason;
    toolCalls: ReedContextToolCall[];
  };
  synthesisBlock: ReedContextBlock | null;
};

type PlannerDecision = {
  analysis: string;
  reason: string;
  safetyFlags: string[];
  status: 'call_tool' | 'enough_evidence' | 'needs_clarification';
  toolCall: ReedContextToolCall | null;
  uncertainties: string[];
};

export async function runReedContextGraph(ctx: ActionCtx, args: {
  clientNow: number;
  clientTimeZone?: string;
  profileId: Id<'profiles'>;
  recentMessages: Array<{ role: string; content: string; createdAt?: number }>;
  userMessage: string;
}): Promise<ReedAgentEvidencePacket> {
  const prompt = await ctx.runQuery(internal.reed.loadPromptByKey, { key: CONTEXT_AGENT_PROMPT_KEY });

  const agentModelStatus = getContextAgentModelStatus();
  if (!prompt || !agentModelStatus.ready) {
    const missingReason = !prompt ? 'the context agent prompt is not seeded' : agentModelStatus.reason;
    return buildEvidencePacket({
      analysis: `No model-planned context read ran because ${missingReason}.`,
      blocks: [],
      promptHash: prompt?.contentHash ?? 'missing',
      safetyFlags: [],
      stopReason: 'no_agent_needed',
      toolCalls: [],
      uncertainties: [],
    });
  }

  const graph = buildGraph(ctx, {
    clientNow: args.clientNow,
    clientTimeZone: args.clientTimeZone,
    profileId: args.profileId,
  });

  const initialState = {
    analysis: '',
    availableToolNames: [
      'summarize_training_window',
      'get_bodyweight_trend',
      'get_exercise_performance_history',
      'get_training_goals',
    ],
    blocks: [],
    clientNow: args.clientNow,
    clientTimeZone: args.clientTimeZone,
    currentCall: null,
    iteration: 0,
    maxIterations: MAX_CONTEXT_GRAPH_ITERATIONS,
    maxToolCalls: MAX_CONTEXT_GRAPH_TOOL_CALLS,
    prompt: prompt.content,
    promptHash: prompt.contentHash,
    reason: '',
    recentMessages: args.recentMessages,
    safetyFlags: [],
    stopReason: null,
    toolCalls: [],
    uncertainties: [],
    userMessage: args.userMessage,
  };
  const result = await withLangfuseObservation({
    input: {
      user: traceText(args.userMessage),
    },
    metadata: {
      maxIterations: MAX_CONTEXT_GRAPH_ITERATIONS,
      maxToolCalls: MAX_CONTEXT_GRAPH_TOOL_CALLS,
      promptHash: prompt.contentHash,
    },
    name: 'reed.context_agent.graph',
    type: 'agent',
    version: CONTEXT_AGENT_MODEL_NAME,
  }, async () => graph.invoke(initialState, { recursionLimit: 12 }));

  return buildEvidencePacket({
    analysis: result.analysis,
    blocks: result.blocks,
    promptHash: prompt.contentHash,
    safetyFlags: result.safetyFlags,
    stopReason: result.stopReason ?? (result.blocks.length > 0 ? 'enough_evidence' : 'no_agent_needed'),
    toolCalls: result.toolCalls,
    uncertainties: result.uncertainties,
  });
}

function buildGraph(ctx: ActionCtx, scope: { clientNow: number; clientTimeZone?: string; profileId: Id<'profiles'> }) {
  const graph = new StateGraph(ReedContextGraphAnnotation)
    .addNode('plan_next_read', async (state: ReedContextGraphState) => planNextRead(state))
    .addNode('execute_read_tool', async (state: ReedContextGraphState) => executeReadTool(ctx, scope, state))
    .addNode('synthesize', async (state: ReedContextGraphState) => synthesize(state))
    .addEdge(START, 'plan_next_read')
    .addConditionalEdges('plan_next_read', routeAfterPlan, {
      execute_read_tool: 'execute_read_tool',
      synthesize: 'synthesize',
    })
    .addConditionalEdges('execute_read_tool', routeAfterTool, {
      plan_next_read: 'plan_next_read',
      synthesize: 'synthesize',
    })
    .addEdge('synthesize', END);

  return graph.compile();
}

async function planNextRead(state: ReedContextGraphState): Promise<Partial<ReedContextGraphState>> {
  if (state.iteration >= state.maxIterations || state.toolCalls.length >= state.maxToolCalls) {
    return { currentCall: null, stopReason: 'max_iterations' };
  }

  const decision = await invokePlanner(state);
  if (decision.status === 'call_tool' && decision.toolCall && !hasCall(state.toolCalls, decision.toolCall)) {
    return {
      analysis: decision.analysis,
      currentCall: decision.toolCall,
      reason: decision.reason,
      safetyFlags: decision.safetyFlags,
      stopReason: null,
      uncertainties: decision.uncertainties,
    };
  }

  return {
    analysis: decision.analysis,
    currentCall: null,
    reason: decision.reason,
    safetyFlags: decision.safetyFlags,
    stopReason: decision.status === 'needs_clarification' ? 'needs_clarification' : 'enough_evidence',
    uncertainties: decision.uncertainties,
  };
}

async function executeReadTool(
  ctx: ActionCtx,
  scope: { clientNow: number; clientTimeZone?: string; profileId: Id<'profiles'> },
  state: ReedContextGraphState,
): Promise<Partial<ReedContextGraphState>> {
  if (!state.currentCall || hasCall(state.toolCalls, state.currentCall) || state.toolCalls.length >= state.maxToolCalls) {
    return {
      currentCall: null,
      stopReason: state.toolCalls.length >= state.maxToolCalls ? 'max_iterations' : state.stopReason,
    };
  }

  const call = state.currentCall;
  const blocks: ReedContextBlock[] = await withLangfuseObservation({
    input: call,
    metadata: {
      iteration: state.iteration + 1,
      toolName: call.name,
    },
    name: `reed.context_agent.tool.${call.name}`,
    type: 'tool',
    version: 'reed-context-tools',
  }, async () => ctx.runQuery(internal.reedContextTools.runContextTools, {
    calls: [call],
    clientNow: scope.clientNow,
    clientTimeZone: scope.clientTimeZone,
    profileId: scope.profileId,
  }));

  return {
    blocks: [...state.blocks, ...blocks],
    currentCall: null,
    iteration: state.iteration + 1,
    toolCalls: [...state.toolCalls, call],
  };
}

async function synthesize(state: ReedContextGraphState): Promise<Partial<ReedContextGraphState>> {
  if (state.analysis.trim()) return {};
  if (state.blocks.length === 0) {
    return {
      analysis: state.stopReason === 'needs_clarification'
        ? 'The current request needs one narrow clarification before app history would be useful.'
        : 'No app-data read was necessary for this turn.',
    };
  }

  return {
    analysis: [
      `Gathered ${state.blocks.length} context block${state.blocks.length === 1 ? '' : 's'} for the final coaching response.`,
      state.reason ? `Last planner reason: ${state.reason}` : '',
    ].filter(Boolean).join(' '),
  };
}

function routeAfterPlan(state: ReedContextGraphState) {
  return state.currentCall ? 'execute_read_tool' : 'synthesize';
}

function routeAfterTool(state: ReedContextGraphState) {
  if (state.iteration >= state.maxIterations || state.toolCalls.length >= state.maxToolCalls) return 'synthesize';
  return 'plan_next_read';
}

async function invokePlanner(state: ReedContextGraphState): Promise<PlannerDecision> {
  const modelSettings = supportedModelSettings({
    modelName: CONTEXT_AGENT_MODEL_NAME,
    reasoningEffort: CONTEXT_AGENT_REASONING_EFFORT,
    temperature: 0,
  });
  const model = createChatModel({
    modelName: CONTEXT_AGENT_MODEL_NAME,
    maxRetries: 0,
    reasoningEffort: modelSettings.reasoningEffort,
    temperature: modelSettings.temperature,
  });

  const userPrompt = buildPlannerUserPrompt(state);
  const result = await withLangfuseGeneration({
    input: {
      system: traceText(state.prompt),
      user: traceText(userPrompt),
    },
    model: CONTEXT_AGENT_MODEL_NAME,
    metadata: {
      contextBlockCount: state.blocks.length,
      contextBlockTitles: state.blocks.map(block => block.title),
      iteration: state.iteration,
      promptHash: state.promptHash,
      recentMessageCount: state.recentMessages.length,
      toolCallCount: state.toolCalls.length,
    },
    modelParameters: modelSettings,
    name: 'reed.context_agent.plan',
  }, async () => model.invoke([
    new SystemMessage(state.prompt),
    new HumanMessage(userPrompt),
  ]));

  return parsePlannerDecision(textFromContent(result.content));
}

function buildPlannerUserPrompt(state: ReedContextGraphState) {
  return [
    `Current local time: ${formatCurrentTime(state.clientNow, state.clientTimeZone)}`,
    `Tool budget: ${state.toolCalls.length}/${state.maxToolCalls} calls used. Iteration: ${state.iteration}/${state.maxIterations}.`,
    `Available tools: ${state.availableToolNames.join(', ')}`,
    '',
    'Current user message:',
    state.userMessage,
    '',
    'Recent messages:',
    ...state.recentMessages.slice(-6).map(message => `- ${message.role.toUpperCase()}: ${message.content.slice(0, 500)}`),
    '',
    'Already called tools:',
    ...(state.toolCalls.length === 0 ? ['- none'] : state.toolCalls.map(call => `- ${JSON.stringify(call)}`)),
    '',
    'Evidence gathered so far:',
    ...(state.blocks.length === 0 ? ['- none'] : state.blocks.map(block => `- ${block.title}: ${block.content.slice(0, 900)}`)),
  ].join('\n');
}

function parsePlannerDecision(text: string): PlannerDecision {
  const parsed = parseJsonObject(text);
  if (!parsed) return fallbackDecision('Planner returned invalid JSON.');
  const status = parsed.status === 'call_tool' || parsed.status === 'needs_clarification' || parsed.status === 'enough_evidence'
    ? parsed.status
    : 'enough_evidence';
  const toolCall = status === 'call_tool' ? parseToolCall(parsed.toolCall) : null;
  if (status === 'call_tool' && !toolCall) return fallbackDecision('Planner requested an invalid or unavailable tool.');
  return {
    analysis: typeof parsed.analysis === 'string' ? parsed.analysis.slice(0, 1000) : '',
    reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 500) : '',
    safetyFlags: parseStringList(parsed.safetyFlags, 6),
    status,
    toolCall,
    uncertainties: parseStringList(parsed.uncertainties, 6),
  };
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const direct = JSON.parse(text);
    return isObject(direct) ? direct : null;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const extracted = JSON.parse(match[0]);
      return isObject(extracted) ? extracted : null;
    } catch {
      return null;
    }
  }
}

function parseToolCall(value: unknown): ReedContextToolCall | null {
  if (!isObject(value) || typeof value.name !== 'string' || !isObject(value.args)) return null;
  if (value.name === 'summarize_training_window' && isTimeRange(value.args.range)) {
    return { name: value.name, args: { range: value.args.range } };
  }
  if (value.name === 'get_bodyweight_trend' && isTimeRange(value.args.range)) {
    return { name: value.name, args: { range: value.args.range } };
  }
  if (value.name === 'get_exercise_performance_history' && typeof value.args.exerciseQuery === 'string' && isTimeRange(value.args.range)) {
    return {
      name: value.name,
      args: { exerciseQuery: value.args.exerciseQuery.slice(0, 80), range: value.args.range },
    };
  }
  if (value.name === 'get_training_goals') {
    return {
      name: value.name,
      args: {
        ...(isGoalStatus(value.args.status) ? { status: value.args.status } : {}),
        ...(typeof value.args.limit === 'number' ? { limit: Math.max(1, Math.min(50, Math.round(value.args.limit))) } : {}),
      },
    };
  }
  return null;
}

function buildEvidencePacket(args: {
  analysis: string;
  blocks: ReedContextBlock[];
  promptHash: string;
  safetyFlags: string[];
  stopReason: ReedAgentStopReason;
  toolCalls: ReedContextToolCall[];
  uncertainties: string[];
}): ReedAgentEvidencePacket {
  const synthesisBlock = buildSynthesisBlock(args);
  return {
    blocks: synthesisBlock ? [...args.blocks, synthesisBlock] : args.blocks,
    metadata: {
      modelName: CONTEXT_AGENT_MODEL_NAME,
      modelProvider: providerForModelSafe(CONTEXT_AGENT_MODEL_NAME),
      promptHash: args.promptHash,
      stopReason: args.stopReason,
      toolCalls: args.toolCalls,
    },
    synthesisBlock,
  };
}

function buildSynthesisBlock(args: {
  analysis: string;
  blocks: ReedContextBlock[];
  safetyFlags: string[];
  stopReason: ReedAgentStopReason;
  toolCalls: ReedContextToolCall[];
  uncertainties: string[];
}) {
  if (!args.analysis.trim() && args.uncertainties.length === 0 && args.safetyFlags.length === 0 && args.toolCalls.length === 0) {
    return null;
  }
  return {
    title: 'Reed context agent synthesis',
    content: [
      `Stop reason: ${args.stopReason}.`,
      `Read calls: ${args.toolCalls.length === 0 ? 'none' : args.toolCalls.map(call => call.name).join(', ')}.`,
      args.analysis.trim() ? `Analysis: ${args.analysis.trim()}` : '',
      args.uncertainties.length > 0 ? `Uncertainties: ${args.uncertainties.join('; ')}` : '',
      args.safetyFlags.length > 0 ? `Safety flags: ${args.safetyFlags.join('; ')}` : '',
    ].filter(Boolean).join('\n'),
  };
}

function fallbackDecision(reason: string): PlannerDecision {
  return {
    analysis: '',
    reason,
    safetyFlags: [],
    status: 'enough_evidence',
    toolCall: null,
    uncertainties: [reason],
  };
}

function getContextAgentModelStatus() {
  try {
    return hasApiKeyForModel(CONTEXT_AGENT_MODEL_NAME)
      ? { ready: true, reason: null }
      : { ready: false, reason: 'the context agent model is not configured' };
  } catch (error) {
    return {
      ready: false,
      reason: error instanceof Error ? error.message : 'the context agent model is misconfigured',
    };
  }
}

function providerForModelSafe(modelName: string) {
  try {
    return providerForModel(modelName);
  } catch {
    return 'unsupported';
  }
}

function hasCall(calls: ReedContextToolCall[], call: ReedContextToolCall) {
  const key = callKey(call);
  return calls.some(existing => callKey(existing) === key);
}

function callKey(call: ReedContextToolCall) {
  return JSON.stringify(call);
}

function parseStringList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => typeof item === 'string')
    .map(item => item.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, limit);
}

function isGoalStatus(value: unknown): value is NonNullable<Extract<ReedContextToolCall, { name: 'get_training_goals' }>['args']['status']> {
  return value === 'all' || value === 'active' || value === 'completed' || value === 'missed' || value === 'archived';
}

function isTimeRange(value: unknown): value is ReedTimeRange {
  if (!isObject(value) || typeof value.preset !== 'string') return false;
  if (value.preset === 'today' || value.preset === 'yesterday' || value.preset === 'this_week' || value.preset === 'last_week') return true;
  if (value.preset === 'last_n_days') return typeof value.days === 'number' && value.days >= 1 && value.days <= 180;
  if (value.preset === 'last_n_weeks') return typeof value.weeks === 'number' && value.weeks >= 1 && value.weeks <= 26;
  return false;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text: unknown }).text);
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

function formatCurrentTime(timestamp: number, timeZone?: string) {
  const safeTimeZone = normalizeTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    ...(safeTimeZone ? { timeZone: safeTimeZone } : {}),
  });
  const timeZoneLabel = safeTimeZone ? ` (${safeTimeZone})` : '';
  return `${formatter.format(new Date(timestamp))}${timeZoneLabel}`;
}

function normalizeTimeZone(timeZone?: string) {
  if (!timeZone || timeZone.length > 80) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return null;
  }
}

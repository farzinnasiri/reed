import { parseMessageReaction, REED_REACTIONS_PROMPT, type MessageReaction } from '../domains/reed/reactions';
import { v, type Infer } from 'convex/values';
import { z } from 'zod';
import type { Id } from './_generated/dataModel';

export const reedWidgetValidator = v.union(
  v.object({ kind: v.literal('session_summary'), sessionId: v.id('liveSessions') }),
  v.object({ kind: v.literal('weigh_in') }),
  v.object({ kind: v.literal('session_change'), actionId: v.id('reedSessionActions') }),
  v.object({ kind: v.literal('plan'), plannedSessionId: v.id('plannedSessions') }),
  v.object({ kind: v.literal('quick_log'), presetKeys: v.array(v.string()) }),
);
export type ReedWidget = Infer<typeof reedWidgetValidator>;

const MAX_PRESET_KEYS = 6;
const MAX_REPLIES = 3;
const MAX_REPLY_CHARACTERS = 24;

const widgetOutputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('session_summary'), sessionId: z.string().min(1) }),
  z.object({ kind: z.literal('weigh_in') }),
  z.object({ kind: z.literal('session_change'), actionId: z.string().min(1) }),
  z.object({ kind: z.literal('plan'), plannedSessionId: z.string().min(1) }),
  z.object({ kind: z.literal('quick_log'), presetKeys: z.array(z.string()).min(1) }),
]);
const chatOutputSchema = z.object({
  response: z.string().trim().min(1),
  reaction: z.unknown().optional(),
  // Optional model output can be malformed independently of usable reply text.
  widget: z.unknown().optional(),
  replies: z.unknown().optional(),
  plan: z.unknown().optional(),
  sessionAction: z.unknown().optional(),
});

export const REED_PRESENTATION_PROMPT_VERSION = 'reed-widgets-v3-reactions';
// This extends the existing runtime JSON contract, not the versioned coaching prompt.
export const REED_PRESENTATION_PROMPT = `- Return strict JSON only: {"response":"user-facing reply","widget":optional widget,"replies":optional string array,"reaction":optional emoji or null}.
- response is the same natural coaching reply you would otherwise write. Optional UI must not change its quality or meaning.
- At most one widget; include it only when it saves effort: show an ended session they asked about, offer weigh_in when they mention weight, or quick_log when they describe light activity. These widgets open manual flows; they do not log or change data.
- Widget catalog: {"kind":"session_summary","sessionId":"an available ended-session id"}, {"kind":"weigh_in"}, {"kind":"quick_log","presetKeys":["available preset key"]} (1-6 keys). Use only references listed below. Never put ids in response or invent references.
- For "my last session" or "my latest session", use exactly widgetChoices.sessions[0].sessionId, the first available session reference. Do not substitute an older session.
- When useful, include 1-3 likely next messages in replies, each at most 24 characters, sentence case, no emoji or trailing punctuation except ?. They can follow a statement or answer a predictable question. Omit them when the user has no useful next action.
- Omit widget/replies when they are unnecessary. Never include layout, styles or copied measurements.
${REED_REACTIONS_PROMPT}`;

export type WidgetFacts = {
  action?: { _id: string; profileId: string } | null;
  plan?: { _id: string; profileId: string; status: string } | null;
  profileId: string;
  session: { _id: string; profileId: string; status: string } | null;
  enabledPresetKeys: readonly string[];
};

export function sanitizeReedWidget(value: unknown, facts: WidgetFacts): ReedWidget | undefined {
  let candidate = value;
  if (isRecord(value) && value.kind === 'quick_log' && Array.isArray(value.presetKeys)) {
    const enabled = new Set(facts.enabledPresetKeys);
    const keys = [...new Set(value.presetKeys.filter((key): key is string => typeof key === 'string' && enabled.has(key)))];
    candidate = { kind: 'quick_log', presetKeys: keys.slice(0, MAX_PRESET_KEYS) };
  }
  const parsed = widgetOutputSchema.safeParse(candidate);
  if (!parsed.success) return undefined;
  const widget = parsed.data;
  if (widget.kind === 'session_change') {
    const action = facts.action;
    return action && action._id === widget.actionId && action.profileId === facts.profileId
      ? { kind: 'session_change', actionId: action._id as Id<'reedSessionActions'> } : undefined;
  }
  if (widget.kind === 'plan') {
    const plan = facts.plan;
    return plan && plan._id === widget.plannedSessionId && plan.profileId === facts.profileId && plan.status !== 'dismissed'
      ? { kind: 'plan', plannedSessionId: plan._id as Id<'plannedSessions'> } : undefined;
  }
  if (widget.kind !== 'session_summary') return widget;
  const session = facts.session;
  return session && session._id === widget.sessionId && session.profileId === facts.profileId && session.status === 'ended'
    ? { kind: 'session_summary', sessionId: session._id as Id<'liveSessions'> } : undefined;
}

export function sanitizeReedReplies(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const replies: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const reply = item.trim().replace(/[.!,:;…。！]+$/u, '');
    const key = reply.toLowerCase();
    if (!reply || /\p{Extended_Pictographic}/u.test(reply) || Array.from(reply).length > MAX_REPLY_CHARACTERS || seen.has(key)) continue;
    replies.push(reply);
    seen.add(key);
    if (replies.length === MAX_REPLIES) break;
  }
  return replies.length ? replies : undefined;
}

export function sanitizeReedPresentation(value: { widget?: unknown; replies?: unknown }, facts: WidgetFacts, content: string) {
  const widget = sanitizeReedWidget(value.widget, facts);
  const replies = content.trim() ? sanitizeReedReplies(value.replies) : undefined;
  return { ...(widget ? { widget } : {}), ...(replies ? { replies } : {}) };
}

export type ReedChatResult = { response: string; reaction?: MessageReaction; widget?: unknown; replies?: unknown; plan?: unknown; sessionAction?: unknown };

export function parseReedChatResult(text: string, emptyFallback: string): ReedChatResult {
  const fallback = text.trim() || emptyFallback;
  const fenced = text.trim().match(/```(?:json)?\s*([\s\S]*?)```/);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const json = fenced?.[1] ?? (start >= 0 && end > start ? text.slice(start, end + 1) : text);
  try {
    const value: unknown = JSON.parse(json);
    const parsed = chatOutputSchema.safeParse(value);
    if (!parsed.success) return { response: emptyFallback };
    return {
      response: parsed.data.response,
      ...(parseMessageReaction(parsed.data.reaction) ? { reaction: parseMessageReaction(parsed.data.reaction) } : {}),
      ...(parsed.data.sessionAction !== undefined ? { sessionAction: parsed.data.sessionAction } : {}),
      ...(parsed.data.plan !== undefined ? { plan: parsed.data.plan } : {}),
      ...(parsed.data.widget !== undefined ? { widget: parsed.data.widget } : {}),
      ...(parsed.data.replies !== undefined ? { replies: parsed.data.replies } : {}),
    };
  } catch {
    // A malformed optional field must not discard the already generated reply text.
    const response = /"response"\s*:\s*("(?:[^"\\]|\\.)*")/.exec(json);
    if (response) {
      try {
        const value: unknown = JSON.parse(response[1]);
        if (typeof value === 'string' && value.trim()) return { response: value.trim() };
      } catch { /* Fall back to the original plain-text response. */ }
    }
    return { response: start >= 0 && /"(?:widget|replies|response)"\s*:/.test(json) ? emptyFallback : fallback };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const REED_PLANNING_PROMPT = `Planned Sessions are now approved, request-driven only. This overrides older blanket planning prohibitions in the coaching prompt only for this capability.
- Only when the current user asks for a workout/plan, accepts your offer, or requests a plan change, add "plan" to the JSON response: {"title":"short title","plannedSessionId":optional existing ready plan id,"expectedRevision":required when revising,"exercises":[{"exerciseCatalogId":"available choice id","setCount":1-8,"restSeconds":0-240}],"scheduledForAt":optional UTC milliseconds}.
- Optional per-exercise targetMetrics is an array of COMPLETE recipe metric objects, exactly setCount long. Include it only when the user explicitly asks to change target reps/load/duration/distance/intensity. Ground it in the saved/recent values, keep loads at or below recent performance (assistance at or above recent support), and use only the listed recipe fields. Otherwise omit it and let the backend ground targets.
- Only set scheduledForAt when the user asks for a day/time. Omission preserves the existing scheduled instant on revision; null clears it when asked.
- Maximum 12 exercises. Use only planningContext.choices, which are filtered by the training profile and equipment/constraints. Never invent catalog ids. If no suitable choices, explain and omit plan.
- A request to make a plan shorter, swap an exercise in a ready plan, or otherwise revise it MUST include the plan object in the JSON envelope. Saying "revised" in response alone does not save anything. "Do not create a new plan" means supply the EXISTING plan id, never omit the plan object.
- When changing the latest proposed plan, use that SAME plannedSessionId and expectedRevision; preserve other exercises unless the user asks otherwise. No manual editor, no routine, goal/profile writes.
- Targets are assigned server-side from recent performance, never automatic load progression; when history is missing the card shows recipe defaults for review. Do not claim a saved plan before the card is available. No medical interpretation.
- Do not emit a plan widget yourself for newly authored plans: the server creates its owned reference after validation. Plans create no performed work until logging. Starting requires the user's Start button; if a session is already open, Continue current session.
- Ordinary discussion, historical-session questions, background notes and unsolicited suggestions never create/revise plans.`;

export const REED_SESSION_ACTION_PROMPT = `Actor capability is enabled only if sessionActionContext is present. It permits a proposal to swap ONE unlogged session exercise, never performed-work, profile or history writes. This overrides older blanket Actor prohibitions only for that proposal.
- Only on an explicit current request to swap/replace/change an exercise in the exact active session, add sessionAction: {"operation":"swap","sessionId":"context id","sessionExerciseId":"context choice id","replacementCatalogId":"planning choice id","expectedRevision":context revision,"setCount":1-8,"restSeconds":0-240,"rationale":"brief reason"} to the JSON envelope. Never emit both plan and sessionAction.
- Use only sessionActionContext.choices and planningContext.choices. No replacement of a logged exercise. No add, remove, reorder, logging, finish, goal/profile changes or undo.
- This saves a five-minute proposal ONLY. Never say it was applied: tell the user to review targets and tap Apply swap. A reply chip or a generic yes never confirms a session action. Do not emit the widget yourself: the server supplies its owned reference.
- If sessionActionContext is null or there is no safe candidate, omit sessionAction and respond with coaching text. Background notes must never trigger it.`;

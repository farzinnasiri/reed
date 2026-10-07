import { ConvexError } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';

export async function controlPanelHttp(ctx: ActionCtx, request: Request) {
  if (!authorizeControlPanel(request)) {
    return jsonResponse({ error: 'Prompt admin access is not enabled for this deployment.' }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }
  if (!isRecord(body) || typeof body.action !== 'string') {
    return jsonResponse({ error: 'Missing action.' }, 400);
  }

  try {
    return jsonResponse(await dispatchControlPanel(ctx, body.action, body), 200);
  } catch (error) {
    return jsonResponse({ error: errorText(error) }, 400);
  }
}

export function controlPanelCorsResponse() {
  return new Response(null, { headers: corsHeaders(), status: 204 });
}

async function dispatchControlPanel(ctx: ActionCtx, action: string, body: Record<string, unknown>) {
  switch (action) {
    case 'listPromptKeys':
      return await ctx.runQuery(internal.adminPrompts.listPromptKeys, {});
    case 'getActivePrompt':
      return await ctx.runQuery(internal.adminPrompts.getActivePrompt, { key: optionalString(body.key) });
    case 'listPromptVersions':
      return await ctx.runQuery(internal.adminPrompts.listPromptVersions, { key: optionalString(body.key) });
    case 'saveActivePrompt':
      return await ctx.runMutation(internal.adminPrompts.saveActivePrompt, {
        content: requiredString(body.content, 'Prompt content'),
        key: optionalString(body.key),
      });
    case 'rollbackPrompt':
      return await ctx.runMutation(internal.adminPrompts.rollbackPrompt, {
        key: optionalString(body.key),
        version: requiredNumber(body.version, 'Prompt version'),
      });
    case 'listReedProfiles':
      return await ctx.runQuery(internal.adminPrompts.listReedProfiles, {});
    case 'getReedDebugContext':
      return await ctx.runQuery(internal.adminPrompts.getReedDebugContext, {
        profileId: requiredString(body.profileId, 'Profile') as Id<'profiles'>,
      });
    default:
      throw new Error('Unknown control panel action.');
  }
}

function authorizeControlPanel(request: Request) {
  const expected = process.env.REED_CONTROL_PANEL_SECRET;
  if (!expected) return false;
  const header = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  const provided = header.slice(prefix.length);
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

function optionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} is required.`);
  return value;
}

function requiredNumber(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} is required.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function errorText(error: unknown) {
  if (error instanceof ConvexError) {
    return typeof error.data === 'string' ? error.data : 'Control panel request failed.';
  }
  return error instanceof Error ? error.message : 'Control panel request failed.';
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    status,
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
  };
}

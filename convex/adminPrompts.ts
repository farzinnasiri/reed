import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';

const DEFAULT_PROMPT_KEY = 'reed_chat_system';
const MAX_PROMPT_VERSIONS = 50;

const promptVersionValidator = v.object({
  _id: v.id('reedPromptVersions'),
  _creationTime: v.number(),
  content: v.string(),
  contentHash: v.string(),
  createdAt: v.number(),
  key: v.string(),
  status: v.union(v.literal('active'), v.literal('archived')),
  updatedAt: v.number(),
  version: v.number(),
});

function assertAdmin(adminSecret: string) {
  const expectedSecret = process.env.REED_CONTROL_PANEL_SECRET;
  if (!expectedSecret || adminSecret !== expectedSecret) {
    throw new ConvexError('Prompt admin access is not enabled for this deployment.');
  }
}

function normalizePromptKey(key: string | undefined) {
  const normalized = (key ?? DEFAULT_PROMPT_KEY).trim();
  if (!/^[a-z][a-z0-9_:-]{2,80}$/.test(normalized)) {
    throw new ConvexError('Prompt key must be a lowercase identifier.');
  }
  return normalized;
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return `h${(hash >>> 0).toString(16)}`;
}

async function upsertPromptVersion(ctx: MutationCtx, args: { key: string; content: string }) {
  const now = Date.now();
  const current = await ctx.db
    .query('reedPromptVersions')
    .withIndex('by_key_and_status', q => q.eq('key', args.key).eq('status', 'active'))
    .order('desc')
    .first();
  if (current?.content === args.content) return current._id;
  if (current) await ctx.db.patch(current._id, { status: 'archived', updatedAt: now });

  return await ctx.db.insert('reedPromptVersions', {
    key: args.key,
    content: args.content,
    status: 'active',
    version: (current?.version ?? 0) + 1,
    contentHash: simpleHash(args.content),
    createdAt: now,
    updatedAt: now,
  });
}

export const listPromptKeys = query({
  args: { adminSecret: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const rows = await ctx.db.query('reedPromptVersions').take(200);
    const keys = new Set(rows.map(row => row.key));
    keys.add(DEFAULT_PROMPT_KEY);
    return [...keys].sort();
  },
});

export const getActivePrompt = query({
  args: { adminSecret: v.string(), key: v.optional(v.string()) },
  returns: v.union(promptVersionValidator, v.null()),
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const key = normalizePromptKey(args.key);
    return await ctx.db
      .query('reedPromptVersions')
      .withIndex('by_key_and_status', q => q.eq('key', key).eq('status', 'active'))
      .order('desc')
      .first();
  },
});

export const listPromptVersions = query({
  args: { adminSecret: v.string(), key: v.optional(v.string()) },
  returns: v.array(promptVersionValidator),
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const key = normalizePromptKey(args.key);
    return await ctx.db
      .query('reedPromptVersions')
      .withIndex('by_key_and_version', q => q.eq('key', key))
      .order('desc')
      .take(MAX_PROMPT_VERSIONS);
  },
});

export const saveActivePrompt = mutation({
  args: { adminSecret: v.string(), content: v.string(), key: v.optional(v.string()) },
  returns: v.id('reedPromptVersions'),
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const key = normalizePromptKey(args.key);
    const content = args.content.trim();
    if (content.length < 100) throw new ConvexError('Prompt content is too short.');
    return await upsertPromptVersion(ctx, { key, content });
  },
});

export const rollbackPrompt = mutation({
  args: { adminSecret: v.string(), key: v.optional(v.string()), version: v.number() },
  returns: v.id('reedPromptVersions'),
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret);
    const key = normalizePromptKey(args.key);
    const target = await ctx.db
      .query('reedPromptVersions')
      .withIndex('by_key_and_version', q => q.eq('key', key).eq('version', args.version))
      .unique();
    if (!target) throw new ConvexError('Prompt version was not found.');
    return await upsertPromptVersion(ctx, { key, content: target.content });
  },
});

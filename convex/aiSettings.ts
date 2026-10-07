import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery, query, type QueryCtx } from './_generated/server';
import { requireViewerProfile } from './profiles';
import { coachModelValidator, coachReplyPreset, coachReplySettingsValidator, defaultAiSettings, defaultCoachReplyBackup, validateCoachReplySettings } from './aiSettingsValues';

const settingsValidator = v.object({ coachReply: coachReplySettingsValidator, coachReplyBackup: coachReplySettingsValidator, revision: v.number(), updatedAt: v.number() });

async function readSettings(ctx: QueryCtx) {
  const row = await ctx.db.query('globalSettings').withIndex('by_key', q => q.eq('key', 'global')).unique();
  return row ? { coachReply: row.coachReply, coachReplyBackup: row.coachReplyBackup ?? defaultCoachReplyBackup(row.coachReply.model), revision: row.revision, updatedAt: row.updatedAt } : defaultAiSettings();
}

/** Safe, auth-gated configuration; Convex pushes changes to subscribers. Never contains credentials. */
export const get = query({
  args: {}, returns: settingsValidator,
  handler: async ctx => {
    await requireViewerProfile(ctx);
    return await readSettings(ctx);
  },
});

export const load = internalQuery({ args: {}, returns: settingsValidator, handler: readSettings });

/** Deployment operators use the dashboard/CLI. App users cannot change global model settings. */
export const setCoachReply = internalMutation({
  args: {
    model: coachModelValidator,
    settings: v.optional(coachReplySettingsValidator),
    backupModel: v.optional(coachModelValidator),
    backupSettings: v.optional(coachReplySettingsValidator),
    expectedRevision: v.optional(v.number()),
  },
  returns: settingsValidator,
  handler: async (ctx, args) => {
    const coachReply = args.settings ?? coachReplyPreset(args.model);
    if (coachReply.model !== args.model) throw new ConvexError('Model and settings must agree.');
    const row = await ctx.db.query('globalSettings').withIndex('by_key', q => q.eq('key', 'global')).unique();
    if (args.backupSettings && !args.backupModel) throw new ConvexError('Choose a backup model with backup settings.');
    const coachReplyBackup = args.backupModel
      ? args.backupSettings ?? coachReplyPreset(args.backupModel)
      : row?.coachReplyBackup && row.coachReplyBackup.model !== coachReply.model ? row.coachReplyBackup : defaultCoachReplyBackup(coachReply.model);
    if (args.backupModel && coachReplyBackup.model !== args.backupModel) throw new ConvexError('Backup model and settings must agree.');
    if (coachReplyBackup.model === coachReply.model) throw new ConvexError('The backup must use a different coach model.');
    try { validateCoachReplySettings(coachReply); validateCoachReplySettings(coachReplyBackup); } catch (error) {
      throw new ConvexError(error instanceof Error ? error.message : 'Invalid coach settings.');
    }
    if (args.expectedRevision !== undefined && args.expectedRevision !== (row?.revision ?? 0)) {
      throw new ConvexError('Settings changed since they were loaded. Reload before saving.');
    }
    const next = { coachReply, coachReplyBackup, revision: (row?.revision ?? 0) + 1, updatedAt: Date.now() };
    if (row) await ctx.db.patch(row._id, next);
    else await ctx.db.insert('globalSettings', { key: 'global', ...next });
    return next;
  },
});

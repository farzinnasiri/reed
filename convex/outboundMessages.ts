import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalMutation } from './_generated/server';
import type { Id } from './_generated/dataModel';

const MAX_OUTBOUND_BATCH_SIZE = 20;

const outboundChannelsValidator = v.object({
  push: v.boolean(),
  reedChat: v.boolean(),
});

const outboundPriorityValidator = v.union(v.literal('high'), v.literal('low'), v.literal('normal'));
const outboundDataValidator = v.record(v.string(), v.string());

type ClaimedOutboundMessage = {
  body?: string;
  channels: {
    push: boolean;
    reedChat: boolean;
  };
  chatMessageText?: string;
  data: Record<string, string>;
  id: Id<'outboundMessages'>;
  kind: string;
  notificationIntentId?: Id<'notificationIntents'>;
  priority: 'high' | 'low' | 'normal';
  profileId: Id<'profiles'>;
  reedMessageId?: Id<'reedMessages'>;
  scheduledFor: number;
  source: string;
  title?: string;
};

export const enqueue = internalMutation({
  args: {
    body: v.optional(v.string()),
    channels: outboundChannelsValidator,
    chatMessageText: v.optional(v.string()),
    data: v.optional(outboundDataValidator),
    dedupeKey: v.string(),
    expiresAt: v.optional(v.number()),
    kind: v.string(),
    priority: outboundPriorityValidator,
    profileId: v.id('profiles'),
    scheduledFor: v.number(),
    source: v.string(),
    title: v.optional(v.string()),
  },
  returns: v.id('outboundMessages'),
  handler: async (ctx, args) => {
    assertOutboundMessage(args);

    const now = Date.now();
    const existing = await ctx.db
      .query('outboundMessages')
      .withIndex('by_profile_id_and_dedupe_key', q =>
        q.eq('profileId', args.profileId).eq('dedupeKey', args.dedupeKey),
      )
      .first();
    const patch = {
      body: args.body?.trim(),
      channels: args.channels,
      chatMessageText: args.chatMessageText?.trim(),
      claimedAt: undefined,
      completedAt: undefined,
      data: args.data ?? {},
      expiresAt: args.expiresAt,
      failureReason: undefined,
      kind: args.kind.trim(),
      notificationIntentId: undefined,
      priority: args.priority,
      reedMessageId: undefined,
      scheduledFor: args.scheduledFor,
      source: args.source.trim(),
      status: 'pending' as const,
      title: args.title?.trim(),
      updatedAt: now,
    };

    if (existing && (existing.status === 'pending' || existing.status === 'failed' || existing.status === 'skipped')) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert('outboundMessages', {
      ...patch,
      cancelledAt: undefined,
      createdAt: now,
      dedupeKey: args.dedupeKey,
      profileId: args.profileId,
    });
  },
});

export const cancel = internalMutation({
  args: {
    dedupeKey: v.string(),
    profileId: v.id('profiles'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query('outboundMessages')
      .withIndex('by_profile_id_and_dedupe_key', q =>
        q.eq('profileId', args.profileId).eq('dedupeKey', args.dedupeKey),
      )
      .first();

    if (message && message.status === 'pending') {
      const now = Date.now();
      await ctx.db.patch(message._id, {
        cancelledAt: now,
        status: 'cancelled',
        updatedAt: now,
      });
    }

    return null;
  },
});

export const claimDue = internalMutation({
  args: {
    now: v.number(),
  },
  returns: v.array(v.object({
    body: v.optional(v.string()),
    channels: outboundChannelsValidator,
    chatMessageText: v.optional(v.string()),
    data: outboundDataValidator,
    id: v.id('outboundMessages'),
    kind: v.string(),
    notificationIntentId: v.optional(v.id('notificationIntents')),
    priority: outboundPriorityValidator,
    profileId: v.id('profiles'),
    reedMessageId: v.optional(v.id('reedMessages')),
    scheduledFor: v.number(),
    source: v.string(),
    title: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('outboundMessages')
      .withIndex('by_status_and_scheduled_for', q =>
        q.eq('status', 'pending').lte('scheduledFor', args.now),
      )
      .take(MAX_OUTBOUND_BATCH_SIZE);
    const claimed: ClaimedOutboundMessage[] = [];

    for (const row of rows) {
      if (row.expiresAt !== undefined && row.expiresAt <= args.now) {
        await ctx.db.patch(row._id, {
          completedAt: args.now,
          failureReason: 'expired',
          status: 'skipped',
          updatedAt: args.now,
        });
        continue;
      }

      if (!row.channels.push && !row.channels.reedChat) {
        await ctx.db.patch(row._id, {
          completedAt: args.now,
          failureReason: 'no_channels',
          status: 'skipped',
          updatedAt: args.now,
        });
        continue;
      }

      await ctx.db.patch(row._id, {
        claimedAt: args.now,
        status: 'sending',
        updatedAt: args.now,
      });
      claimed.push({
        body: row.body,
        channels: row.channels,
        chatMessageText: row.chatMessageText,
        data: row.data,
        id: row._id,
        kind: row.kind,
        notificationIntentId: row.notificationIntentId,
        priority: row.priority,
        profileId: row.profileId,
        reedMessageId: row.reedMessageId,
        scheduledFor: row.scheduledFor,
        source: row.source,
        title: row.title,
      });
    }

    return claimed;
  },
});

export const markSent = internalMutation({
  args: {
    completedAt: v.number(),
    notificationIntentId: v.optional(v.id('notificationIntents')),
    outboundMessageId: v.id('outboundMessages'),
    reedMessageId: v.optional(v.id('reedMessages')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.outboundMessageId, {
      completedAt: args.completedAt,
      notificationIntentId: args.notificationIntentId,
      reedMessageId: args.reedMessageId,
      status: 'sent',
      updatedAt: args.completedAt,
    });
    return null;
  },
});

export const markChatMaterialized = internalMutation({
  args: {
    outboundMessageId: v.id('outboundMessages'),
    reedMessageId: v.id('reedMessages'),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.outboundMessageId, {
      reedMessageId: args.reedMessageId,
      updatedAt: args.updatedAt,
    });
    return null;
  },
});

export const markPushMaterialized = internalMutation({
  args: {
    notificationIntentId: v.id('notificationIntents'),
    outboundMessageId: v.id('outboundMessages'),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.outboundMessageId, {
      notificationIntentId: args.notificationIntentId,
      updatedAt: args.updatedAt,
    });
    return null;
  },
});

export const markFailed = internalMutation({
  args: {
    error: v.string(),
    failedAt: v.number(),
    outboundMessageId: v.id('outboundMessages'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.outboundMessageId, {
      completedAt: args.failedAt,
      failureReason: args.error.slice(0, 500),
      status: 'failed',
      updatedAt: args.failedAt,
    });
    return null;
  },
});

export const sendDue = internalAction({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    const due: ClaimedOutboundMessage[] = await ctx.runMutation(internal.outboundMessages.claimDue, {
      now: Date.now(),
    });

    for (const message of due) {
      try {
        let reedMessageId = message.reedMessageId;
        if (message.channels.reedChat) {
          if (!reedMessageId) {
            if (!message.chatMessageText) throw new Error('outbound_chat_message_missing');
            const saved: { messageId: Id<'reedMessages'> } = await ctx.runMutation(internal.reed.createBackgroundMessage, {
              clientNonce: `outbound:${message.id}`,
              content: message.chatMessageText,
              createdAt: Date.now(),
              profileId: message.profileId,
            });
            reedMessageId = saved.messageId;
            await ctx.runMutation(internal.outboundMessages.markChatMaterialized, {
              outboundMessageId: message.id,
              reedMessageId,
              updatedAt: Date.now(),
            });
          }
        }

        let notificationIntentId = message.notificationIntentId;
        if (message.channels.push) {
          if (!notificationIntentId) {
            if (!message.title || !message.body) throw new Error('outbound_push_content_missing');
            const data = {
              ...message.data,
              outboundMessageId: message.id,
              screen: message.data.screen ?? 'reed',
              ...(reedMessageId ? { reedMessageId } : {}),
            };
            notificationIntentId = await ctx.runMutation(internal.notificationIntents.enqueueIntent, {
              body: message.body,
              createdBy: `outbound:${message.source}`,
              data,
              dedupeKey: `outbound:${message.id}`,
              kind: notificationKindForOutbound(message.kind),
              priority: message.priority,
              profileId: message.profileId,
              scheduledFor: Date.now(),
              title: message.title,
            });
            await ctx.runMutation(internal.outboundMessages.markPushMaterialized, {
              notificationIntentId,
              outboundMessageId: message.id,
              updatedAt: Date.now(),
            });
          }
        }

        await ctx.runMutation(internal.outboundMessages.markSent, {
          completedAt: Date.now(),
          notificationIntentId,
          outboundMessageId: message.id,
          reedMessageId,
        });
      } catch (error) {
        await ctx.runMutation(internal.outboundMessages.markFailed, {
          error: error instanceof Error ? error.message : 'outbound_send_failed',
          failedAt: Date.now(),
          outboundMessageId: message.id,
        });
      }
    }

    return null;
  },
});

function assertOutboundMessage(args: {
  body?: string;
  channels: { push: boolean; reedChat: boolean };
  chatMessageText?: string;
  dedupeKey: string;
  expiresAt?: number;
  kind: string;
  scheduledFor: number;
  source: string;
  title?: string;
}) {
  if (!args.channels.push && !args.channels.reedChat) {
    throw new ConvexError('Outbound message must have at least one channel.');
  }
  if (!args.dedupeKey.trim()) throw new ConvexError('Outbound dedupe key is required.');
  if (!args.kind.trim()) throw new ConvexError('Outbound kind is required.');
  if (!args.source.trim()) throw new ConvexError('Outbound source is required.');
  if (args.expiresAt !== undefined && args.expiresAt <= args.scheduledFor) {
    throw new ConvexError('Outbound expiry must be after the scheduled time.');
  }
  if (args.channels.reedChat && !args.chatMessageText?.trim()) {
    throw new ConvexError('Reed chat outbound messages need chat text.');
  }
  if (args.channels.push) {
    if (!args.title?.trim()) throw new ConvexError('Push outbound messages need a title.');
    if (!args.body?.trim()) throw new ConvexError('Push outbound messages need a body.');
  }
}

function notificationKindForOutbound(kind: string) {
  if (kind === 'absence_check_in') return 'coach_catchup' as const;
  if (kind === 'goal_drift') return 'coach_catchup' as const;
  if (kind === 'weekly_reflection') return 'digest' as const;
  if (kind === 'scheduled_reminder') return 'reminder' as const;
  if (kind === 'reward') return 'reward' as const;
  return 'system' as const;
}

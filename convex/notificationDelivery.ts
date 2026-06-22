import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import {
  EXPO_PUSH_RECEIPTS_URL,
  EXPO_PUSH_SEND_URL,
  RECEIPT_CHECK_DELAY_MS,
  type ClaimedNotificationIntent,
  type ExpoPushReceipt,
  type ExpoPushTicket,
} from './notificationTypes';
import type { Id } from './_generated/dataModel';

export const recordSendResults = internalMutation({
  args: {
    intentId: v.id('notificationIntents'),
    results: v.array(v.object({
      deviceId: v.id('notificationDevices'),
      error: v.optional(v.string()),
      expoPushToken: v.string(),
      expoTicketId: v.optional(v.string()),
      status: v.union(v.literal('ticket_error'), v.literal('ticket_ok')),
    })),
    sentAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId);
    if (!intent) return null;

    let okCount = 0;
    const errorMessages: string[] = [];
    for (const result of args.results) {
      if (result.status === 'ticket_ok') okCount += 1;
      else if (result.error) errorMessages.push(result.error);
      await ctx.db.insert('notificationDeliveries', {
        deviceId: result.deviceId,
        error: result.error,
        expoPushToken: result.expoPushToken,
        expoTicketId: result.expoTicketId,
        intentId: args.intentId,
        profileId: intent.profileId,
        sentAt: args.sentAt,
        status: result.status,
      });
      if (result.error === 'DeviceNotRegistered') {
        await ctx.db.patch(result.deviceId, {
          disabledAt: args.sentAt,
          disableReason: 'device_not_registered',
          enabled: false,
        });
      }
    }

    await ctx.db.patch(args.intentId, {
      failureReason: okCount > 0 ? undefined : errorMessages.join('; ').slice(0, 500) || 'push_send_failed',
      status: okCount > 0 ? 'sent' : 'failed',
      updatedAt: args.sentAt,
    });

    return null;
  },
});

export const dueReceipts = internalQuery({
  args: {
    now: v.number(),
  },
  returns: v.array(v.object({
    deliveryId: v.id('notificationDeliveries'),
    expoTicketId: v.string(),
  })),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('notificationDeliveries')
      .withIndex('by_status_and_sent_at', q =>
        q.eq('status', 'ticket_ok').lte('sentAt', args.now - RECEIPT_CHECK_DELAY_MS),
      )
      .take(100);

    return rows
      .filter(row => row.expoTicketId && !row.receiptCheckedAt)
      .map(row => ({
        deliveryId: row._id,
        expoTicketId: row.expoTicketId as string,
      }));
  },
});

export const recordReceipts = internalMutation({
  args: {
    now: v.number(),
    receipts: v.array(v.object({
      deliveryId: v.id('notificationDeliveries'),
      error: v.optional(v.string()),
      status: v.union(v.literal('receipt_error'), v.literal('receipt_ok')),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const receipt of args.receipts) {
      const delivery = await ctx.db.get(receipt.deliveryId);
      if (!delivery) continue;

      await ctx.db.patch(receipt.deliveryId, {
        error: receipt.error ?? delivery.error,
        receiptCheckedAt: args.now,
        status: receipt.status,
      });

      if (receipt.error === 'DeviceNotRegistered') {
        await ctx.db.patch(delivery.deviceId, {
          disabledAt: args.now,
          disableReason: 'device_not_registered',
          enabled: false,
        });
      }
    }

    return null;
  },
});

export const sendDueIntents = internalAction({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    const now = Date.now();
    const intents: ClaimedNotificationIntent[] = await ctx.runMutation(internal.notificationIntents.claimDueIntents, { now });

    for (const intent of intents) {
      try {
        const tickets = await sendExpoPushBatch(intent);
        await ctx.runMutation(internal.notificationDelivery.recordSendResults, {
          intentId: intent.intentId,
          results: intent.devices.map((device, index) => {
            const ticket = tickets[index];
            if (!ticket || ticket.status === 'error') {
              return {
                deviceId: device._id,
                error: ticket?.details?.error ?? ticket?.message ?? 'push_ticket_error',
                expoPushToken: device.expoPushToken,
                status: 'ticket_error' as const,
              };
            }

            return {
              deviceId: device._id,
              expoPushToken: device.expoPushToken,
              expoTicketId: ticket.id,
              status: 'ticket_ok' as const,
            };
          }),
          sentAt: Date.now(),
        });
      } catch (error) {
        await ctx.runMutation(internal.notificationIntents.failIntentSend, {
          error: error instanceof Error ? error.message : 'push_send_failed',
          intentId: intent.intentId,
          now: Date.now(),
        });
      }
    }

    return null;
  },
});

export const checkReceipts = internalAction({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    const now = Date.now();
    const due: { deliveryId: Id<'notificationDeliveries'>; expoTicketId: string }[] = await ctx.runQuery(
      internal.notificationDelivery.dueReceipts,
      { now },
    );
    if (due.length === 0) return null;

    const response = await fetch(EXPO_PUSH_RECEIPTS_URL, {
      body: JSON.stringify({ ids: due.map(row => row.expoTicketId) }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!response.ok) throw new Error(`Expo receipt check failed with ${response.status}`);

    const json = await response.json() as { data?: Record<string, ExpoPushReceipt> };
    await ctx.runMutation(internal.notificationDelivery.recordReceipts, {
      now: Date.now(),
      receipts: due.map(row => {
        const receipt = json.data?.[row.expoTicketId];
        if (!receipt || receipt.status === 'error') {
          return {
            deliveryId: row.deliveryId,
            error: receipt?.details?.error ?? receipt?.message ?? 'push_receipt_error',
            status: 'receipt_error' as const,
          };
        }

        return {
          deliveryId: row.deliveryId,
          status: 'receipt_ok' as const,
        };
      }),
    });

    return null;
  },
});

async function sendExpoPushBatch(intent: ClaimedNotificationIntent) {
  const response = await fetch(EXPO_PUSH_SEND_URL, {
    body: JSON.stringify(intent.devices.map(device => ({
      body: intent.body,
      data: intent.data,
      sound: 'default',
      title: intent.title,
      to: device.expoPushToken,
    }))),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Expo push send failed with ${response.status}`);

  const json = await response.json() as { data?: ExpoPushTicket[] };
  return json.data ?? [];
}

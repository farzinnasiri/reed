import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';

export const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_PUSH_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
export const MAX_SEND_BATCH_SIZE = 20;
export const RECEIPT_CHECK_DELAY_MS = 15 * 60 * 1000;

const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const notificationKindValidator = v.union(
  v.literal('coach_catchup'),
  v.literal('digest'),
  v.literal('reminder'),
  v.literal('reward'),
  v.literal('system'),
);

export const notificationPriorityValidator = v.union(v.literal('high'), v.literal('low'), v.literal('normal'));
export const notificationDataValidator = v.record(v.string(), v.string());

export type NotificationKind = 'coach_catchup' | 'digest' | 'reminder' | 'reward' | 'system';

export type ClaimedNotificationIntent = {
  body: string;
  data: Record<string, string>;
  devices: {
    _id: Id<'notificationDevices'>;
    expoPushToken: string;
  }[];
  intentId: Id<'notificationIntents'>;
  title: string;
};

export type ExpoPushTicket =
  | {
      id: string;
      status: 'ok';
    }
  | {
      details?: {
        error?: string;
      };
      message?: string;
      status: 'error';
    };

export type ExpoPushReceipt =
  | {
      status: 'ok';
    }
  | {
      details?: {
        error?: string;
      };
      message?: string;
      status: 'error';
    };

export function assertNotificationCopy(title: string, body: string) {
  if (!title.trim() || title.length > 80) {
    throw new ConvexError('Notification title must be 1-80 characters.');
  }
  if (!body.trim() || body.length > 180) {
    throw new ConvexError('Notification body must be 1-180 characters.');
  }
}

export function assertOptionalClockTime(value: string | null | undefined, label: string) {
  if (value === null || value === undefined) return;
  if (!CLOCK_TIME_PATTERN.test(value)) {
    throw new ConvexError(`${label} must use HH:mm 24-hour time.`);
  }
}

export function assertOptionalTimeZone(value: string | null | undefined) {
  if (value === null || value === undefined) return;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
  } catch {
    throw new ConvexError('Notification time zone is invalid.');
  }
}

export function parseClockMinutes(value: string | undefined) {
  if (!value) return null;
  const match = CLOCK_TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

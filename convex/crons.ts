import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval('reconcile Reed coaching memory', { hours: 12 }, internal.reedCoachingMemoryAgent.reconcileRecentlyChanged, {});
crons.interval('send due outbound messages', { minutes: 1 }, internal.outboundMessages.sendDue, {});
crons.interval('send due notifications', { minutes: 1 }, internal.notificationDelivery.sendDueIntents, {});
crons.interval('check notification receipts', { minutes: 15 }, internal.notificationDelivery.checkReceipts, {});

export default crons;

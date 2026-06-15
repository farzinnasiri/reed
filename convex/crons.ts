import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval('reconcile Reed coaching memory', { hours: 12 }, internal.reedCoachingMemoryAgent.reconcileRecentlyChanged, {});

export default crons;

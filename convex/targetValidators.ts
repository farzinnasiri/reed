import { v } from 'convex/values';

export const targetStatusValidator = v.union(
  v.literal('active'),
  v.literal('completed'),
  v.literal('missed'),
  v.literal('archived'),
);

export const targetCompletionSourceValidator = v.union(v.literal('verified'), v.literal('manual'));

export const targetMetricKindValidator = v.union(
  v.literal('exerciseMaxLoadKg'),
  v.literal('exerciseRepsAtLoad'),
  v.literal('exerciseTotalReps'),
  v.literal('exerciseBestHoldSeconds'),
  v.literal('exerciseTotalDurationSeconds'),
  v.literal('cardioDistanceMeters'),
  v.literal('cardioDurationSeconds'),
  v.literal('cardioDistanceWithinDuration'),
  v.literal('sessionCount'),
);

export const targetCadenceValidator = v.union(
  v.literal('once'),
  v.literal('daily'),
  v.literal('weekly'),
  v.literal('total'),
);

export const targetRuleValidator = v.object({
  cadence: targetCadenceValidator,
  exerciseCatalogId: v.union(v.id('exerciseCatalog'), v.null()),
  metricKind: targetMetricKindValidator,
  minDurationSeconds: v.optional(v.number()),
  minLoadKg: v.optional(v.number()),
  minReps: v.optional(v.number()),
  periodCount: v.optional(v.number()),
  threshold: v.number(),
  thresholdUnit: v.string(),
});

export const targetProgressSummaryValidator = v.object({
  current: v.number(),
  currentLabel: v.string(),
  required: v.number(),
  requiredLabel: v.string(),
  satisfiedPeriods: v.optional(v.number()),
  totalPeriods: v.optional(v.number()),
});

export const targetVerifiedSnapshotValidator = v.object({
  evaluatedAt: v.number(),
  evidenceActivityLogIds: v.array(v.id('activityLogs')),
  summary: v.string(),
});

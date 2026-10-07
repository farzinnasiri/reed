import { v } from 'convex/values';
import { targetSetValidator } from './plannedSessionValues';
export const actionStatusValidator = v.union(
  v.literal('pending'),
  v.literal('applied'),
  v.literal('rejected'),
  v.literal('expired'),
);
export const structureSnapshotValidator = v.object({
  sessionExerciseId: v.id('liveSessionExercises'),
  exerciseCatalogId: v.id('exerciseCatalog'),
  exerciseName: v.string(),
  position: v.number(),
  targets: v.array(targetSetValidator),
});
export const sessionActionFields = {
  profileId: v.id('profiles'),
  sessionId: v.id('liveSessions'),
  sourceMessageId: v.id('reedMessages'),
  operation: v.literal('swap'),
  sessionExerciseId: v.id('liveSessionExercises'),
  previousCatalogId: v.id('exerciseCatalog'),
  replacementCatalogId: v.id('exerciseCatalog'),
  expectedRevision: v.number(),
  targets: v.array(targetSetValidator),
  rationale: v.string(),
  modelContractVersion: v.string(),
  status: actionStatusValidator,
  expiresAt: v.number(),
  createdAt: v.number(),
  resolvedAt: v.optional(v.number()),
  invalidReason: v.optional(v.string()),
  audit: v.optional(
    v.object({
      confirmedAt: v.number(),
      applyingProfileId: v.id('profiles'),
      actualRevision: v.number(),
      resultingRevision: v.number(),
      before: structureSnapshotValidator,
      after: structureSnapshotValidator,
    }),
  ),
};

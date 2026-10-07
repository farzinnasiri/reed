import { v } from "convex/values";
import { query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireViewerProfile } from "./profiles";
import {
  detectSessionRecords,
  calculatePersonalRecords,
  type ActivityRecordInput,
} from "../domains/trainingKnowledge/personalRecords";
import { summarizeMetrics } from "../domains/workout/recipes";
export const sessionWhisperValidator = v.object({
  kind: v.union(v.literal("info"), v.literal("pr"), v.literal("caution")),
  text: v.string(),
  retired: v.optional(v.boolean()),
});
const HISTORY_LIMIT = 200;
const DISPLAY_MS = 10_000;
function short(text: string) {
  return Array.from(text).slice(0, 80).join("");
}
function recordInput(
  log: Doc<"activityLogs">,
  name: string,
): ActivityRecordInput {
  return {
    activityLogId: log._id,
    derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
    exerciseCatalogId: log.exerciseCatalogId,
    exerciseName: name,
    loggedAt: log.loggedAt,
    metrics: log.metrics,
    profileId: log.profileId,
    recipeKey: log.recipeKey,
    sessionId: log.sessionId ?? null,
    warmup: log.warmup,
  };
}
/** Materialize only at set commitment. Stored info history enforces one per exercise across re-entry. */
export async function saveSessionWhisper(
  ctx: MutationCtx,
  log: Doc<"activityLogs">,
  exercise: Doc<"liveSessionExercises">,
  session: Doc<"liveSessions">,
  previous: Doc<"activityLogs">[],
) {
  if (log.warmup) return null;
  let whisper: { kind: "info" | "pr" | "caution"; text: string } | null = null;
  const remaining = (exercise.targetDefaults?.length ?? 0) - log.setNumber;
  const last = previous.filter((row) => !row.warmup).at(-1);
  if (/\b(pain|painful|stop)\b/i.test(session.userNotes ?? ""))
    whisper = {
      kind: "caution",
      text: "Pain or stop noted. Pause this exercise and talk it through with Reed.",
    };
  else if (log.metrics.rpe >= 9.5 && remaining > 0)
    whisper = {
      kind: "caution",
      text: `RPE ${log.metrics.rpe} with ${remaining} ${remaining === 1 ? "set" : "sets"} left. Take the full rest before continuing.`,
    };
  else if (
    last &&
    log.metrics.load === last.metrics.load &&
    last.metrics.reps > 0 &&
    log.metrics.reps <= last.metrics.reps * 0.75 &&
    last.metrics.reps - log.metrics.reps >= 2
  )
    whisper = {
      kind: "caution",
      text: `Reps fell from ${last.metrics.reps} to ${log.metrics.reps} at the same load. Take the full rest.`,
    };
  if (!whisper) {
    const history = await ctx.db
      .query("activityLogs")
      .withIndex("by_profile_id_and_exercise_catalog_id_and_logged_at", (q) =>
        q
          .eq("profileId", log.profileId)
          .eq("exerciseCatalogId", log.exerciseCatalogId)
          .lt("loggedAt", log.loggedAt),
      )
      .order("desc")
      .take(HISTORY_LIMIT + 1);
    // Never claim a record when the bounded read has omitted older evidence.
    if (history.some((row) => !row.warmup) && history.length <= HISTORY_LIMIT) {
      const historicalActivities = history.map((row) =>
        recordInput(row, exercise.exerciseName),
      );
      const priorKinds = new Set(
        calculatePersonalRecords({ activities: historicalActivities }).map(
          (record) => record.kind,
        ),
      );
      const record = detectSessionRecords({
        historicalActivities,
        sessionActivities: [recordInput(log, exercise.exerciseName)],
      }).records.find((record) => priorKinds.has(record.kind));
      if (record)
        whisper = {
          kind: "pr",
          text: short(`${record.label}: ${record.summary}. New best.`),
        };
    }
    if (!whisper && !previous.some((row) => row.reedWhisper?.kind === "info")) {
      const priorSessionSet = history.find(
        (row) => row.sessionId !== log.sessionId && !row.warmup,
      );
      if (priorSessionSet)
        whisper = {
          kind: "info",
          text: short(
            `Last time: ${summarizeMetrics(priorSessionSet.recipeKey, priorSessionSet.metrics)}.`,
          ),
        };
    }
  }
  if (whisper) await ctx.db.patch(log._id, { reedWhisper: whisper });
  return whisper;
}
export const getSessionWhisper = query({
  args: {
    sessionId: v.id("liveSessions"),
    exerciseId: v.id("liveSessionExercises"),
    now: v.number(),
  },
  returns: v.union(
    v.null(),
    v.object({
      ...sessionWhisperValidator.fields,
      eventId: v.id("activityLogs"),
      createdAt: v.number(),
      setIndex: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const profile = await requireViewerProfile(ctx);
    const session = await ctx.db.get(args.sessionId),
      exercise = await ctx.db.get(args.exerciseId);
    if (
      !session ||
      session.profileId !== profile._id ||
      session.status !== "active" ||
      !exercise ||
      exercise.profileId !== profile._id ||
      exercise.sessionId !== session._id
    )
      return null;
    const log = await ctx.db
      .query("activityLogs")
      .withIndex("by_session_exercise_id_and_set_number", (q) =>
        q.eq("sessionExerciseId", exercise._id),
      )
      .order("desc")
      .first();
    if (
      !log?.reedWhisper ||
      log.reedWhisper.retired ||
      args.now < log.loggedAt ||
      args.now - log.loggedAt > DISPLAY_MS
    )
      return null;
    return {
      ...log.reedWhisper,
      eventId: log._id,
      createdAt: log.loggedAt,
      setIndex: log.setNumber - 1,
    };
  },
});

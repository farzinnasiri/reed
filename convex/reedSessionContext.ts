import { ConvexError, v, type Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
export const reedMessageContextValidator = v.object({
  sessionId: v.id("liveSessions"),
  exerciseId: v.optional(v.id("liveSessionExercises")),
  setIndex: v.optional(v.number()),
});
export type ReedMessageContext = Infer<typeof reedMessageContextValidator>;
/** Validate the committed context, including the next set or an already logged set. */
export async function validateReedMessageContext(
  ctx: MutationCtx,
  profileId: Id<"profiles">,
  context: ReedMessageContext | undefined,
) {
  if (!context) return;
  const session = await ctx.db.get(context.sessionId);
  if (
    !session ||
    session.profileId !== profileId ||
    session.status !== "active"
  )
    throw new ConvexError("The workout context is no longer active.");
  if (
    context.setIndex !== undefined &&
    (!context.exerciseId ||
      !Number.isInteger(context.setIndex) ||
      context.setIndex < 0 ||
      context.setIndex > 2000)
  )
    throw new ConvexError("Invalid set context.");
  if (!context.exerciseId) return;
  const exercise = await ctx.db.get(context.exerciseId);
  if (
    !exercise ||
    exercise.profileId !== profileId ||
    exercise.sessionId !== session._id
  )
    throw new ConvexError("Exercise does not belong to this workout.");
  if (context.setIndex !== undefined) {
    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_session_exercise_id_and_set_number", (q) =>
        q.eq("sessionExerciseId", exercise._id),
      )
      .take(context.setIndex + 1);
    if (context.setIndex > logs.length)
      throw new ConvexError("Set context is ahead of the workout.");
  }
}
export async function reedMessageContextLine(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  context: ReedMessageContext | undefined,
) {
  if (!context) return null;
  const session = await ctx.db.get(context.sessionId);
  if (!session || session.profileId !== profileId) return null;
  const exercise = context.exerciseId
    ? await ctx.db.get(context.exerciseId)
    : null;
  if (
    exercise &&
    (exercise.profileId !== profileId || exercise.sessionId !== session._id)
  )
    return null;
  const set =
    exercise && context.setIndex !== undefined
      ? await ctx.db
          .query("activityLogs")
          .withIndex("by_session_exercise_id_and_set_number", (q) =>
            q
              .eq("sessionExerciseId", exercise._id)
              .eq("setNumber", context.setIndex! + 1),
          )
          .first()
      : null;
  const whisper =
    set?.reedWhisper && !set.reedWhisper.retired
      ? ` Reed's observation for this set: ${set.reedWhisper.text}`
      : "";
  return `Asked from the live workout${exercise ? `, ${exercise.exerciseName}` : ""}${context.setIndex !== undefined ? `, set ${context.setIndex + 1}` : ""}. The workout is currently ${session.status}.${whisper} This context identifies the question; it does not authorize changes.`;
}

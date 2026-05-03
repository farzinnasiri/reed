import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

type ActiveSession = Doc<'liveSessions'> & { status: 'active' };
type ActiveProcess = NonNullable<Doc<'liveSessions'>['activeProcess']>;

export type RestProcess = Extract<ActiveProcess, { kind: 'rest' }>;
export type LiveCardioProcess = Extract<ActiveProcess, { kind: 'live_cardio' }>;

export function requireRestProcess(session: ActiveSession) {
  if (!session.activeProcess || session.activeProcess.kind !== 'rest') {
    throw new ConvexError('No active rest card.');
  }

  return session.activeProcess as RestProcess;
}

export function requireLiveCardioProcess(session: ActiveSession) {
  if (!session.activeProcess || session.activeProcess.kind !== 'live_cardio') {
    throw new ConvexError('No active live cardio tracker.');
  }

  return session.activeProcess as LiveCardioProcess;
}

export async function writeRestSecondsToCurrentSetLog(
  ctx: MutationCtx,
  restProcess: RestProcess,
  restSeconds: number,
) {
  const afterSetNumber = restProcess.nextSetNumber - 1;

  if (afterSetNumber < 1) {
    return;
  }

  const setLog = await ctx.db
    .query('activityLogs')
    .withIndex('by_session_exercise_id_and_set_number', q =>
      q.eq('sessionExerciseId', restProcess.sessionExerciseId).eq('setNumber', afterSetNumber),
    )
    .unique();

  if (!setLog) {
    return;
  }

  await ctx.db.patch(setLog._id, { restSeconds });
}

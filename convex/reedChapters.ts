import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';

export function chapterGapMinutes() {
  const configured = Number(process.env.REED_CHAPTER_GAP_MINUTES ?? 60);
  return Number.isFinite(configured) && configured >= 1 && configured <= 1440 ? configured : 60;
}

export function startsNewChapter(lastMessageAt: number | null, now: number, gapMinutes: number, closedAt?: number) {
  return lastMessageAt === null || now - lastMessageAt > gapMinutes * 60_000 || (closedAt !== undefined && closedAt <= now);
}

/** Session writes close the visible chapter atomically, including an empty session's deletion. */
export async function closeChapterForSession(ctx: MutationCtx, profileId: Id<'profiles'>, sessionId: Id<'liveSessions'>, at: number, boundary: 'session_started' | 'session_ended') {
  let thread = await ctx.db.query('reedThreads').withIndex('by_profile_id_and_status', q => q.eq('profileId', profileId).eq('status', 'active')).unique();
  if (!thread && boundary === 'session_started') {
    const id = await ctx.db.insert('reedThreads', { profileId, status: 'active', createdAt: at, updatedAt: at });
    thread = await ctx.db.get(id);
  }
  if (!thread) return;
  const chapter = thread.currentChapterId ? await ctx.db.get(thread.currentChapterId) : null;
  if (chapter) await ctx.db.patch(chapter._id, { closedAt: at, closedBySessionId: sessionId, closedByBoundary: boundary });
  if (boundary === 'session_started') {
    const id = await ctx.db.insert('reedChapters', { threadId: thread._id, profileId, startedAt: at, sessionId, boundary, ...(chapter ? { previousChapterId: chapter._id } : {}) });
    await ctx.db.patch(thread._id, { currentChapterId: id });
  }
}

export async function assignMessageChapter(ctx: MutationCtx, thread: Doc<'reedThreads'>, at: number) {
  const current = thread.currentChapterId ? await ctx.db.get(thread.currentChapterId) : null;
  if (current && !startsNewChapter(Math.max(thread.lastMessageAt ?? 0, current.startedAt), at, chapterGapMinutes(), current.closedAt)) return current._id;
  if (current && current.closedAt === undefined) await ctx.db.patch(current._id, { closedAt: at });
  const chapterId = await ctx.db.insert('reedChapters', {
    threadId: thread._id, profileId: thread.profileId, startedAt: at,
    ...(current ? { previousChapterId: current._id } : {}),
    ...(current?.closedByBoundary ? { boundary: current.closedByBoundary, sessionId: current.closedBySessionId } : {}),
  });
  await ctx.db.patch(thread._id, { currentChapterId: chapterId });
  return chapterId;
}

export async function chapterMetadata(ctx: QueryCtx, chapter: Doc<'reedChapters'>) {
  const session = chapter.sessionId ? await ctx.db.get(chapter.sessionId) : null;
  const plan = session?.sourcePlannedSessionId ? await ctx.db.get(session.sourcePlannedSessionId) : null;
  return {
    id: chapter._id, startedAt: chapter.startedAt, closedAt: chapter.closedAt ?? null,
    previousChapterId: chapter.previousChapterId ?? null,
    sessionId: session?._id ?? null,
    sessionLabel: chapter.boundary === 'session_ended' ? `After ${plan?.title ?? 'your session'}` : chapter.boundary === 'session_started' ? plan?.title ?? 'During your session' : null,
  };
}

/** A single historical row, run in timestamp order by the migrations component. */
export async function backfillMessageChapter(ctx: MutationCtx, message: Doc<'reedMessages'>) {
  if (message.chapterId) return;
  const thread = await ctx.db.get(message.threadId);
  if (!thread) return;
  const prior = (await ctx.db.query('reedMessages').withIndex('by_thread_id_and_created_at', q => q.eq('threadId', thread._id).lte('createdAt', message.createdAt)).order('desc').take(4)).find(row => row._id !== message._id && row.chapterId && row.createdAt <= message.createdAt);
  const previous = prior?.chapterId ? await ctx.db.get(prior.chapterId) : null;
  const starts = await ctx.db.query('liveSessions').withIndex('by_profile_id_and_started_at', q => q.eq('profileId', message.profileId).gt('startedAt', prior?.createdAt ?? message.createdAt).lte('startedAt', message.createdAt)).order('desc').take(1);
  const ends = await ctx.db.query('liveSessions').withIndex('by_profile_id_and_ended_at', q => q.eq('profileId', message.profileId).gt('endedAt', prior?.createdAt ?? message.createdAt).lte('endedAt', message.createdAt)).order('desc').take(1);
  // A pending assistant's completion belongs to its user turn, even across a session boundary.
  const sameTurn = message.role === 'assistant' && message.source === 'system' && previous;
  const gap = startsNewChapter(prior?.completedAt ?? prior?.createdAt ?? null, message.createdAt, chapterGapMinutes());
  let chapterId = previous?._id;
  if (!chapterId || (!sameTurn && (gap || starts.length || ends.length))) {
    const event = ends[0] ?? starts[0];
    chapterId = await ctx.db.insert('reedChapters', {
      threadId: thread._id, profileId: message.profileId, startedAt: message.createdAt,
      ...(previous ? { previousChapterId: previous._id } : {}),
      ...(event ? { sessionId: event._id, boundary: ends[0] ? 'session_ended' as const : 'session_started' as const } : {}),
    });
    if (previous && previous.closedAt === undefined) await ctx.db.patch(previous._id, { closedAt: message.createdAt });
  }
  await ctx.db.patch(message._id, { chapterId });
  const current = thread.currentChapterId ? await ctx.db.get(thread.currentChapterId) : null;
  if (!current || current.startedAt <= message.createdAt) await ctx.db.patch(thread._id, { currentChapterId: chapterId });

}

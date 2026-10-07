import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

export async function patchSessionStructure(
  ctx: MutationCtx,
  session: Doc<'liveSessions'>,
  patch: Partial<Omit<Doc<'liveSessions'>, '_id' | '_creationTime'>>,
) {
  const current = await ctx.db.get(session._id);
  if (!current) throw new Error('Session no longer exists.');
  await ctx.db.patch(session._id, {
    ...patch,
    structureRevision: (current.structureRevision ?? 0) + 1,
  });
}

import { internalMutation, mutation, query } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { authComponent } from './auth';
import type { QueryCtx, MutationCtx } from './_generated/server';

const profileValidator = v.object({
  _creationTime: v.number(),
  _id: v.id('profiles'),
  authUserId: v.string(),
  avatarUrl: v.optional(v.string()),
  displayName: v.optional(v.string()),
  email: v.string(),
  updatedAt: v.number(),
});

function profilePatchFromAuthUser(user: {
  email: string;
  image?: string | null;
  name?: string | null;
  _id: string;
}) {
  return {
    authUserId: user._id,
    avatarUrl: user.image ?? undefined,
    displayName: user.name ?? undefined,
    email: user.email,
    updatedAt: Date.now(),
  };
}

export async function requireViewerProfile(ctx: QueryCtx | MutationCtx) {
  const authUser = await authComponent.getAuthUser(ctx);
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_auth_user_id', q => q.eq('authUserId', authUser._id))
    .unique();

  if (!profile) {
    throw new ConvexError('Viewer profile is missing. Reload the app and try again.');
  }

  return profile;
}

export const viewer = query({
  args: {},
  returns: v.union(v.null(), profileValidator),
  handler: async ctx => {
    const authUser = await authComponent.safeGetAuthUser(ctx);

    if (!authUser) {
      return null;
    }

    return await ctx.db
      .query('profiles')
      .withIndex('by_auth_user_id', q => q.eq('authUserId', authUser._id))
      .unique();
  },
});

export const ensureViewerProfile = mutation({
  args: {},
  returns: profileValidator,
  handler: async ctx => {
    const authUser = await authComponent.getAuthUser(ctx);
    const patch = profilePatchFromAuthUser(authUser);
    const existingProfile = await ctx.db
      .query('profiles')
      .withIndex('by_auth_user_id', q => q.eq('authUserId', authUser._id))
      .unique();

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, patch);
      const updatedProfile = await ctx.db.get(existingProfile._id);

      if (!updatedProfile) {
        throw new ConvexError('Profile disappeared during sync');
      }

      return updatedProfile;
    }

    const profileId = await ctx.db.insert('profiles', patch);
    const createdProfile = await ctx.db.get(profileId);

    if (!createdProfile) {
      throw new ConvexError('Profile was not created');
    }

    return createdProfile;
  },
});

export const deleteByAuthUserId = internalMutation({
  args: { authUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_auth_user_id', q => q.eq('authUserId', args.authUserId))
      .unique();

    if (profile) {
      await ctx.db.delete(profile._id);
    }

    return null;
  },
});

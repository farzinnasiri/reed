import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  profiles: defineTable({
    authUserId: v.string(),
    avatarUrl: v.optional(v.string()),
    displayName: v.optional(v.string()),
    email: v.string(),
    updatedAt: v.number(),
  }).index('by_auth_user_id', ['authUserId']),
});

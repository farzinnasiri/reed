import { v } from 'convex/values';
import { MESSAGE_REACTIONS } from '../domains/reed/reactions';
export const messageReactionValidator = v.union(
  ...MESSAGE_REACTIONS.map((emoji) => v.literal(emoji)),
);

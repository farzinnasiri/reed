import { anyApi } from 'convex/server';
import type { GenericId } from 'convex/values';

// Convex code generation is deployment-local and intentionally excluded from Git.
// The web client only needs serializable function references at runtime; backend
// validators remain the source of truth for every call.
export const api = anyApi;
export type Id<TableName extends string> = GenericId<TableName>;

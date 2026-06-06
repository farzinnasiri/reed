import { ConvexReactClient } from 'convex/react';
import { makeFunctionReference } from 'convex/server';

export type PromptVersion = {
  _id: string;
  content: string;
  contentHash: string;
  createdAt: number;
  key: string;
  status: 'active' | 'archived';
  updatedAt: number;
  version: number;
};

export const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

export const convex = convexUrl ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false }) : null;

export const adminPrompts = {
  getActivePrompt: makeFunctionReference<'query', { adminSecret: string; key?: string }, PromptVersion | null>(
    'adminPrompts:getActivePrompt',
  ),
  listPromptKeys: makeFunctionReference<'query', { adminSecret: string }, string[]>('adminPrompts:listPromptKeys'),
  listPromptVersions: makeFunctionReference<'query', { adminSecret: string; key?: string }, PromptVersion[]>(
    'adminPrompts:listPromptVersions',
  ),
  rollbackPrompt: makeFunctionReference<'mutation', { adminSecret: string; key?: string; version: number }, string>(
    'adminPrompts:rollbackPrompt',
  ),
  saveActivePrompt: makeFunctionReference<'mutation', { adminSecret: string; key?: string; content: string }, string>(
    'adminPrompts:saveActivePrompt',
  ),
};

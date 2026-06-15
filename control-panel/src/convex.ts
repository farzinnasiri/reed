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

export type ReedProfileOption = {
  _id: string;
  displayName: string | null;
  email: string;
  updatedAt: number;
};

export type ReedDebugContext = {
  loadedAt: number;
  profile: ReedProfileOption;
  activeThread: {
    _id: string;
    agendaItems: string[];
    compactedThroughMessageId: string | null;
    lastMessageAt: number | null;
    updatedAt: number;
  } | null;
  coachState: {
    _id: string;
    content: string;
    modelName: string;
    promptHash: string;
    updatedAt: number;
    updatedThroughMessageId: string;
  } | null;
  mentalModel: {
    _id: string;
    content: string;
    modelName: string;
    promptHash: string;
    sourceFingerprint: string;
    updatedAt: number;
  } | null;
  journeys: Array<{
    _id: string;
    confidence: number;
    lastEvidenceAt: number;
    slug: string;
    status: 'active' | 'background' | 'dormant' | 'archived';
    strength: number;
    summary: string;
    title: string;
    updatedAt: number;
  }>;
  summaries: Array<{
    _id: string;
    content: string;
    createdAt: number;
    modelName: string;
    promptHash: string | null;
    sourceFromMessageId: string | null;
    sourceThroughMessageId: string;
  }>;
  journeySnapshot: {
    _id: string;
    createdAt: number;
    currentState: unknown;
    renderedContext: string;
    trajectory: unknown;
    trigger: string;
    watchouts: string[];
  } | null;
  recentMessages: Array<{
    _id: string;
    completedAt: number | null;
    content: string;
    createdAt: number;
    role: 'user' | 'assistant';
    source: string;
    status: string;
  }>;
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
  listReedProfiles: makeFunctionReference<'query', { adminSecret: string }, ReedProfileOption[]>(
    'adminPrompts:listReedProfiles',
  ),
  getReedDebugContext: makeFunctionReference<'query', { adminSecret: string; profileId: string }, ReedDebugContext>(
    'adminPrompts:getReedDebugContext',
  ),
};

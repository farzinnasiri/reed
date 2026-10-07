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

const convexCloudUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

export const convexSiteUrl = convexSiteUrlFrom(convexCloudUrl);

export async function controlPanelRequest<T>(
  adminSecret: string,
  action: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!convexSiteUrl) {
    throw new Error('Missing VITE_CONVEX_URL. Run through make control-panel so Reed env is loaded.');
  }
  const response = await fetch(`${convexSiteUrl}/control-panel`, {
    body: JSON.stringify({ action, ...args }),
    headers: {
      Authorization: `Bearer ${adminSecret}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string'
      ? payload.error
      : `Control panel request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload as T;
}

function convexSiteUrlFrom(cloudUrl: string | undefined) {
  if (!cloudUrl) return null;
  if (cloudUrl.includes('.convex.cloud')) return cloudUrl.replace('.convex.cloud', '.convex.site').replace(/\/$/, '');
  try {
    const url = new URL(cloudUrl);
    if (url.port === '3210') {
      url.port = '3211';
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    return null;
  }
  return null;
}

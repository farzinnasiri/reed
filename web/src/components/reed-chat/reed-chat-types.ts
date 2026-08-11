export type ComposerSource = 'quick-action' | 'typed' | 'voice';

export type ServerMessage = {
  _id: string;
  attachments?: Array<{
    _id: string;
    mediaType: 'image/jpeg';
    sortOrder: number;
    status: 'analyzed' | 'failed' | 'pending';
    url: string;
  }>;
  clientNonce?: string;
  completedAt?: number;
  content: string;
  createdAt: number;
  error?: string;
  role: 'assistant' | 'user';
  source: 'background_coach' | 'quick-action' | 'system' | 'typed' | 'voice';
  status: 'failed' | 'pending' | 'sent';
};

export type ChatMessage = {
  attachments: Array<{
    id: string;
    status: 'analyzed' | 'failed' | 'pending';
    url: string;
  }>;
  createdAt: number;
  id: string;
  isAgentThinkingMessage: boolean;
  role: 'assistant' | 'user';
  serverId?: string;
  source: ComposerSource;
  status: 'failed' | 'pending' | 'sent';
  text: string;
};

export type QuickAction = {
  id: string;
  label: string;
  prompt: string;
  sortOrder: number;
};

export type DraftAttachment = {
  error?: string;
  id: string;
  name: string;
  previewUrl: string;
  status: 'failed' | 'preparing' | 'ready';
  storageId?: string;
};

export type VoiceState = {
  error: string | null;
  level: number;
  status: 'failed' | 'idle' | 'listening' | 'transcribing';
};

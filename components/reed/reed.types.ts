import type { MessageReaction } from '@/domains/reed/reactions';
import type { Doc } from '@/convex/_generated/dataModel';

export type ComposerSource = 'quick-action' | 'typed' | 'voice';
export type MessageStatus = 'failed' | 'pending' | 'sent';
export type VoiceComposerStatus = 'failed' | 'idle' | 'listening' | 'ready' | 'transcribing';

export type ReedSurfaceProps = {
  displayName: string;
  /** Called once an `openPulse` request has been acted on, so the route can clear it. */
  onPulseOpened: () => void;
  /** Called once an `openYou` request has been acted on, so the route can clear it. */
  onYouOpened: () => void;
  /** Home was opened with the Pulse expanded (`/progress`, a push notification). */
  openPulse: boolean;
  /** Home was opened with the You sheet presented (`/you`, `/settings`, a push notification). */
  openYou: boolean;
};

export type ReedQuickAction = {
  id: string;
  label: string;
  prompt: string;
  sortOrder: number;
};

export type ReedDraftAttachmentStatus = 'preparing' | 'ready' | 'failed';

export type ReedDraftAttachment = {
  error?: string;
  height?: number;
  id: string;
  name: string;
  size?: number;
  status: ReedDraftAttachmentStatus;
  storageId?: string;
  uri: string;
  width?: number;
};

export type ReedRelatedSession = {
  manualDurationSeconds?: number;
  endedAt: number;
  exerciseCount: number;
  sessionId: string;
  startedAt: number;
};

// A typed widget Reed attached to a message (BE-5). It holds references only; the data it shows is live.
export type ReedWidget = Doc<'reedMessages'>['widget'];

export type ReedMessage = {
  reaction?: MessageReaction;
  attachments?: Array<{
    id: string;
    mediaType: 'image/jpeg';
    status: 'pending' | 'analyzed' | 'failed';
    url: string;
  }>;
  createdAt: number;
  chapterId?: string;
  id: string;
  isAgentThinkingMessage?: boolean;
  // Reed wrote this without a prompt (after a session, or a check-in).
  isCoachNote?: boolean;
  relatedSession?: ReedRelatedSession | null;
  // Follow-up answers Reed offers for its question (at most three).
  replies?: string[];
  replyRecovery?: Doc<'reedMessages'>['replyRecovery'];
  role: 'assistant' | 'user';
  serverId?: string;
  source: ComposerSource;
  status: MessageStatus;
  text: string;
  widget?: ReedWidget;
};

export type VoiceComposerState = {
  error?: string | null;
  status: VoiceComposerStatus;
  transcript: string;
  voiceLevel: number;
};

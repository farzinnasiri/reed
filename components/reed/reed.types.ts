export type ComposerSource = 'quick-action' | 'typed' | 'voice';
export type CoachItemStatus = 'open' | 'resolved';
export type MessageStatus = 'failed' | 'pending' | 'sent';
export type VoiceComposerStatus = 'idle' | 'listening' | 'ready';

export type ReedSurfaceProps = {
  displayName: string;
  dockReservedSpace: number;
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

export type CoachItem = {
  body: string;
  id: string;
  sourceMessageId?: string;
  status: CoachItemStatus;
  title: string;
  type: 'caution' | 'check_in' | 'experiment' | 'focus';
};

export type ReedMessage = {
  attachments?: Array<{
    id: string;
    mediaType: 'image/jpeg';
    status: 'pending' | 'analyzed' | 'failed';
    url: string;
  }>;
  createdAt: number;
  id: string;
  role: 'assistant' | 'user';
  serverId?: string;
  source: ComposerSource;
  status: MessageStatus;
  text: string;
};

export type VoiceComposerState = {
  status: VoiceComposerStatus;
  transcript: string;
};

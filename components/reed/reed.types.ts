export type ComposerSource = 'quick-action' | 'typed' | 'voice';
export type CoachItemStatus = 'open' | 'resolved';
export type MessageStatus = 'pending' | 'sent';
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

export type CoachItem = {
  body: string;
  id: string;
  sourceMessageId?: string;
  status: CoachItemStatus;
  title: string;
  type: 'caution' | 'check_in' | 'experiment' | 'focus';
};

export type ReedMessage = {
  createdAt: number;
  id: string;
  role: 'assistant' | 'user';
  source: ComposerSource;
  status: MessageStatus;
  text: string;
};

export type VoiceComposerState = {
  status: VoiceComposerStatus;
  transcript: string;
};

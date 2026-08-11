'use client';

/* Local object URLs should not be transformed by the Next image pipeline. */
/* eslint-disable @next/next/no-img-element */

import { useRef, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { ChatIcon } from './chat-icon';
import type { DraftAttachment, QuickAction, VoiceState } from './reed-chat-types';

export function ReedChatComposer({
  attachments,
  canAttachMore,
  disabled,
  draft,
  error,
  isPreparingAttachments,
  onChangeDraft,
  onFiles,
  onQuickAction,
  onRemoveAttachment,
  onRetryVoice,
  onSend,
  onStartVoice,
  onStopVoice,
  quickActions,
  showQuickActions,
  voiceState,
}: {
  attachments: DraftAttachment[];
  canAttachMore: boolean;
  disabled: boolean;
  draft: string;
  error: string | null;
  isPreparingAttachments: boolean;
  onChangeDraft: (value: string) => void;
  onFiles: (files: FileList | File[]) => void;
  onQuickAction: (prompt: string) => void;
  onRemoveAttachment: (id: string) => void;
  onRetryVoice: () => void;
  onSend: () => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  quickActions: QuickAction[];
  showQuickActions: boolean;
  voiceState: VoiceState;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasReadyAttachment = attachments.some(attachment => attachment.status === 'ready');
  const canSend = !disabled
    && !isPreparingAttachments
    && voiceState.status !== 'listening'
    && voiceState.status !== 'transcribing'
    && (Boolean(draft.trim()) || hasReadyAttachment);

  function handleInput(event: ChangeEvent<HTMLTextAreaElement>) {
    onChangeDraft(event.target.value);
    resizeTextarea(event.target);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!disabled && canAttachMore && event.dataTransfer.files.length > 0) onFiles(event.dataTransfer.files);
  }

  return (
    <div className="reed-composer-region">
      <div className="reed-composer-width">
        {showQuickActions && quickActions.length > 0 ? (
          <div aria-label="Suggested questions" className="reed-quick-actions">
            {quickActions.map(action => (
              <button disabled={disabled} key={action.id} onClick={() => onQuickAction(action.prompt)} type="button">
                {action.label}
              </button>
            ))}
          </div>
        ) : null}

        <div
          className="reed-composer-card"
          onDragOver={event => event.preventDefault()}
          onDrop={handleDrop}
        >
          {attachments.length > 0 ? (
            <div className="reed-attachment-tray">
              {attachments.map(attachment => (
                <div className={`reed-draft-attachment reed-draft-attachment-${attachment.status}`} key={attachment.id}>
                  <img alt={attachment.name} src={attachment.previewUrl} />
                  {attachment.status !== 'ready' ? (
                    <span>{attachment.status === 'preparing' ? 'Uploading' : 'Failed'}</span>
                  ) : null}
                  <button aria-label={`Remove ${attachment.name}`} onClick={() => onRemoveAttachment(attachment.id)} type="button">
                    <ChatIcon name="x" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {voiceState.status === 'transcribing' ? (
            <div aria-live="polite" className="reed-voice-status"><span className="reed-voice-pulse" />Transcribing voice…</div>
          ) : (
            <textarea
              aria-label="Message Reed"
              disabled={disabled || voiceState.status === 'listening'}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? 'Reed is thinking' : voiceState.status === 'listening' ? 'Listening…' : 'Message Reed'}
              ref={textareaRef}
              rows={1}
              value={draft}
            />
          )}

          <div className="reed-composer-toolbar">
            <div className="reed-composer-tools">
              <button
                aria-label="Attach images"
                disabled={disabled || !canAttachMore || voiceState.status === 'listening' || voiceState.status === 'transcribing'}
                onClick={() => fileInputRef.current?.click()}
                title="Attach images"
                type="button"
              >
                <ChatIcon name="image" />
              </button>
              <input
                accept="image/*"
                hidden
                multiple
                onChange={event => {
                  if (event.target.files) onFiles(event.target.files);
                  event.target.value = '';
                }}
                ref={fileInputRef}
                type="file"
              />

              <button
                aria-label={voiceState.status === 'failed' ? 'Retry voice transcription' : voiceState.status === 'listening' ? 'Stop voice input' : 'Start voice input'}
                className={voiceState.status === 'listening' ? 'reed-voice-button-active' : undefined}
                disabled={disabled || voiceState.status === 'transcribing'}
                onClick={voiceState.status === 'failed' ? onRetryVoice : voiceState.status === 'listening' ? onStopVoice : onStartVoice}
                title={voiceState.status === 'failed' ? 'Retry transcription' : voiceState.status === 'listening' ? 'Stop listening' : 'Use voice'}
                type="button"
              >
                <ChatIcon name={voiceState.status === 'failed' ? 'refresh' : voiceState.status === 'listening' ? 'stop' : 'mic'} />
                {voiceState.status === 'listening' ? <VoiceMeter level={voiceState.level} /> : null}
              </button>
            </div>

            <button aria-label="Send message" className="reed-send-button" disabled={!canSend} onClick={onSend} title="Send" type="button">
              <ChatIcon name="arrow-up" />
            </button>
          </div>
        </div>

        {error || voiceState.error ? <p aria-live="assertive" className="reed-composer-error">{error ?? voiceState.error}</p> : null}
        <p className="reed-composer-hint">Enter to send · Shift + Enter for a new line · Drop images anywhere on the composer</p>
      </div>
    </div>
  );
}

function VoiceMeter({ level }: { level: number }) {
  return (
    <span aria-hidden="true" className="reed-voice-meter">
      {[0.55, 1, 0.72].map((weight, index) => (
        <i key={index} style={{ height: `${5 + Math.round(level * weight * 12)}px` }} />
      ))}
    </span>
  );
}

function resizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(160, textarea.scrollHeight)}px`;
}

'use client';

/* Signed Convex URLs should not be transformed by the Next image pipeline. */
/* eslint-disable @next/next/no-img-element */

import { useState, type RefObject, type UIEvent } from 'react';
import { LoopMark } from '../loop-mark';
import { ChatIcon } from './chat-icon';
import type { ChatMessage } from './reed-chat-types';

export function ReedChatThread({
  hasMoreMessages,
  isLoadingInitialMessages,
  isLoadingOlderMessages,
  messages,
  onLoadOlderMessages,
  onRetryAssistantMessage,
  onScroll,
  scrollRef,
}: {
  hasMoreMessages: boolean;
  isLoadingInitialMessages: boolean;
  isLoadingOlderMessages: boolean;
  messages: ChatMessage[];
  onLoadOlderMessages: () => void;
  onRetryAssistantMessage: (message: ChatMessage) => void;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const [openImage, setOpenImage] = useState<string | null>(null);

  return (
    <>
      <div
        aria-busy={isLoadingInitialMessages}
        aria-label="Conversation with Reed"
        aria-live="polite"
        className="reed-thread-scroll"
        onScroll={onScroll}
        ref={scrollRef}
        role="log"
      >
        <div className="reed-thread">
          {isLoadingInitialMessages ? (
            <div className="reed-thread-loading"><LoopMark expression="thinking" /><span>Loading your conversation…</span></div>
          ) : null}

          {!isLoadingInitialMessages && hasMoreMessages ? (
            <button className="reed-load-older" disabled={isLoadingOlderMessages} onClick={onLoadOlderMessages} type="button">
              {isLoadingOlderMessages ? 'Loading earlier messages…' : 'Load earlier messages'}
            </button>
          ) : null}

          {!isLoadingInitialMessages && messages.length === 0 ? (
            <div className="reed-chat-empty">
              <LoopMark expression="listening" />
              <h1>What are you trying to understand?</h1>
              <p>Bring Reed a decision, a pattern, a concern, or a training question.</p>
            </div>
          ) : null}

          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const showDate = !previous || !isSameDay(previous.createdAt, message.createdAt);
            return (
              <div className="reed-message-cluster" key={message.id}>
                {showDate ? <DateIndicator createdAt={message.createdAt} /> : null}
                <MessageRow
                  message={message}
                  onOpenImage={setOpenImage}
                  onRetryAssistantMessage={onRetryAssistantMessage}
                />
              </div>
            );
          })}
          <div aria-hidden="true" className="reed-thread-end" />
        </div>
      </div>

      {openImage ? (
        <div aria-label="Image preview" aria-modal="true" className="reed-image-lightbox" onClick={() => setOpenImage(null)} role="dialog">
          <button aria-label="Close image preview" className="reed-lightbox-close" onClick={() => setOpenImage(null)} type="button">
            <ChatIcon name="x" />
          </button>
          <img alt="Conversation attachment enlarged" onClick={event => event.stopPropagation()} src={openImage} />
        </div>
      ) : null}
    </>
  );
}

function MessageRow({
  message,
  onOpenImage,
  onRetryAssistantMessage,
}: {
  message: ChatMessage;
  onOpenImage: (url: string) => void;
  onRetryAssistantMessage: (message: ChatMessage) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === 'assistant';
  const isPending = isAssistant && message.status === 'pending';
  const showActions = isAssistant
    && !message.isAgentThinkingMessage
    && Boolean(message.text.trim())
    && (message.status === 'failed' || message.status === 'sent');

  async function copyMessage() {
    await navigator.clipboard.writeText(message.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <article className={`reed-message-row reed-message-row-${message.role}`}>
      <div className={`reed-message-bubble reed-message-bubble-${message.role}`}>
        {message.attachments.length > 0 ? (
          <div className="reed-message-images">
            {message.attachments.map(image => (
              <button key={image.id} onClick={() => onOpenImage(image.url)} type="button">
                <img alt="Conversation attachment" src={image.url} />
                {image.status === 'pending' ? <span>Reading</span> : null}
                {image.status === 'failed' ? <span>Unavailable</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        {isPending ? <TypingDots /> : message.text.trim() ? <p>{message.text}</p> : null}

        {showActions ? (
          <div className="reed-message-actions">
            <div>
              {message.status === 'failed' ? (
                <button aria-label="Retry Reed response" onClick={() => onRetryAssistantMessage(message)} title="Retry response" type="button">
                  <ChatIcon name="refresh" />
                </button>
              ) : null}
              <button aria-label="Copy Reed response" onClick={() => void copyMessage()} title={copied ? 'Copied' : 'Copy response'} type="button">
                <ChatIcon name={copied ? 'check' : 'copy'} />
              </button>
            </div>
            <time dateTime={new Date(message.createdAt).toISOString()}>{formatTime(message.createdAt)}</time>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function DateIndicator({ createdAt }: { createdAt: number }) {
  return <div className="reed-date-indicator"><time dateTime={new Date(createdAt).toISOString()}>{formatDate(createdAt)}</time></div>;
}

function TypingDots() {
  return <div aria-label="Reed is thinking" className="reed-typing-dots"><i /><i /><i /></div>;
}

function formatTime(createdAt: number) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(createdAt);
}

function formatDate(createdAt: number) {
  const date = new Date(createdAt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date.getTime(), today.getTime())) return 'Today';
  if (isSameDay(date.getTime(), yesterday.getTime())) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

function isSameDay(left: number, right: number) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

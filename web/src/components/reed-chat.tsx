'use client';

/* Conversation images use signed Convex URLs and local blob previews, so they bypass Next's image pipeline. */
/* eslint-disable @next/next/no-img-element */

import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { LoopMark } from './loop-mark';

type PendingImage = { file: File; previewUrl: string };

export function ReedChat() {
  const result = useQuery(api.reed.listMessages, { limit: 120 });
  const quickActions = useQuery(api.reed.listQuickActions, {});
  const sendMessage = useMutation(api.reed.sendMessage);
  const generateUploadUrl = useMutation(api.reed.generateImageUploadUrl);
  const [draft, setDraft] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [result?.messages.length]);
  useEffect(() => () => { images.forEach(image => URL.revokeObjectURL(image.previewUrl)); }, [images]);

  async function submit(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const content = (override ?? draft).trim();
    if ((!content && images.length === 0) || sending) return;
    setSending(true);
    setError(null);
    try {
      const attachments = [];
      for (const image of images) {
        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: image.file });
        if (!response.ok) throw new Error('One of the images could not be uploaded.');
        const payload = await response.json() as { storageId: string };
        attachments.push({ storageId: payload.storageId as never });
      }
      await sendMessage({
        attachments: attachments.length ? attachments : undefined,
        clientNonce: crypto.randomUUID(),
        clientNow: currentTimestamp(),
        clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        content,
        source: override ? 'quick-action' : 'typed',
      });
      setDraft('');
      images.forEach(image => URL.revokeObjectURL(image.previewUrl));
      setImages([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send this message.');
    } finally {
      setSending(false);
    }
  }

  function selectImages(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files).filter(file => file.type === 'image/jpeg').slice(0, Math.max(0, 5 - images.length));
    if (selected.length !== files.length) setError('Reed currently accepts up to five JPEG images per message.');
    setImages(current => current.concat(selected.map(file => ({ file, previewUrl: URL.createObjectURL(file) }))));
  }

  return (
    <section className="chat-page">
      <header className="chat-header"><div><p className="eyebrow">Reed</p><h1>Your coaching conversation</h1></div><div className="presence-label"><LoopMark size="small" expression={sending ? 'thinking' : 'listening'} /><span>{sending ? 'Thinking' : 'Here with you'}</span></div></header>
      <div className="chat-body">
        <div className="message-list">
          {result?.messages.length ? result.messages.map(message => <Message key={message._id} message={message} />) : <div className="chat-empty"><LoopMark expression="listening" /><h2>What are you trying to understand?</h2><p>Bring Reed a decision, a pattern, a concern, or a training question.</p></div>}
          <div ref={endRef} />
        </div>
        <div className="composer-dock">
          {quickActions?.length ? <div className="quick-actions">{quickActions.map(action => <button disabled={sending} key={action.id} onClick={() => void submit(undefined, action.prompt)}>{action.label}</button>)}</div> : null}
          {images.length ? <div className="attachment-preview">{images.map((image, index) => <div key={image.previewUrl}><img alt="Pending attachment" src={image.previewUrl} /><button aria-label="Remove image" onClick={() => setImages(current => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</div> : null}
          <form className="composer" onSubmit={event => void submit(event)}>
            <label className="attach-button" title="Attach JPEG images"><input accept="image/jpeg" multiple type="file" onChange={event => selectImages(event.target.files)} /><span>＋</span></label>
            <textarea aria-label="Message Reed" onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Ask Reed…" rows={1} value={draft} />
            <button className="send-button" disabled={sending || (!draft.trim() && images.length === 0)} type="submit">{sending ? '…' : 'Send'}</button>
          </form>
          {error ? <p className="form-error composer-error">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

function Message({ message }: { message: { _id: string; role: 'assistant' | 'user'; content: string; status: 'failed' | 'pending' | 'sent'; createdAt: number; attachments: Array<{ _id: string; url: string }> } }) {
  return <article className={`message message-${message.role}`}><div className="message-meta">{message.role === 'assistant' ? 'Reed' : 'You'} · {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(message.createdAt)}</div>{message.attachments.length ? <div className="message-images">{message.attachments.map(image => <img alt="Conversation attachment" key={image._id} src={image.url} />)}</div> : null}<p>{message.status === 'pending' && !message.content ? 'Thinking…' : message.content}</p></article>;
}

function currentTimestamp() { return Date.now(); }

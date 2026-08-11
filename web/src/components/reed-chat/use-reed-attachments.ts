'use client';

import { useMutation } from 'convex/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { DraftAttachment } from './reed-chat-types';

const MAX_ATTACHMENTS = 5;
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.78;

export function useReedAttachments() {
  const generateUploadUrl = useMutation(api.reed.generateImageUploadUrl);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const attachmentsRef = useRef(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => {
    attachmentsRef.current.forEach(attachment => URL.revokeObjectURL(attachment.previewUrl));
  }, []);

  const prepareFiles = useCallback((input: FileList | File[]) => {
    const files = Array.from(input);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    const available = Math.max(0, MAX_ATTACHMENTS - attachmentsRef.current.length);
    const selected = imageFiles.slice(0, available);

    if (selected.length !== files.length) {
      setLastError(`Reed accepts up to ${MAX_ATTACHMENTS} images per message.`);
    } else {
      setLastError(null);
    }

    const drafts = selected.map<DraftAttachment>(file => ({
      id: `${Date.now()}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
      name: file.name || 'Image',
      previewUrl: URL.createObjectURL(file),
      status: 'preparing',
    }));
    if (drafts.length === 0) return;

    setAttachments(current => current.concat(drafts));
    selected.forEach((file, index) => {
      void prepareAndUpload(file, drafts[index], generateUploadUrl, setAttachments, setLastError);
    });
  }, [generateUploadUrl]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(current => {
      const removed = current.find(attachment => attachment.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter(attachment => attachment.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments(current => {
      current.forEach(attachment => URL.revokeObjectURL(attachment.previewUrl));
      return [];
    });
    setLastError(null);
  }, []);

  const readyAttachments = useMemo(
    () => attachments
      .filter((attachment): attachment is DraftAttachment & { storageId: string } =>
        attachment.status === 'ready' && Boolean(attachment.storageId))
      .map(attachment => ({ storageId: attachment.storageId })),
    [attachments],
  );

  return {
    attachments,
    canAttachMore: attachments.length < MAX_ATTACHMENTS,
    clearAttachments,
    isPreparing: attachments.some(attachment => attachment.status === 'preparing'),
    lastError,
    prepareFiles,
    readyAttachments,
    removeAttachment,
  };
}

async function prepareAndUpload(
  file: File,
  draft: DraftAttachment,
  generateUploadUrl: (args: Record<string, never>) => Promise<string>,
  setAttachments: React.Dispatch<React.SetStateAction<DraftAttachment[]>>,
  setLastError: React.Dispatch<React.SetStateAction<string | null>>,
) {
  try {
    const jpeg = await resizeToJpeg(file);
    const jpegPreviewUrl = URL.createObjectURL(jpeg);
    setAttachments(current => current.map(attachment => {
      if (attachment.id !== draft.id) return attachment;
      URL.revokeObjectURL(attachment.previewUrl);
      return { ...attachment, previewUrl: jpegPreviewUrl };
    }));

    const uploadUrl = await generateUploadUrl({});
    const response = await fetch(uploadUrl, {
      body: jpeg,
      headers: { 'Content-Type': 'image/jpeg' },
      method: 'POST',
    });
    if (!response.ok) throw new Error('Could not upload the selected image.');
    const result = await response.json() as { storageId: string };

    setAttachments(current => current.map(attachment => attachment.id === draft.id
      ? { ...attachment, status: 'ready', storageId: result.storageId }
      : attachment));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not attach this image.';
    setLastError(message);
    setAttachments(current => current.map(attachment => attachment.id === draft.id
      ? { ...attachment, error: message, status: 'failed' }
      : attachment));
  }
}

async function resizeToJpeg(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the selected image.');
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the selected image.')), 'image/jpeg', JPEG_QUALITY);
    });
  } finally {
    bitmap.close();
  }
}

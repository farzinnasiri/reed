import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { ReedDraftAttachment } from './reed.types';

const MAX_ATTACHMENTS = 5;
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.78;

type PendingImage = {
  height?: number;
  name?: string;
  uri: string;
  width?: number;
};

function createDraftId() {
  return `reed-image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function remainingSlots(currentCount: number) {
  return Math.max(0, MAX_ATTACHMENTS - currentCount);
}

function resizeActionForImage(width?: number, height?: number): ImageManipulator.Action[] {
  if (!width || !height) return [];
  const longestEdge = Math.max(width, height);
  if (longestEdge <= MAX_IMAGE_EDGE) return [];
  return width >= height
    ? [{ resize: { width: MAX_IMAGE_EDGE } }]
    : [{ resize: { height: MAX_IMAGE_EDGE } }];
}

async function compressToJpeg(image: PendingImage) {
  return await ImageManipulator.manipulateAsync(
    image.uri,
    resizeActionForImage(image.width, image.height),
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
}

async function uploadJpeg(uploadUrl: string, uri: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Could not prepare the selected image.');
  const blob = await response.blob();
  const uploadResponse = await fetch(uploadUrl, {
    body: blob,
    headers: { 'Content-Type': 'image/jpeg' },
    method: 'POST',
  });
  if (!uploadResponse.ok) throw new Error('Could not upload the selected image.');
  return await uploadResponse.json() as { storageId: Id<'_storage'> };
}

export function useReedAttachments() {
  const generateImageUploadUrl = useMutation(api.reed.generateImageUploadUrl);
  const [attachments, setAttachments] = useState<ReedDraftAttachment[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const canAttachMore = attachments.length < MAX_ATTACHMENTS;
  const isPreparingAttachments = useMemo(
    () => attachments.some(attachment => attachment.status === 'preparing'),
    [attachments],
  );
  const readyAttachmentIds = useMemo(
    () => attachments
      .filter((attachment): attachment is ReedDraftAttachment & { storageId: string } =>
        attachment.status === 'ready' && Boolean(attachment.storageId))
      .map(attachment => ({ storageId: attachment.storageId as Id<'_storage'> })),
    [attachments],
  );

  const prepareAndUpload = useCallback(async (image: PendingImage) => {
    const id = createDraftId();
    setLastError(null);
    setAttachments(current => {
      if (current.length >= MAX_ATTACHMENTS) return current;
      return current.concat({
        id,
        name: image.name ?? 'Image',
        status: 'preparing',
        uri: image.uri,
      });
    });

    try {
      const compressed = await compressToJpeg(image);
      setAttachments(current => current.map(attachment => attachment.id === id
        ? {
            ...attachment,
            height: compressed.height,
            name: image.name ?? 'Image',
            uri: compressed.uri,
            width: compressed.width,
          }
        : attachment));

      const uploadUrl = await generateImageUploadUrl({});
      const uploaded = await uploadJpeg(uploadUrl, compressed.uri);
      setAttachments(current => current.map(attachment => attachment.id === id
        ? { ...attachment, status: 'ready', storageId: uploaded.storageId }
        : attachment));
      if (Platform.OS === 'ios') void Haptics.selectionAsync();
    } catch (error) {
      setAttachments(current => current.map(attachment => attachment.id === id
        ? {
            ...attachment,
            error: error instanceof Error ? error.message : 'Could not attach this image.',
            status: 'failed',
          }
        : attachment));
      setLastError(error instanceof Error ? error.message : 'Could not attach this image.');
    }
  }, [generateImageUploadUrl]);

  const attachFromCamera = useCallback(async () => {
    if (!canAttachMore) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setLastError('Camera access is needed to take a photo for Reed.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    await prepareAndUpload({
      height: asset.height,
      name: asset.fileName ?? 'Camera photo',
      uri: asset.uri,
      width: asset.width,
    });
  }, [canAttachMore, prepareAndUpload]);

  const attachFromLibrary = useCallback(async () => {
    const slots = remainingSlots(attachments.length);
    if (slots <= 0) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
    if (!permission.granted) {
      setLastError('Photo library access is needed to attach images for Reed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection: slots > 1,
      mediaTypes: ['images'],
      orderedSelection: true,
      quality: 1,
      selectionLimit: slots,
    });
    if (result.canceled) return;

    await Promise.all(result.assets.slice(0, slots).map(asset => prepareAndUpload({
      height: asset.height,
      name: asset.fileName ?? 'Library image',
      uri: asset.uri,
      width: asset.width,
    })));
  }, [attachments.length, prepareAndUpload]);

  const attachFromFiles = useCallback(async () => {
    const slots = remainingSlots(attachments.length);
    if (slots <= 0) return;

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: slots > 1,
      type: 'image/*',
    });
    if (result.canceled) return;

    await Promise.all(result.assets.slice(0, slots).map(asset => prepareAndUpload({
      name: asset.name,
      uri: asset.uri,
    })));
  }, [attachments.length, prepareAndUpload]);

  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachments(current => current.filter(attachment => attachment.id !== attachmentId));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setLastError(null);
  }, []);

  return {
    attachFromCamera,
    attachFromFiles,
    attachFromLibrary,
    attachments,
    canAttachMore,
    clearAttachments,
    isPreparingAttachments,
    lastError,
    readyAttachmentIds,
    removeAttachment,
  };
}

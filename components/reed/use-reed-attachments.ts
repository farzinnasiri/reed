import * as DocumentPicker from 'expo-document-picker';
import { fetch as expoFetch } from 'expo/fetch';
import { File as ExpoFile } from 'expo-file-system';
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
const ATTACHMENT_LOG_PREFIX = 'ReedAttachmentUpload';

type PendingImage = {
  height?: number;
  mimeType?: string;
  name?: string;
  uri: string;
  width?: number;
};

type EditedImage = {
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

function logAttachmentStepError(step: string, error: unknown, details?: Record<string, unknown>) {
  console.warn(`${ATTACHMENT_LOG_PREFIX}:${step}`, {
    ...details,
    error: error instanceof Error ? error.message : String(error),
  });
}

function toUserAttachmentError(step: string) {
  switch (step) {
    case 'manipulation':
      return 'Could not prepare the selected image.';
    case 'local-file-read':
      return 'Could not read the prepared image from this device.';
    case 'upload-url':
      return 'Could not start the image upload.';
    case 'storage-upload':
      return 'Could not upload the selected image.';
    default:
      return 'Could not attach this image.';
  }
}

type UploadableJpeg = Blob | ExpoFile;

async function getReadableJpeg(uri: string): Promise<UploadableJpeg> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Prepared image is not readable. status=${response.status}`);
    const blob = await response.blob();
    if (blob.size <= 0) throw new Error('Prepared image blob is empty.');
    return blob;
  }

  const file = new ExpoFile(uri);
  if (!file.exists || file.size <= 0) {
    throw new Error(`Prepared image is not readable. exists=${file.exists} size=${file.size}`);
  }
  return file;
}

function uploadableSize(file: UploadableJpeg) {
  return file.size;
}

function uploadableType(file: UploadableJpeg) {
  return file.type || 'image/jpeg';
}

async function uploadJpeg(uploadUrl: string, file: UploadableJpeg) {
  const uploadResponse = await expoFetch(uploadUrl, {
    body: file,
    headers: { 'Content-Type': 'image/jpeg' },
    method: 'POST',
  });
  if (!uploadResponse.ok) throw new Error('Could not upload the selected image.');
  return await uploadResponse.json() as { storageId: Id<'_storage'> };
}

export function useReedAttachments() {
  const generateImageUploadUrl = useMutation(api.reed.generateImageUploadUrl);
  const [attachments, setAttachments] = useState<ReedDraftAttachment[]>([]);
  const [editingImages, setEditingImages] = useState<PendingImage[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const canAttachMore = attachments.length < MAX_ATTACHMENTS;
  const editingImage = editingImages[0] ?? null;
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

  const openImageEditor = useCallback((images: PendingImage[]) => {
    if (images.length === 0) return;
    setEditingImages(images);
    setLastError(null);
  }, []);

  const closeCurrentEditorImage = useCallback(() => {
    setEditingImages(current => current.slice(1));
  }, []);

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
      let compressed: ImageManipulator.ImageResult;
      try {
        compressed = await compressToJpeg(image);
      } catch (error) {
        logAttachmentStepError('manipulation', error, {
          sourceMimeType: image.mimeType ?? 'unknown',
          sourceName: image.name ?? 'unknown',
          sourceUriScheme: image.uri.split(':')[0],
        });
        throw new Error(toUserAttachmentError('manipulation'));
      }
      setAttachments(current => current.map(attachment => attachment.id === id
        ? {
            ...attachment,
            height: compressed.height,
            name: image.name ?? 'Image',
            uri: compressed.uri,
            width: compressed.width,
          }
        : attachment));

      let file: UploadableJpeg;
      try {
        file = await getReadableJpeg(compressed.uri);
      } catch (error) {
        logAttachmentStepError('local-file-read', error, { compressedUriScheme: compressed.uri.split(':')[0] });
        throw new Error(toUserAttachmentError('local-file-read'));
      }

      let uploadUrl: string;
      try {
        uploadUrl = await generateImageUploadUrl({});
      } catch (error) {
        logAttachmentStepError('upload-url', error);
        throw new Error(toUserAttachmentError('upload-url'));
      }

      let uploaded: { storageId: Id<'_storage'> };
      try {
        uploaded = await uploadJpeg(uploadUrl, file);
      } catch (error) {
        logAttachmentStepError('storage-upload', error, { fileSize: uploadableSize(file), mimeType: uploadableType(file) });
        throw new Error(toUserAttachmentError('storage-upload'));
      }
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

  const uploadEditedImage = useCallback((editedImage: EditedImage) => {
    if (!editingImage) return;
    void prepareAndUpload({
      ...editingImage,
      height: editedImage.height,
      name: editedImage.name ?? editingImage.name,
      uri: editedImage.uri,
      width: editedImage.width,
    });
    closeCurrentEditorImage();
  }, [closeCurrentEditorImage, editingImage, prepareAndUpload]);

  const cancelImageEditor = useCallback(() => {
    closeCurrentEditorImage();
  }, [closeCurrentEditorImage]);

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
    openImageEditor([{
      height: asset.height,
      mimeType: asset.mimeType,
      name: asset.fileName ?? 'Camera photo',
      uri: asset.uri,
      width: asset.width,
    }]);
  }, [canAttachMore, openImageEditor]);

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
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      quality: 1,
      selectionLimit: slots,
    });
    if (result.canceled) return;

    openImageEditor(result.assets.slice(0, slots).map(asset => ({
      height: asset.height,
      mimeType: asset.mimeType,
      name: asset.fileName ?? 'Library image',
      uri: asset.uri,
      width: asset.width,
    })));
  }, [attachments.length, openImageEditor]);

  const attachFromFiles = useCallback(async () => {
    const slots = remainingSlots(attachments.length);
    if (slots <= 0) return;

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: slots > 1,
      type: 'image/*',
    });
    if (result.canceled) return;

    openImageEditor(result.assets.slice(0, slots).map(asset => ({
      mimeType: asset.mimeType,
      name: asset.name,
      uri: asset.uri,
    })));
  }, [attachments.length, openImageEditor]);

  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachments(current => current.filter(attachment => attachment.id !== attachmentId));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setEditingImages([]);
    setLastError(null);
  }, []);

  return {
    attachFromCamera,
    attachFromFiles,
    attachFromLibrary,
    attachments,
    cancelImageEditor,
    canAttachMore,
    clearAttachments,
    editingImage,
    isPreparingAttachments,
    lastError,
    readyAttachmentIds,
    removeAttachment,
    uploadEditedImage,
  };
}

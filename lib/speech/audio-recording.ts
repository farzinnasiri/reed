import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export type LocalSpeechRecording = {
  durationMs: number;
  mimeType: string;
  uri: string;
};

const MIN_RECORDING_MS = 350;

export class SpeechRecordingError extends Error {
  code: 'empty_recording' | 'permission_denied' | 'recording_failed';

  constructor(message: string, code: SpeechRecordingError['code']) {
    super(message);
    this.name = 'SpeechRecordingError';
    this.code = code;
  }
}

export async function startLocalSpeechRecording(recorder: AudioRecorder) {
  const permission = await requestRecordingPermissionsAsync();
  if (!permission.granted) {
    throw new SpeechRecordingError('Microphone permission is required.', 'permission_denied');
  }

  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });

  await recorder.prepareToRecordAsync();
  recorder.record();
  return Date.now();
}

export async function stopLocalSpeechRecording(
  recorder: AudioRecorder,
  startedAt: number
): Promise<LocalSpeechRecording> {
  await recorder.stop();
  const durationMs = Math.max(0, Date.now() - startedAt);
  const uri = recorder.uri
    ? await resolveAndroidRecordingUri(recorder.uri, Date.now())
    : null;

  await setAudioModeAsync({
    allowsRecording: false,
  }).catch(() => {});

  if (!uri || durationMs < MIN_RECORDING_MS) {
    throw new SpeechRecordingError('Recording is too short.', 'empty_recording');
  }

  return {
    durationMs,
    mimeType: getRecordingMimeType(uri),
    uri,
  };
}

export async function clearLocalSpeechRecording(recording: LocalSpeechRecording | null) {
  if (!recording) return;

  if (recording.uri.startsWith('blob:')) {
    URL.revokeObjectURL(recording.uri);
    return;
  }

  if (Platform.OS === 'web') return;

  try {
    await FileSystem.deleteAsync(recording.uri, { idempotent: true });
  } catch {
    // Cleanup is best-effort; stale cache files are recoverable.
  }
}

async function resolveAndroidRecordingUri(uri: string, stoppedAt: number) {
  if (Platform.OS !== 'android') return uri;

  const info = await FileSystem.getInfoAsync(uri).catch(() => null);
  if (info?.exists && !info.isDirectory && info.size > 0) return uri;

  const audioDirectory = `${FileSystem.cacheDirectory ?? ''}Audio/`;
  if (!audioDirectory.startsWith('file://')) return uri;

  const names = await FileSystem.readDirectoryAsync(audioDirectory).catch(() => []);
  let best: { diff: number; uri: string } | null = null;

  for (const name of names) {
    const candidateUri = `${audioDirectory}${name}`;
    const candidate = await FileSystem.getInfoAsync(candidateUri).catch(() => null);
    if (!candidate?.exists || candidate.isDirectory || candidate.size <= 0) continue;
    const diff = Math.abs(candidate.modificationTime * 1000 - stoppedAt);
    if (!best || diff < best.diff) {
      best = { diff, uri: candidateUri };
    }
  }

  return best?.uri ?? uri;
}

function getRecordingMimeType(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.webm') || lower.startsWith('blob:')) return 'audio/webm';
  if (lower.endsWith('.aac')) return 'audio/aac';
  return 'audio/mp4';
}

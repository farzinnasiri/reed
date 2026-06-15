import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';
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
  const uri = recorder.uri;

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
    const fileSystem = await import('expo-file-system');
    new fileSystem.File(recording.uri).delete();
  } catch {
    // Cleanup is best-effort; stale cache files are recoverable.
  }
}

function getRecordingMimeType(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.webm') || lower.startsWith('blob:')) return 'audio/webm';
  if (lower.endsWith('.aac')) return 'audio/aac';
  return 'audio/mp4';
}

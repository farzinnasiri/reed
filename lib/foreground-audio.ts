import { Platform } from 'react-native';

import type { AudioPlayer, AudioSource } from 'expo-audio';
type AudioModule = typeof import('expo-audio');

let audioModulePromise: Promise<AudioModule | null> | null = null;
const audioPlayers = new Map<AudioSource, AudioPlayer>();
let generation = 0;

async function getAudioModule() {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!audioModulePromise) {
    audioModulePromise = import('expo-audio');
  }

  return audioModulePromise;
}

export async function prepareForegroundSoundsAsync(sources: AudioSource[]) {
  const ticket = generation;
  const Audio = await getAudioModule();
  if (!Audio || ticket !== generation) return;
  for (const source of sources) {
    if (!audioPlayers.has(source)) audioPlayers.set(source, Audio.createAudioPlayer(source));
  }
}

export function unlockForegroundSounds() { /* Native playback needs no browser unlock. */ }

export function stopForegroundSounds() {
  generation++;
  for (const player of audioPlayers.values()) { try { player.pause(); } catch { /* Best effort. */ } }
}

export function releaseForegroundSounds() {
  stopForegroundSounds();
  for (const player of audioPlayers.values()) { try { player.release(); } catch { /* Best effort. */ } }
  audioPlayers.clear();
}

export async function playForegroundSoundAsync(source: AudioSource, options: { volume?: number; current?: () => boolean } = {}) {
  stopForegroundSounds();
  const ticket = generation;
  const current = () => ticket === generation && (options.current?.() ?? true);
  const Audio = await getAudioModule();
  if (!Audio || !current()) return false;

  // Voice recording changes the global session, so restore this for every outcome.
  await Audio.setAudioModeAsync({
    allowsRecording: false,
    interruptionMode: 'mixWithOthers',
    playsInSilentMode: false,
    shouldPlayInBackground: false,
  });
  if (!current()) return false;

  let player = audioPlayers.get(source);
  if (!player) {
    player = Audio.createAudioPlayer(source);
    audioPlayers.set(source, player);
  }

  await player.seekTo(0);
  if (!current()) return false;
  player.volume = options.volume ?? 1;
  player.play();
  return true;
}

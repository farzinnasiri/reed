import { Platform } from 'react-native';

import type { AudioPlayer, AudioSource } from 'expo-audio';
type AudioModule = typeof import('expo-audio');

let audioModeConfigured = false;
let audioModulePromise: Promise<AudioModule | null> | null = null;
const audioPlayers = new Map<AudioSource, AudioPlayer>();

async function getAudioModule() {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!audioModulePromise) {
    audioModulePromise = import('expo-audio');
  }

  return audioModulePromise;
}

export async function playForegroundSoundAsync(source: AudioSource) {
  const Audio = await getAudioModule();
  if (!Audio) {
    return false;
  }

  if (!audioModeConfigured) {
    await Audio.setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
    audioModeConfigured = true;
  }

  let player = audioPlayers.get(source);
  if (!player) {
    player = Audio.createAudioPlayer(source);
    audioPlayers.set(source, player);
  }

  await player.seekTo(0);
  player.play();
  return true;
}

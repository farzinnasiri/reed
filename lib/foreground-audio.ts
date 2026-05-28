import { Platform } from 'react-native';

type AudioPlayer = {
  play: () => void;
  seekTo: (seconds: number) => void;
};

type AudioModule = {
  createAudioPlayer: (source: unknown) => AudioPlayer;
  setAudioModeAsync: (mode: {
    interruptionMode?: 'mixWithOthers';
    playsInSilentMode?: boolean;
    shouldPlayInBackground?: boolean;
  }) => Promise<void>;
};

let audioModeConfigured = false;
let audioModulePromise: Promise<AudioModule | null> | null = null;
const audioPlayers = new Map<unknown, AudioPlayer>();

async function getAudioModule() {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!audioModulePromise) {
    audioModulePromise = import('expo-audio').then(
      module => module as unknown as AudioModule,
    );
  }

  return audioModulePromise;
}

export async function playForegroundSoundAsync(source: unknown) {
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

  player.seekTo(0);
  player.play();
  return true;
}

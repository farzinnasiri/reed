import { Platform } from 'react-native';

const SWIPE_COMMIT_CUE = require('../assets/sounds/rest_timer_complete.wav');

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

type HapticsModule = {
  ImpactFeedbackStyle: {
    Light: unknown;
  };
  impactAsync: (style: unknown) => Promise<void>;
};

let audioModeConfigured = false;
let audioModulePromise: Promise<AudioModule | null> | null = null;
let hapticsModulePromise: Promise<HapticsModule | null> | null = null;
let swipeCommitCuePlayer: AudioPlayer | null = null;

async function getAudioModule() {
  if (Platform.OS === 'web') {
    return null;
  }

  audioModulePromise ??= import('expo-audio').then(
    module => module as unknown as AudioModule,
  );

  return audioModulePromise;
}

async function getHapticsModule() {
  if (Platform.OS === 'web') {
    return null;
  }

  hapticsModulePromise ??= import('expo-haptics').then(
    module => module as unknown as HapticsModule,
  );

  return hapticsModulePromise;
}

async function playSwipeCommitCueAsync() {
  const Audio = await getAudioModule();
  if (!Audio) {
    return;
  }

  if (!audioModeConfigured) {
    await Audio.setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
    audioModeConfigured = true;
  }

  swipeCommitCuePlayer ??= Audio.createAudioPlayer(SWIPE_COMMIT_CUE);
  swipeCommitCuePlayer.seekTo(0);
  swipeCommitCuePlayer.play();
}

async function playSwipeCommitHapticAsync() {
  const Haptics = await getHapticsModule();
  if (!Haptics) {
    return;
  }

  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function playOnboardingSwipeCommitFeedback() {
  void playSwipeCommitHapticAsync().catch(() => {});
  void playSwipeCommitCueAsync().catch(() => {});
}

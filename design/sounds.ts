import { playForegroundSoundAsync, stopForegroundSounds } from '@/lib/foreground-audio';
import { createSoundPolicy, reedSounds, type SoundMoment } from './sound-policy';

export const soundSources = {
  workoutStart: require('../assets/sounds/workout_start.mp3'),
  workoutComplete: require('../assets/sounds/workout_complete.mp3'),
  restComplete: require('../assets/sounds/rest_timer_complete.wav'),
  reply: require('../assets/sounds/reed_reply.mp3'),
  saved: require('../assets/sounds/saved.mp3'),
  onboardingComplete: require('../assets/sounds/onboarding_complete.mp3'),
};

export const soundPolicy = createSoundPolicy(
  (moment, current) => playForegroundSoundAsync(soundSources[moment], { volume: reedSounds.volume[moment], current }),
  stopForegroundSounds,
);
export const workoutStarted = (id?: string) => { void soundPolicy.emit('workoutStart', id && `start:${id}`); };
export const workoutCompleted = (id: string) => { void soundPolicy.emit('workoutComplete', `finish:${id}`); };
export const replyArrived = (id: string, completedAt?: number) => { void soundPolicy.emit('reply', `reply:${id}`, completedAt); };
export const restCompleted = (key: string) => soundPolicy.emit('restComplete', `rest:${key}`);
export const saved = () => { void soundPolicy.emit('saved'); };
export const onboardingCompleted = () => { void soundPolicy.emit('onboardingComplete'); };
export const previewSound = (moment: SoundMoment) => { void soundPolicy.emit(moment); };

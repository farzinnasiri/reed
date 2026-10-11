import { Asset } from 'expo-asset';
import type { AudioSource } from 'expo-audio';

let context: AudioContext | null = null;
let generation = 0;
const buffers = new Map<AudioSource, Promise<AudioBuffer>>();
const voices = new Set<AudioBufferSourceNode>();

function getContext() {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  context ??= new window.AudioContext();
  return context;
}
function buffer(source: AudioSource, audio: AudioContext) {
  let pending = buffers.get(source);
  if (!pending) {
    const uri = typeof source === 'number' ? Asset.fromModule(source).uri
      : typeof source === 'string' ? source : source?.uri;
    pending = (async () => {
      if (!uri) throw new Error('No audio asset');
      const response = await fetch(uri);
      if (!response.ok) throw new Error('Audio asset unavailable');
      return audio.decodeAudioData(await response.arrayBuffer());
    })();
    buffers.set(source, pending);
    void pending.catch(() => buffers.delete(source));
  }
  return pending;
}
export async function prepareForegroundSoundsAsync(sources: AudioSource[]) {
  const audio = getContext();
  if (audio) await Promise.allSettled(sources.map(source => buffer(source, audio)));
}
/** Called synchronously inside a trusted gesture. No sound and no pending replay. */
export function unlockForegroundSounds() {
  const audio = getContext();
  if (audio && audio.state === 'suspended') void audio.resume().catch(() => {});
}
export function stopForegroundSounds() {
  generation++;
  for (const voice of voices) { try { voice.stop(); } catch { /* Already ended. */ } }
  voices.clear();
}
export function releaseForegroundSounds() {
  stopForegroundSounds(); buffers.clear();
  if (context) void context.close().catch(() => {});
  context = null;
}
export async function playForegroundSoundAsync(source: AudioSource, options: { volume?: number; current?: () => boolean } = {}) {
  const audio = context;
  if (!audio || audio.state !== 'running' || document.hidden) return false;
  stopForegroundSounds();
  const ticket = generation;
  const decoded = await buffer(source, audio);
  if (ticket !== generation || audio.state !== 'running' || document.hidden || options.current && !options.current()) return false;
  const voice = audio.createBufferSource();
  const gain = audio.createGain();
  voice.buffer = decoded;
  gain.gain.value = options.volume ?? 1;
  voice.connect(gain); gain.connect(audio.destination);
  voices.add(voice);
  voice.onended = () => { voices.delete(voice); voice.disconnect(); gain.disconnect(); };
  voice.start();
  return true;
}

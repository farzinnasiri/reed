import assert from 'node:assert/strict';
import test from 'node:test';
import { createSoundPolicy, type SoundMoment } from '../design/sound-policy';
import { platformModule } from './helpers/platform-module';

test('sounds stay silent until loaded and foreground; muted and old arrivals never replay', async () => {
  let now = 1000;
  const calls: SoundMoment[] = [];
  const policy = createSoundPolicy(async moment => { calls.push(moment); return true; }, () => {}, () => now);
  await policy.emit('reply', 'history');
  policy.hydrate(true); policy.setActive(true);
  await policy.emit('reply', 'history');
  policy.setEnabled(false); policy.hydrate(true);
  await policy.emit('reply', 'muted');
  policy.setEnabled(true);
  await policy.emit('reply', 'muted');
  policy.setActive(false); now += 1000; policy.setActive(true);
  await policy.emit('reply', 'old', 1500);
  await policy.emit('reply', 'fresh', now);
  await policy.emit('reply', 'fresh', now);
  assert.deepEqual(calls, ['reply']);
});

test('a workout start retries when sounds load or playback was refused; hidden replies stay consumed', async () => {
  let now = 1000;
  let allow = false;
  const calls: SoundMoment[] = [];
  const policy = createSoundPolicy(async moment => {
    if (!allow) return false;
    calls.push(moment); return true;
  }, () => {}, () => now);
  policy.setActive(true);
  assert.equal(await policy.emit('workoutStart', 'start:1'), false);
  allow = true;
  policy.hydrate(true);
  await policy.retryPending();
  assert.deepEqual(calls, ['workoutStart']);
  assert.equal(await policy.emit('workoutStart', 'start:1'), false);

  now += 800;
  allow = false;
  assert.equal(await policy.emit('workoutStart', 'start:2'), false);
  allow = true;
  assert.equal(await policy.retryPending(), true);
  assert.deepEqual(calls, ['workoutStart', 'workoutStart']);

  policy.setActive(false); now += 1000; policy.setActive(true);
  await policy.emit('reply', 'while-hidden', now - 500);
  await policy.emit('reply', 'while-hidden', now);
  assert.deepEqual(calls, ['workoutStart', 'workoutStart']);
});

test('workout outcomes replace reply cues; rapid repeats and voice recordings remain silent', async () => {
  let now = 1000;
  const calls: SoundMoment[] = [];
  const policy = createSoundPolicy(async moment => { calls.push(moment); return true; }, () => {}, () => now);
  policy.hydrate(true); policy.setActive(true);
  await policy.emit('reply'); now += 50;
  await policy.emit('workoutComplete', 'finish');
  await policy.emit('reply'); await policy.emit('workoutComplete', 'finish');
  const first = Symbol(), second = Symbol();
  policy.setRecording(first, true); policy.setRecording(second, true);
  now += 800; await policy.emit('restComplete', 'rest');
  policy.setRecording(first, false); await policy.emit('saved');
  policy.setRecording(second, false); await policy.emit('saved');
  assert.deepEqual(calls, ['reply', 'workoutComplete', 'saved']);
});

test('muting, recording, hiding and expiry invalidate a cue waiting for playback', async () => {
  for (const interrupt of ['mute', 'record', 'hide', 'expire']) {
    let now = 1000;
    let resume!: () => void;
    let audible = false;
    const policy = createSoundPolicy(async (_moment, current) => {
      await new Promise<void>(resolve => { resume = resolve; });
      audible = current(); return audible;
    }, () => {}, () => now);
    policy.hydrate(true); policy.setActive(true);
    const playing = policy.emit('workoutStart');
    if (interrupt === 'mute') policy.setEnabled(false);
    if (interrupt === 'record') policy.setRecording(Symbol(), true);
    if (interrupt === 'hide') policy.setActive(false);
    if (interrupt === 'expire') now += 1001;
    resume();
    assert.equal(await playing, false, interrupt);
    assert.equal(audible, false);
  }
  const unavailable = createSoundPolicy(async () => { throw new Error('Unavailable'); }, () => {});
  unavailable.hydrate(true); unavailable.setActive(true);
  assert.equal(await unavailable.emit('restComplete'), false);
});

test('native cues mix with music, respect silent mode and cancel before a pending seek completes', async () => {
  let finishSeek!: () => void;
  let plays = 0;
  let releases = 0;
  let mode: unknown;
  const audio = platformModule<typeof import('../lib/foreground-audio')>('lib/foreground-audio.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-audio': {
      setAudioModeAsync: async (value: unknown) => { mode = value; },
      createAudioPlayer: () => ({ pause() {}, release() { releases++; }, play() { plays++; },
        seekTo: () => new Promise<void>(resolve => { finishSeek = resolve; }) }),
    },
  });
  const playing = audio.playForegroundSoundAsync(1);
  await new Promise(resolve => setImmediate(resolve));
  audio.stopForegroundSounds(); finishSeek();
  assert.equal(await playing, false);
  assert.equal(plays, 0);
  assert.deepEqual(mode, { allowsRecording: false, interruptionMode: 'mixWithOthers', playsInSilentMode: false, shouldPlayInBackground: false });
  audio.releaseForegroundSounds();
  assert.equal(releases, 1);
});

test('web never queues locked audio; trusted unlock permits a cue and mute cancels decoding', async () => {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const priorFetch = globalThis.fetch;
  let decoded!: () => void;
  let starts = 0;
  let resumes = 0;
  class AudioContextMock {
    state = 'suspended'; destination = {};
    resume() { resumes++; this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    decodeAudioData() { return new Promise(resolve => { decoded = () => resolve({}); }); }
    createBufferSource() { return { connect() {}, disconnect() {}, start() { starts++; }, stop() {} }; }
    createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
  }
  Object.defineProperty(globalThis, 'window', { value: { AudioContext: AudioContextMock }, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: { hidden: false }, configurable: true });
  globalThis.fetch = async () => new Response(new ArrayBuffer(1));
  try {
    const audio = platformModule<typeof import('../lib/foreground-audio.web')>('lib/foreground-audio.web.ts', {
      'expo-asset': { Asset: { fromModule: () => ({ uri: '/cue.mp3' }) } },
    });
    const preparing = audio.prepareForegroundSoundsAsync([1]);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(await audio.playForegroundSoundAsync(1), false);
    audio.unlockForegroundSounds();
    assert.equal(resumes, 1); assert.equal(starts, 0);
    const pending = audio.playForegroundSoundAsync(1);
    audio.stopForegroundSounds(); decoded(); await preparing;
    assert.equal(await pending, false); assert.equal(starts, 0);
    assert.equal(await audio.playForegroundSoundAsync(1, { volume: 0.12 }), true);
    assert.equal(starts, 1);
    audio.releaseForegroundSounds();
  } finally {
    globalThis.fetch = priorFetch;
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('muted native rest notifications use a silent Android channel and explicit silent content', async () => {
  const channels: unknown[] = [], notifications: unknown[] = [];
  const alerts = platformModule<typeof import('../lib/background-alerts')>('lib/background-alerts.ts', {
    'react-native': { Platform: { OS: 'android' }, AppState: { currentState: 'background' } },
    'expo-notifications': {
      AndroidImportance: { MAX: 5 }, AndroidNotificationVisibility: { PUBLIC: 1 },
      SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
      getPermissionsAsync: async () => ({ granted: true }), setNotificationHandler() {},
      setNotificationChannelAsync: async (_id: string, channel: unknown) => { channels.push(channel); },
      scheduleNotificationAsync: async (notification: unknown) => { notifications.push(notification); return 'rest'; },
    },
  });
  const { silentRestCompleteAlert } = platformModule<typeof import('../lib/rest-alert-definition')>('lib/rest-alert-definition.ts', {});
  await alerts.scheduleBackgroundAlertAsync({ definition: silentRestCompleteAlert, fireAt: Date.now() + 60_000,
    payload: { exerciseName: 'Test', nextSetNumber: 2 } });
  assert.equal((channels[0] as { sound: unknown }).sound, null);
  assert.equal((notifications[0] as { content: { sound: unknown } }).content.sound, false);
});

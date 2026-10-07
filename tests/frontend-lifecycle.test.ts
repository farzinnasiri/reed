import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { platformModule } from './helpers/platform-module';
import type { RestCard } from '../components/workout/workout-surface.types';

const dom = new JSDOM('<!doctype html><div id="root"></div>');
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
});
const event = { end() {}, fail() {} };
const observability = { startClientWideEvent: () => event };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

test('rest owner schedules an extended deadline and cancels on pause and removal', async () => {
  const scheduled: number[] = [];
  const cleared: string[] = [];
  const { WorkoutRestEffects } = platformModule<typeof import('../components/workout/workout-rest-effects')>(
    'components/workout/workout-rest-effects.tsx',
    {
      'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
      '@/lib/client-observability': observability,
      [process.cwd() + '/lib/client-observability.ts']: observability,
      '@/lib/rest-timer-alerts': {
        ensureRestTimerAlertPermissionsAsync: async () => 'granted',
        playRestTimerCompletionCueAsync: async () => {},
      },
      '@/lib/rest-alert-definition': { restCompleteAlert: {} },
      '@/lib/background-alerts': {
        clearBackgroundAlertAsync: async (id: string | null) => {
          if (id) cleared.push(id);
        },
        scheduleBackgroundAlertAsync: async ({ fireAt }: { fireAt: number }) => {
          scheduled.push(Math.ceil((fireAt - Date.now()) / 1000));
          return { notificationId: String(scheduled.length), status: 'scheduled' };
        },
      },
    },
  );
  const root = createRoot(document.getElementById('root')!);
  const card = {
    durationSeconds: 15,
    remainingSeconds: 15,
    startedAt: Date.now(),
    isRunning: true,
    isComplete: false,
    exerciseName: 'Squat',
    nextSetNumber: 2,
    previousSetSummary: null,
    sessionExerciseId: 'exercise',
  } as RestCard;
  const render = (restCard: RestCard | null) =>
    act(async () => root.render(createElement(WorkoutRestEffects, { restCard, onPermissionDenied() {} })));
  await render(card);
  await render({ ...card, durationSeconds: 45, remainingSeconds: 45 });
  assert.deepEqual(scheduled, [15, 45]);
  await render({ ...card, isRunning: false });
  assert.deepEqual(cleared, ['1', '2']);
  await render(null);
  await act(async () => root.unmount());
});

test('speech reset rejects late transcripts; repeated stop transcribes once', async () => {
  const result = deferred<{ text: string }>();
  const texts: string[] = [];
  let transcriptions = 0;
  const recorder = { stop: async () => {} };
  const getToken = async () => 'test-token';
  const { useSpeechDraft } = platformModule<typeof import('../lib/speech/use-speech-draft')>(
    'lib/speech/use-speech-draft.ts',
    {
      '@clerk/expo': { useAuth: () => ({ getToken }) },
      'expo-audio': {
        RecordingPresets: { HIGH_QUALITY: {} },
        useAudioRecorder: () => recorder,
        useAudioRecorderState: () => ({}),
      },
      './audio-recording': {
        startLocalSpeechRecording: async () => 1,
        stopLocalSpeechRecording: async () => ({ uri: 'test', durationMs: 1000, mimeType: 'audio/mp4' }),
        clearLocalSpeechRecording: async () => {},
      },
      './transcription-api': {
        transcribeLocalSpeechRecording: () => {
          transcriptions++;
          return result.promise;
        },
      },
    },
  );
  let voice!: ReturnType<typeof useSpeechDraft>;
  const onText = (text: string) => texts.push(text);
  function Voice() {
    voice = useSpeechDraft('chat', onText);
    return null;
  }
  const root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(createElement(Voice)));
  await act(async () => {
    await Promise.all([voice.start(), voice.start()]);
  });
  let stopping!: Promise<void>;
  await act(async () => {
    stopping = voice.stop();
    void voice.stop();
  });
  assert.equal(transcriptions, 1);
  await act(async () => voice.reset());
  assert.equal(voice.state.status, 'idle');
  await act(async () => {
    result.resolve({ text: 'Obsolete draft' });
    await stopping;
  });
  assert.deepEqual(texts, []);
  assert.equal(voice.state.status, 'idle');
  await act(async () => root.unmount());
});

test('navigation cannot retain the active view when opening a historical session', async () => {
  const { useWorkoutNavigation } = await import('../components/workout/use-workout-navigation');
  let navigation!: ReturnType<typeof useWorkoutNavigation>;
  function Navigation() {
    navigation = useWorkoutNavigation();
    return null;
  }
  const root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(createElement(Navigation)));
  await act(async () => navigation.openActive());
  await act(async () => navigation.showPage('exercise'));
  await act(async () => navigation.applyIntent({ kind: 'session', sessionId: 'past' }, true));
  assert.deepEqual(navigation.view, { kind: 'past-session', sessionId: 'past' });
  await act(async () => navigation.openHistory());
  assert.deepEqual(navigation.view, { kind: 'history' });
  await act(async () => navigation.applyIntent({ kind: 'start' }, false));
  assert.deepEqual(navigation.view, { kind: 'draft' });
  await act(async () => root.unmount());
});

test('production composer provider isolates meter updates from text subscribers', async () => {
  const React = await import('react');
  let changeLevel!: (value: number) => void;
  const attachments = {};
  const command = async () => {};
  const { ReedComposerDraftProvider, useSharedComposerDraft, useComposerVoiceLevel } = platformModule<
    typeof import('../components/reed/reed-composer-context')
  >('components/reed/reed-composer-context.tsx', {
    './use-reed-attachments': { useReedAttachments: () => attachments },
    '@/lib/speech/use-speech-draft': {
      useSpeechDraft: () => {
        const [level, setLevel] = React.useState(0);
        changeLevel = setLevel;
        return {
          reset: command,
          retry: command,
          start: command,
          stop: command,
          state: { error: null, status: 'listening', voiceLevel: level },
        };
      },
    },
  });
  let textRenders = 0;
  let owner!: ReturnType<typeof useSharedComposerDraft>;
  function Editor() {
    owner = useSharedComposerDraft();
    textRenders++;
    return createElement('output', { id: 'draft' }, owner.seed.text);
  }
  function Meter() {
    const level = useComposerVoiceLevel();
    return createElement('output', { id: 'meter' }, level);
  }
  const root = createRoot(document.getElementById('root')!);
  await act(async () =>
    root.render(createElement(ReedComposerDraftProvider, null, createElement(Editor), createElement(Meter))),
  );
  const initialRenders = textRenders;
  await act(async () => changeLevel(0.8));
  assert.equal(document.getElementById('meter')?.textContent, '0.8');
  assert.equal(textRenders, initialRenders);
  await act(async () => owner.replace('Shared draft', 'typed'));
  assert.equal(document.getElementById('draft')?.textContent, 'Shared draft');
  await act(async () => root.unmount());
});

test('notification cancellation failures remain retryable through the channel owner', async () => {
  let shouldFail = true;
  const cancelled: string[] = [];
  const sdk = {
    AndroidImportance: { MAX: 5 },
    AndroidNotificationVisibility: { PUBLIC: 1 },
    SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
    getPermissionsAsync: async () => ({ granted: true }),
    setNotificationHandler() {},
    setNotificationChannelAsync: async () => {},
    scheduleNotificationAsync: async () => 'notification',
    cancelScheduledNotificationAsync: async (id: string) => {
      cancelled.push(id);
      if (shouldFail) throw new Error('Native cancellation failed');
    },
    dismissNotificationAsync: async () => {},
  };
  const alerts = platformModule<typeof import('../lib/background-alerts')>('lib/background-alerts.ts', {
    'react-native': { Platform: { OS: 'android' }, AppState: { currentState: 'background' } },
    'expo-notifications': sdk,
  });
  const definition = {
    androidChannelId: 'rest',
    androidChannelName: 'Rest',
    sound: 'default',
    buildContent: () => ({ title: 'Rest', body: 'Complete' }),
  };
  await alerts.scheduleBackgroundAlertAsync({ definition, payload: {}, fireAt: Date.now() + 60_000 });
  await assert.rejects(alerts.clearBackgroundAlertDefinitionAsync(definition));
  shouldFail = false;
  await alerts.clearBackgroundAlertDefinitionAsync(definition);
  assert.deepEqual(cancelled, ['notification', 'notification']);
});

test('foreground audio waits for the SDK seek promise before playing', async () => {
  const seek = deferred<void>();
  let plays = 0;
  const audio = platformModule<typeof import('../lib/foreground-audio')>('lib/foreground-audio.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-audio': {
      setAudioModeAsync: async () => {},
      createAudioPlayer: () => ({
        seekTo: () => seek.promise,
        play: () => {
          plays++;
        },
      }),
    },
  });
  const playing = audio.playForegroundSoundAsync(1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(plays, 0);
  seek.resolve();
  assert.equal(await playing, true);
  assert.equal(plays, 1);
});

test('activity stopwatch pauses into the duration field, resumes, refreshes on foreground and resets', async () => {
  const React = await import('react');
  const originalNow = Date.now;
  let now = 1000;
  let foreground!: (state: string) => void;
  const durations: number[] = [];
  const running: boolean[] = [];
  const { DurationStopwatch } = platformModule<typeof import('../components/workout/duration-stopwatch')>('components/workout/duration-stopwatch.tsx', {
    'react-native': {
      AppState: { addEventListener: (_: string, callback: typeof foreground) => { foreground = callback; return { remove() {} }; } },
      View: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
      Pressable: ({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress: () => void; accessibilityLabel: string }) => React.createElement('button', { onClick: onPress, 'aria-label': accessibilityLabel }, children),
    },
    '@/components/ui/reed-text': { ReedText: ({ children }: { children: React.ReactNode }) => React.createElement('span', null, children) },
    '@/design/provider': { useReedTheme: () => ({ theme: { spacing: { xs: 8, sm: 12 }, radii: { sm: 12 }, colors: { surfaceRaised: '#222' } } }) },
    '@/design/motion': { getTapScaleStyle: () => ({}) },
  });
  Date.now = () => now;
  const root = createRoot(document.getElementById('root')!);
  const click = async (label: string) => act(async () => (document.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement).click());
  try {
    await act(async () => root.render(createElement(DurationStopwatch, { onDuration: value => durations.push(value), onRunningChange: value => running.push(value) })));
    await click('Start activity timer');
    now = 16000;
    await act(async () => foreground('active'));
    assert.ok(document.body.textContent?.includes('0:15'));
    await click('Pause activity timer');
    now = 116000;
    await click('Resume activity timer');
    now = 121000;
    await click('Pause activity timer');
    assert.deepEqual(durations, [15, 20]);
    assert.deepEqual(running, [true, false, true, false]);
    await click('Reset activity timer');
    assert.equal(durations.at(-1), 0);
    assert.ok(document.body.textContent?.includes('0:00'));
  } finally {
    await act(async () => root.unmount());
    Date.now = originalNow;
  }
});

test('home mode waits for storage, latches initial history, and returns to today on a cold foreground', async () => {
  let focused = true;
  let cold = false;
  let foreground!: (state: string) => void;
  const writes: string[] = [];
  const { useHomeMode } = platformModule<typeof import('../components/reed/use-home-mode')>('components/reed/use-home-mode.ts', {
    'expo-router': { useIsFocused: () => focused },
    'convex/react': { useQuery: () => ({ wouldStartNewChapter: cold }) },
    'react-native': { AppState: { addEventListener: (_: string, callback: typeof foreground) => { foreground = callback; return { remove() {} }; } } },
    '@react-native-async-storage/async-storage': { default: { getItem: async () => null, setItem: async (_: string, value: string) => { writes.push(value); } }, __esModule: true },
    '@/components/home/use-five-minute-now': { useFiveMinuteNow: () => 0 },
  });
  let home!: ReturnType<typeof useHomeMode>;
  const messages = [{ id: 'old-note', createdAt: 10, isCoachNote: true, role: 'assistant', status: 'sent', text: 'Old note', source: 'typed' }] as import('../components/reed/reed.types').ReedMessage[];
  function Home() { home = useHomeMode({ isLoadingMessages: false, messages }); return null; }
  const root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(createElement(Home)));
  assert.equal(home.mode, 'chat');
  assert.ok(writes.includes('10'));
  cold = true;
  await act(async () => root.render(createElement(Home)));
  await act(async () => foreground('active'));
  assert.equal(home.mode, 'today');
  await act(async () => home.enterChat());
  assert.equal(home.mode, 'chat');
  focused = false;
  await act(async () => root.render(createElement(Home)));
  focused = true;
  await act(async () => root.render(createElement(Home)));
  assert.equal(home.mode, 'today');
  await act(async () => root.unmount());
});

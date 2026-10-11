import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { platformModule } from './helpers/platform-module';

test('rest completion cues once at the visible deadline, never on timer replacement or background catch-up', async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  let appStateChanged = (_state: string) => {};
  const AppState = { currentState: 'active', addEventListener: (_: string, callback: typeof appStateChanged) => { appStateChanged = callback; return { remove() {} }; } };
  let remaining = 1;
  let sounds = 0;
  let pulses = 0;
  const { WorkoutRestEffects } = platformModule<typeof import('../components/workout/workout-rest-effects')>('components/workout/workout-rest-effects.tsx', {
    'react-native': { Platform: { OS: 'web' }, AppState },
    '@/design/haptics': { attention: () => { pulses++; } },
    '@/lib/client-observability': { startClientWideEvent: () => ({ end() {}, fail() {} }) },
    '@/lib/rest-timer-alerts': { playRestTimerCompletionCueAsync: async () => { sounds++; return 'local'; } },
    './use-rest-background-alerts': { useRestBackgroundAlerts() {} },
    './use-rest-countdown': { useRestCountdown: () => ({ remainingSeconds: remaining }) },
  });
  const card = { sessionExerciseId: 'exercise', nextSetNumber: 2, remainingSeconds: 10, startedAt: 100, isRunning: true, durationSeconds: 10, exerciseName: 'Exercise', previousSetSummary: null, isComplete: false } as unknown as import('../components/workout/workout-surface.types').RestCard;
  const root = createRoot(document.getElementById('root')!);
  const render = (restCard = card) => act(async () => root.render(createElement(WorkoutRestEffects, { restCard, onPermissionDenied() {} })));
  await render(); remaining = 0; await render(); await render({ ...card });
  assert.deepEqual([sounds, pulses], [1, 1]);
  remaining = 1; await render(); remaining = 0; await render({ ...card, sessionExerciseId: 'other' as typeof card.sessionExerciseId });
  assert.deepEqual([sounds, pulses], [1, 1]);
  remaining = 1; await render();
  AppState.currentState = 'background'; appStateChanged('background');
  // JS did not render at all while suspended; the next render is already foreground with zero left.
  AppState.currentState = 'active'; appStateChanged('active'); remaining = 0; await render({ ...card });
  assert.deepEqual([sounds, pulses], [1, 1]);
  await act(async () => root.unmount()); dom.window.close();
});

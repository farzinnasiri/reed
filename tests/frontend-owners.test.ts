import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createComposerDraft } from '../lib/composer-draft';
import { useWorkoutSetEditor } from '../components/workout/use-workout-set-editor';
import type { CaptureCard, EditingSet } from '../components/workout/workout-surface.types';
import type { Id } from '../convex/_generated/dataModel';

const dom = new JSDOM('<!doctype html><div id="root"></div>');
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const card: CaptureCard = {
  sessionExerciseId: 'exercise-a' as Id<'liveSessionExercises'>,
  exerciseCatalogId: 'catalog-a' as Id<'exerciseCatalog'>,
  currentSetNumber: 3,
  recipeKey: 'standard_load',
  exerciseName: 'Squat',
  initialMetrics: { load: 60, reps: 8 },
  fields: [],
  exerciseSetupModifiers: {},
  modifierCapabilities: { setup: [], setOutcome: [] },
  layoutKind: 'standard',
  processKind: 'rest_after_log',
  previousMetrics: null,
  previousSetSummary: null,
};
const oldSet: EditingSet = {
  sessionExerciseId: card.sessionExerciseId,
  setLogId: 'set-a' as Id<'activityLogs'>,
  setNumber: 1,
  metrics: { load: 20, reps: 12 },
  setOutcomeDetails: { failedReps: 1 },
  warmup: true,
};

test('mounted set editor restores the new-set draft after leaving a historical edit', async () => {
  const element = document.getElementById('root')!;
  const root = createRoot(element);
  let editor!: ReturnType<typeof useWorkoutSetEditor>;
  let currentCard = card;
  function Editor() {
    editor = useWorkoutSetEditor(currentCard);
    return createElement(
      'output',
      null,
      JSON.stringify({
        metrics: editor.metricValues,
        outcome: editor.setOutcomeDetails,
        warmup: editor.warmup,
      }),
    );
  }
  await act(async () => root.render(createElement(Editor)));
  await act(async () => editor.setMetricValues({ load: 70, reps: 6 }));
  await act(async () => editor.setEditingSet(oldSet));
  assert.equal(editor.metricValues.load, 20);
  await act(async () => editor.setMetricValues({ load: 25, reps: 12 }));
  await act(async () => editor.setEditingSet(null));
  assert.deepEqual(editor.metricValues, { load: 70, reps: 6 });
  assert.equal(editor.warmup, false);
  assert.deepEqual(editor.setOutcomeDetails, {});
  await act(async () => editor.setEditingSet(oldSet));
  await act(async () => editor.setEditingSet(null));
  assert.equal(editor.metricValues.load, 70);
  currentCard = { ...card, currentSetNumber: 4, initialMetrics: { load: 75, reps: 5 } };
  await act(async () => root.render(createElement(Editor)));
  assert.deepEqual(editor.metricValues, { load: 75, reps: 5 });
  await act(async () => root.unmount());
});

test('mounted draft subscribers and a reopened composer display the same latest text', async () => {
  const root = createRoot(document.getElementById('root')!);
  const store = createComposerDraft();
  function Composer({ id }: { id: string }) {
    const draft = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    return createElement('output', { id }, draft.text);
  }
  function App({ sheet }: { sheet: boolean }) {
    return createElement(
      'div',
      null,
      createElement(Composer, { id: 'home' }),
      sheet ? createElement(Composer, { id: 'sheet' }) : null,
    );
  }
  await act(async () => root.render(createElement(App, { sheet: true })));
  await act(async () => store.replace('Home draft', 'typed'));
  await act(async () => store.replace('Sheet edit', 'typed'));
  assert.equal(document.getElementById('home')?.textContent, 'Sheet edit');
  await act(async () => root.render(createElement(App, { sheet: false })));
  await act(async () => store.replace('Latest', 'voice'));
  await act(async () => root.render(createElement(App, { sheet: true })));
  assert.equal(document.getElementById('sheet')?.textContent, 'Latest');
  await act(async () => root.unmount());
});

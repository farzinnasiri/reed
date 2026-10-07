import { useCallback, useReducer, type SetStateAction } from 'react';
import type { CaptureCard, EditingSet, MetricValues, SetOutcomeDetails } from './workout-surface.types';
import { captureIdentity, initialSetEditor, reduceSetEditor, type SetDraft } from './set-editor-state';

export function useWorkoutSetEditor(card: CaptureCard | null) {
  const [state, dispatch] = useReducer(reduceSetEditor, card, initialSetEditor);
  // Adjust this component's state before committing a different capture card.
  if (state.captureKey !== captureIdentity(card)) dispatch({ type: 'capture', card });
  const activeSetEditor =
    card && state.editing?.target.sessionExerciseId === card.sessionExerciseId ? state.editing.target : null;
  const draft = activeSetEditor && state.editing ? state.editing.draft : state.draft;
  const setEditingSet = useCallback((target: EditingSet | null) => dispatch({ type: 'edit', target }), []);
  function change(update: (current: SetDraft) => SetDraft) {
    dispatch({ type: 'change', mode: activeSetEditor ? 'edit' : 'new', update });
  }
  return {
    activeSetEditor,
    editingSet: state.editing?.target ?? null,
    metricValues: draft.metrics,
    setOutcomeDetails: draft.outcome,
    warmup: draft.warmup,
    setEditingSet,
    setMetricValues: (next: SetStateAction<MetricValues>) =>
      change((current) => ({
        ...current,
        metrics: typeof next === 'function' ? next(current.metrics) : next,
      })),
    setSetOutcomeDetails: (outcome: SetOutcomeDetails) => change((current) => ({ ...current, outcome })),
    setWarmup: (next: SetStateAction<boolean>) =>
      change((current) => ({ ...current, warmup: typeof next === 'function' ? next(current.warmup) : next })),
  };
}

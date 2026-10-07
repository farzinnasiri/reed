import type { CaptureCard, EditingSet, MetricValues, SetOutcomeDetails } from './workout-surface.types';

export type SetDraft = { metrics: MetricValues; outcome: SetOutcomeDetails; warmup: boolean };
export type SetEditorState = {
  captureKey: string | null;
  draft: SetDraft;
  editing: { target: EditingSet; draft: SetDraft } | null;
};
export type SetEditorAction =
  | { type: 'capture'; card: CaptureCard | null }
  | { type: 'edit'; target: EditingSet | null }
  | { type: 'change'; mode: 'new' | 'edit'; update: (draft: SetDraft) => SetDraft };

export function captureIdentity(card: CaptureCard | null) {
  return card
    ? `${card.sessionExerciseId}:${card.exerciseCatalogId}:${card.currentSetNumber}:${card.recipeKey}`
    : null;
}

export function initialSetEditor(card: CaptureCard | null): SetEditorState {
  return {
    captureKey: captureIdentity(card),
    draft: { metrics: card?.initialMetrics ?? {}, outcome: {}, warmup: false },
    editing: null,
  };
}

export function reduceSetEditor(state: SetEditorState, action: SetEditorAction): SetEditorState {
  switch (action.type) {
    case 'capture':
      if (state.captureKey === captureIdentity(action.card)) return state;
      return {
        ...initialSetEditor(action.card),
        editing:
          action.card && state.editing?.target.sessionExerciseId === action.card.sessionExerciseId
            ? state.editing
            : null,
      };
    case 'edit':
      return {
        ...state,
        editing: action.target
          ? {
              target: action.target,
              draft: {
                metrics: action.target.metrics,
                outcome: action.target.setOutcomeDetails ?? {},
                warmup: action.target.warmup,
              },
            }
          : null,
      };
    case 'change':
      if (action.mode === 'edit')
        return state.editing
          ? { ...state, editing: { ...state.editing, draft: action.update(state.editing.draft) } }
          : state;
      return { ...state, draft: action.update(state.draft) };
  }
}

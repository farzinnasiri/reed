// ---------------------------------------------------------------------------
// useOnboardingDraft — local state machine for the onboarding flow.
//
// The step sequence is DYNAMIC. After 'priorities', one 'goal-detail' step
// is inserted per ranked goal that has a follow-up question. The sequence
// is recomputed whenever rankedGoals changes.
//
// State shape:
//   { position: number, draft: OnboardingDraft }
//
// 'position' is an index into the dynamic sequence array. This lets us
// avoid encoding goal indices into the step type while still supporting
// back/forward navigation correctly.
// ---------------------------------------------------------------------------

import { useReducer, useCallback } from 'react';
import {
  EMPTY_DRAFT,
  goalHasDetail,
  type OnboardingDraft,
  type OnboardingBaseStep,
  type PrimaryGoal,
} from './types';

// ---------------------------------------------------------------------------
// Dynamic sequence computation
// ---------------------------------------------------------------------------

type SequenceEntry =
  | { kind: 'step'; step: OnboardingBaseStep }
  | { kind: 'goal-detail'; goal: PrimaryGoal; goalIndex: number };

/**
 * Build the full ordered sequence from the current draft state.
 * Goal-detail entries are inserted between 'priorities' and 'constraints',
 * one per ranked goal that has a follow-up question.
 */
function buildSequence(draft: OnboardingDraft, includeConsent = true): SequenceEntry[] {
  const seq: SequenceEntry[] = [
    { kind: 'step', step: 'name' },
    ...(includeConsent ? [{ kind: 'step' as const, step: 'consent' as const }] : []),
    { kind: 'step', step: 'baseline' },
    { kind: 'step', step: 'training-reality' },
    { kind: 'step', step: 'priorities' },
  ];

  draft.rankedGoals.forEach((goal, i) => {
    if (goalHasDetail(goal)) {
      seq.push({ kind: 'goal-detail', goal, goalIndex: i });
    }
  });

  seq.push({ kind: 'step', step: 'constraints' });
  if (draft.trainingAge === 'six_to_18_months' || draft.trainingAge === 'over_18_months') {
    seq.push({ kind: 'step', step: 'performance-anchors' });
  }
  seq.push({ kind: 'step', step: 'notes' });
  seq.push({ kind: 'step', step: 'review' });

  return seq;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export type OnboardingState = {
  includeConsent: boolean;
  position: number;
  draft: OnboardingDraft;
};

type OnboardingAction =
  | { type: 'go_next' }
  | { type: 'go_back' }
  | { type: 'go_to_step'; step: OnboardingBaseStep }
  | { type: 'set_state'; state: OnboardingState }
  | { type: 'update_draft'; patch: Partial<OnboardingDraft> };

function reducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'set_state':
      return action.state;
    case 'update_draft': {
      const newDraft = { ...state.draft, ...action.patch };
      const newSeq = buildSequence(newDraft, state.includeConsent);
      const safePos = Math.min(state.position, newSeq.length - 1);
      return { ...state, position: safePos, draft: newDraft };
    }
    case 'go_next': {
      const seq = buildSequence(state.draft, state.includeConsent);
      const nextPos = Math.min(state.position + 1, seq.length - 1);
      return { ...state, position: nextPos };
    }
    case 'go_back': {
      const prevPos = Math.max(state.position - 1, 0);
      return { ...state, position: prevPos };
    }
    case 'go_to_step': {
      const seq = buildSequence(state.draft, state.includeConsent);
      const targetPos = seq.findIndex(
        entry => entry.kind === 'step' && entry.step === action.step,
      );
      if (targetPos === -1) return state;
      return { ...state, position: targetPos };
    }
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type CurrentStep =
  | { kind: 'step'; step: OnboardingBaseStep }
  | { kind: 'goal-detail'; goal: PrimaryGoal; goalIndex: number };

export function useOnboardingDraft(initialState?: OnboardingState, options?: { includeConsent?: boolean }) {
  const includeConsent = options?.includeConsent ?? true;
  const [state, dispatch] = useReducer(
    reducer,
    initialState ?? {
      includeConsent,
      position: 0,
      draft: EMPTY_DRAFT,
    },
  );

  const goNext = useCallback(() => {
    dispatch({ type: 'go_next' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goBack = useCallback(() => {
    dispatch({ type: 'go_back' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToStep = useCallback(
    (step: OnboardingBaseStep) => {
      dispatch({ type: 'go_to_step', step });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const updateDraft = useCallback(
    (patch: Partial<OnboardingDraft>) => dispatch({ type: 'update_draft', patch }),
    [],
  );

  const sequence = buildSequence(state.draft, includeConsent);
  const currentEntry = sequence[state.position]!;
  const stepCount = sequence.length;

  return {
    current: currentEntry as CurrentStep,
    stepIndex: state.position,
    stepCount,
    draft: state.draft,
    goNext,
    goBack,
    goToStep,
    updateDraft,
  };
}

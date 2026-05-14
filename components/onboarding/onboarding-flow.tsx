// ---------------------------------------------------------------------------
// OnboardingFlow — top-level orchestrator.
// Renders the current step and wires navigation + draft callbacks.
// The sequence is dynamic: Name → Gesture → Reed → Consent → Baseline → Body Type → Lifestyle → Training Reality → Goals →
// [Goal Details based on rank] → Constraints → Review
// ---------------------------------------------------------------------------

import { StepBaseline } from './step-baseline';
import { StepBodyType } from './step-body-type';
import { StepConsent } from './step-consent';
import { StepGestureDemo } from './step-gesture-demo';
import { StepName } from './step-name';
import { StepReedIntro } from './step-reed-intro';
import { StepConstraints } from './step-constraints';
import { StepGoalDetail } from './step-goal-detail';
import { StepLifestyle } from './step-lifestyle';
import { StepPriorities } from './step-priorities';
import { StepPerformanceAnchors } from './step-performance-anchors';
import { StepNotes } from './step-notes';
import { StepReview } from './step-review';
import { StepTrainingReality } from './step-training-reality';
import { useOnboardingDraft } from './use-onboarding-draft';
import { emptyGoalDetail, type OnboardingDraft } from './types';
import { getOnboardingStepPosition, type OnboardingState } from './use-onboarding-draft';
import type { OnboardingBaseStep } from './types';

type OnboardingFlowProps = {
  backPlacement?: 'footer' | 'header';
  cancelLabel?: string;
  initialDraft?: OnboardingDraft;
  includeConsent?: boolean;
  initialStep?: OnboardingBaseStep;
  onDecline: () => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
  onComplete: (draft: OnboardingDraft) => Promise<void> | void;
  onSaveProfile?: (draft: OnboardingDraft) => Promise<void>;
  reviewContinueLabel?: string;
};

export function OnboardingFlow({
  backPlacement = 'footer',
  cancelLabel,
  initialDraft,
  includeConsent = true,
  initialStep,
  onDecline,
  onCancel,
  onComplete,
  onSaveProfile,
  reviewContinueLabel,
}: OnboardingFlowProps) {
  const initialState: OnboardingState | undefined = initialDraft
    ? { draft: initialDraft, includeConsent, position: getOnboardingStepPosition(initialDraft, initialStep, includeConsent) }
    : undefined;
  const {
    current,
    stepIndex,
    stepCount,
    draft,
    goNext,
    goBack,
    goToStep,
    updateDraft,
  } = useOnboardingDraft(initialState, { includeConsent });

  const handleBack = stepIndex === 0 ? onDecline : goBack;

  if (current.kind === 'goal-detail') {
    return (
      <StepGoalDetail
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        backPlacement={backPlacement}
        draft={draft}
        goal={current.goal}
        goalIndex={current.goalIndex}
        onBack={handleBack}
        onContinue={goNext}
        onUpdateDetail={(goal, patch) => {
          updateDraft({
            goalDetails: {
              ...draft.goalDetails,
              [goal]: { ...emptyGoalDetail(), ...draft.goalDetails[goal], ...patch },
            },
          });
        }}
        stepCount={stepCount}
        stepIndex={stepIndex}
      />
    );
  }

  // Handle base steps
  switch (current.step) {
    case 'name':
      return (
        <StepName
          cancelLabel={cancelLabel}
          onCancel={onCancel}
          backPlacement={backPlacement}
          displayName={draft.displayName}
          onBack={onDecline}
          onContinue={goNext}
          onUpdateName={value => updateDraft({ displayName: value })}
          stepCount={stepCount}
          stepIndex={stepIndex}
        />
      );

    case 'gesture-demo':
      return (
        <StepGestureDemo
          displayName={draft.displayName}
          onBack={goBack}
          onContinue={goNext}
        />
      );

    case 'reed-intro':
      return (
        <StepReedIntro
          displayName={draft.displayName}
          onBack={goBack}
          onContinue={goNext}
        />
      );

    case 'consent':
      return (
        <StepConsent
          cancelLabel={cancelLabel}
          onCancel={onCancel}
          backPlacement={backPlacement}
          onConsent={() => {
            updateDraft({ profilingConsent: true });
            goNext();
          }}
          onDecline={onDecline}
          stepCount={stepCount}
          stepIndex={stepIndex}
        />
      );

    case 'baseline':
      return (
        <StepBaseline
          cancelLabel={cancelLabel}
          onCancel={onCancel}
          backPlacement={backPlacement}
          draft={draft}
          onBack={handleBack}
          onContinue={goNext}
          onUpdateDraft={updateDraft}
          stepCount={stepCount}
          stepIndex={stepIndex}
        />
      );

    case 'body-type':
      return (
        <StepBodyType
          cancelLabel={cancelLabel}
          onCancel={onCancel}
          backPlacement={backPlacement}
          draft={draft}
          onBack={handleBack}
          onContinue={goNext}
          onUpdateDraft={updateDraft}
          stepCount={stepCount}
          stepIndex={stepIndex}
        />
      );

    case 'lifestyle':
      return (
        <StepLifestyle
          cancelLabel={cancelLabel}
          onCancel={onCancel}
          backPlacement={backPlacement}
          draft={draft}
          onBack={handleBack}
          onContinue={goNext}
          onUpdateDraft={updateDraft}
          stepCount={stepCount}
          stepIndex={stepIndex}
        />
      );

    case 'training-reality':
      return (
        <StepTrainingReality
          cancelLabel={cancelLabel}
          onCancel={onCancel}
          backPlacement={backPlacement}
          draft={draft}
          onBack={handleBack}
          onContinue={goNext}
          onUpdateDraft={updateDraft}
          stepCount={stepCount}
          stepIndex={stepIndex}
        />
      );

    case 'priorities':
      return (
        <StepPriorities
          cancelLabel={cancelLabel}
          onCancel={onCancel}
          backPlacement={backPlacement}
          draft={draft}
          onBack={handleBack}
          onContinue={goNext}
          onUpdateDraft={updateDraft}
          stepCount={stepCount}
          stepIndex={stepIndex}
        />
      );

    case 'constraints':
      return (
        <StepConstraints
          cancelLabel={cancelLabel}
          onCancel={onCancel}
          backPlacement={backPlacement}
          draft={draft}
          onBack={handleBack}
          onContinue={goNext}
          onUpdateDraft={updateDraft}
          stepCount={stepCount}
          stepIndex={stepIndex}
        />
      );

    case 'performance-anchors':
      return (
        <StepPerformanceAnchors
          backPlacement={backPlacement}
          cancelLabel={cancelLabel}
          draft={draft}
          onBack={handleBack}
          onCancel={onCancel}
          onContinue={goNext}
          onUpdateDraft={updateDraft}
          stepCount={stepCount}
          stepIndex={stepIndex}
        />
      );

    case 'notes':
      return (
        <StepNotes
          backPlacement={backPlacement}
          cancelLabel={cancelLabel}
          notes={draft.userNotes}
          onBack={handleBack}
          onCancel={onCancel}
          onContinue={goNext}
          onUpdateNotes={value => updateDraft({ userNotes: value })}
          stepCount={stepCount}
          stepIndex={stepIndex}
        />
      );

    case 'review':
      return (
        <StepReview
          cancelLabel={cancelLabel}
          onCancel={onCancel}
          backPlacement={backPlacement}
          draft={draft}
          onBack={handleBack}
          continueLabel={reviewContinueLabel}
          onCreateProfile={onComplete}
          onSaveProfile={onSaveProfile}
          onEditStep={goToStep}
          stepCount={stepCount}
          stepIndex={stepIndex}
        />
      );

    default:
      return null;
  }
}

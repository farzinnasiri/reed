// ---------------------------------------------------------------------------
// Step 4: Goals — drag-to-rank what matters most.
// One ranked list. Top goal = protected when things get tight.
// ---------------------------------------------------------------------------

import { StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { RankedGoalList } from './ranked-goal-list';
import { OnboardingShell } from './onboarding-shell';
import type { OnboardingDraft, PrimaryGoal } from './types';

// ---------------------------------------------------------------------------
// Goal definitions with subtitles for context
// ---------------------------------------------------------------------------

import { GOAL_OPTIONS } from './labels';

// ---------------------------------------------------------------------------
// Validation — just needs at least one ranked goal on this step.
// ---------------------------------------------------------------------------

export function isPrioritiesValid(draft: OnboardingDraft): boolean {
  return draft.rankedGoals.length > 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type StepPrioritiesProps = {
  backPlacement?: 'footer' | 'header';
  cancelLabel?: string;
  draft: OnboardingDraft;
  onBack: () => void;
  onCancel?: () => Promise<void> | void;
  onContinue: () => void;
  onUpdateDraft: (patch: Partial<OnboardingDraft>) => void;
  stepCount: number;
  stepIndex: number;
};

export function StepPriorities({
  backPlacement,
  cancelLabel,
  draft,
  onBack,
  onCancel,
  onContinue,
  onUpdateDraft,
  stepCount,
  stepIndex,
}: StepPrioritiesProps) {

  // We no longer clear details when ranking changes. 
  // The state machine handles dynamic steps, and details stay cached per goal.
  function handleRankedGoalsChange(newGoals: PrimaryGoal[]) {
    // Enforce max 3 ranked goals
    if (newGoals.length <= 3) {
      onUpdateDraft({ rankedGoals: newGoals });
    }
  }

  return (
    <OnboardingShell
      backPlacement={backPlacement}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      continueDisabled={!isPrioritiesValid(draft)}
      onBack={onBack}
      onContinue={onContinue}
      stepCount={stepCount}
      stepIndex={stepIndex}
    >
      <View style={styles.titleBlock}>
        <ReedText variant="title">
          What do you want from training right now?
        </ReedText>
        <ReedText tone="muted">
          Rank them. Top one wins when time or recovery gets tight.
        </ReedText>
      </View>

      {/* Drag-to-rank list */}
      <RankedGoalList
        availableGoals={GOAL_OPTIONS}
        onChangeRanked={handleRankedGoalsChange}
        ranked={draft.rankedGoals}
      />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 10,
  },
});

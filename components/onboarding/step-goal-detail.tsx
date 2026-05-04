// ---------------------------------------------------------------------------
// StepGoalDetail — one dedicated page per ranked goal that has a follow-up.
// Rendered once per goal in order. The question adapts to the goal type.
// ---------------------------------------------------------------------------

import { StyleSheet, View } from 'react-native';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ChipSelect } from './chip-select';
import { GroupedChipSelect } from './grouped-chip-select';
import { OnboardingShell } from './onboarding-shell';
import { emptyGoalDetail, type GoalDetailData, type OnboardingDraft, type PrimaryGoal } from './types';
import {
  CONDITIONING_GROUPS,
  GOAL_LABELS,
  LIFT_CHIPS,
  MUSCLE_FOCUS_CHIPS,
  SKILL_GROUPS,
  SPORT_GROUPS,
} from './labels';

// ---------------------------------------------------------------------------
// Per-goal content config
// ---------------------------------------------------------------------------

type GoalContent = {
  title: string;
  subtitle: string;
};

const GOAL_CONTENT: Record<PrimaryGoal, GoalContent> = {
  build_muscle: {
    title: 'Where first?',
    subtitle: "I'll prioritize these areas in your first block. Pick up to 3.",
  },
  get_stronger: {
    title: 'Which lifts?',
    subtitle: "I'll structure progression around these. Pick all that apply.",
  },
  master_skill: {
    title: 'Which skill are you working toward?',
    subtitle: "I'll bias accessory work and practice slots around this.",
  },
  support_sport: {
    title: 'Which sport?',
    subtitle: "I'll bias training toward the movement demands and season timing.",
  },
  improve_conditioning: {
    title: 'How do you prefer to push your lungs?',
    subtitle: "I'll anchor your conditioning sessions around these modalities. Pick up to 5.",
  },
  move_without_pain: {
    title: '',
    subtitle: '',
  },
};

// ---------------------------------------------------------------------------
// Validation — Optional. The user can skip providing details.
// ---------------------------------------------------------------------------
export function isGoalDetailValid(_goal: PrimaryGoal, _detail: GoalDetailData): boolean {
  return true; // Skippable
}

// ---------------------------------------------------------------------------
// Goal-Specific Renderers
// ---------------------------------------------------------------------------

type RendererProps = {
  backPlacement?: 'footer' | 'header';
  cancelLabel?: string;
  detail: GoalDetailData;
  patchDetail: (patch: Partial<GoalDetailData>) => void;
};

function renderBuildMuscle({ detail, patchDetail }: RendererProps) {
  return (
    <ChipSelect<string>
      max={3}
      onChange={selected => patchDetail({ focusAreas: selected })}
      options={MUSCLE_FOCUS_CHIPS}
      selected={detail.focusAreas}
    />
  );
}

function renderGetStronger({ detail, patchDetail }: RendererProps) {
  return (
    <ChipSelect<string>
      onChange={selected => patchDetail({ focusAreas: selected })}
      options={LIFT_CHIPS}
      selected={detail.focusAreas}
    />
  );
}

function renderMasterSkill({ detail, patchDetail }: RendererProps) {
  return (
    <View style={styles.section}>
      <GroupedChipSelect
        groups={SKILL_GROUPS}
        max={3}
        onChange={selected => {
          const hasOther = selected.includes('other');
          patchDetail({ focusAreas: selected, customDetail: hasOther ? detail.customDetail : null });
        }}
        selected={detail.focusAreas}
      />

      {detail.focusAreas.includes('other') ? (
        <View style={styles.followField}>
          <ReedText variant="bodyStrong">What is it?</ReedText>
          <ReedInput
            placeholder="e.g. Juggling, Parkour..."
            value={detail.customDetail ?? ''}
            onChangeText={text => patchDetail({ customDetail: text })}
          />
        </View>
      ) : null}


    </View>
  );
}

function renderSupportSport({ detail, patchDetail }: RendererProps) {
  return (
    <View style={styles.section}>
      <GroupedChipSelect
        groups={SPORT_GROUPS}
        max={5}
        onChange={selected => {
          const hasOther = selected.includes('other');
          patchDetail({ focusAreas: selected, customDetail: hasOther ? detail.customDetail : null });
        }}
        selected={detail.focusAreas}
      />

      {detail.focusAreas.includes('other') ? (
        <View style={styles.followField}>
          <ReedText variant="bodyStrong">What is it?</ReedText>
          <ReedInput
            placeholder="e.g. Golf, Ultimate Frisbee..."
            value={detail.customDetail ?? ''}
            onChangeText={text => patchDetail({ customDetail: text })}
          />
        </View>
      ) : null}


    </View>
  );
}

function renderImproveConditioning({ detail, patchDetail }: RendererProps) {
  const selectedModalities =
    detail.focusAreas.length > 0
      ? detail.focusAreas
      : detail.detail
        ? [detail.detail]
        : [];

  return (
    <View style={styles.section}>
      <GroupedChipSelect
        groups={CONDITIONING_GROUPS}
        max={5}
        onChange={selected => {
          const hasOther = selected.includes('other');
          patchDetail({
            customDetail: hasOther ? detail.customDetail : null,
            detail: selected[0] ?? null,
            focusAreas: selected,
          });
        }}
        selected={selectedModalities}
      />

      {selectedModalities.includes('other') ? (
        <View style={styles.followField}>
          <ReedText variant="bodyStrong">What is it?</ReedText>
          <ReedInput
            placeholder="e.g. Kettlebell sport, swimming..."
            value={detail.customDetail ?? ''}
            onChangeText={text => patchDetail({ customDetail: text })}
          />
        </View>
      ) : null}
    </View>
  );
}

const RENDERERS: Partial<Record<PrimaryGoal, (props: RendererProps) => React.ReactNode>> = {
  build_muscle: renderBuildMuscle,
  get_stronger: renderGetStronger,
  master_skill: renderMasterSkill,
  support_sport: renderSupportSport,
  improve_conditioning: renderImproveConditioning,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type StepGoalDetailProps = {
  backPlacement?: 'footer' | 'header';
  cancelLabel?: string;
  draft: OnboardingDraft;
  goal: PrimaryGoal;
  goalIndex: number;    // 0-based rank position
  onBack: () => void;
  onCancel?: () => Promise<void> | void;
  onContinue: () => void;
  onUpdateDetail: (goal: PrimaryGoal, patch: Partial<GoalDetailData>) => void;
  stepCount: number;
  stepIndex: number;
};

export function StepGoalDetail({
  backPlacement,
  cancelLabel,
  draft,
  goal,
  goalIndex,
  onBack,
  onCancel,
  onContinue,
  onUpdateDetail,
  stepCount,
  stepIndex,
}: StepGoalDetailProps) {
  const detail = draft.goalDetails[goal] ?? emptyGoalDetail();
  const content = GOAL_CONTENT[goal];
  const valid = isGoalDetailValid(goal, detail);

  function patchDetail(patch: Partial<GoalDetailData>) {
    onUpdateDetail(goal, { ...detail, ...patch });
  }

  const rankLabel =
    goalIndex === 0 ? 'Your top priority' :
    goalIndex === 1 ? 'Your second priority' :
    goalIndex === 2 ? 'Your third priority' :
    `Priority ${goalIndex + 1}`;

  const renderContent = RENDERERS[goal];

  return (
    <OnboardingShell
      backPlacement={backPlacement}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      continueDisabled={!valid}
      onBack={onBack}
      onContinue={onContinue}
      stepCount={stepCount}
      stepIndex={stepIndex}
    >
      {/* Goal context label */}
      <View style={styles.context}>
        <ReedText tone="muted" variant="label">
          {rankLabel.toUpperCase()} · {GOAL_LABELS[goal]?.toUpperCase()}
        </ReedText>
      </View>

      <View style={styles.titleBlock}>
        <ReedText variant="title">{content.title}</ReedText>
        <ReedText tone="muted">
          {content.subtitle} Feel free to skip if you're not sure yet.
        </ReedText>
      </View>

      {renderContent ? renderContent({ detail, patchDetail }) : null}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  context: {
    paddingTop: 4,
  },
  titleBlock: {
    gap: 10,
  },
  section: {
    gap: 28, // Space between grouped chip selects
  },
  followField: {
    gap: 10,
    marginTop: -8,
  },
});

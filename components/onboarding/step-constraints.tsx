// ---------------------------------------------------------------------------
// Step 5: Constraints — pain and health.
// Empty selection = pain-free = valid.
// For each selected constraint, we ask for severity and timing.
// ---------------------------------------------------------------------------

import { StyleSheet, View } from 'react-native';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ChipSelect } from './chip-select';
import { OnboardingShell } from './onboarding-shell';
import { useReedTheme } from '@/design/provider';
import type {
  OnboardingDraft,
  ConstraintArea,
  PainSeverity,
  PainTiming,
  ConstraintDetailData,
} from './types';

import {
  CONSTRAINT_CHIPS,
  CONSTRAINT_LABELS,
  PAIN_SEVERITY_OPTIONS,
  PAIN_TIMING_OPTIONS,
} from './labels';

type StepConstraintsProps = {
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

// Always valid — user can skip or provide partial info.
export function isConstraintsValid(_draft: OnboardingDraft): boolean {
  return true;
}

export function StepConstraints({
  backPlacement,
  cancelLabel,
  draft,
  onBack,
  onCancel,
  onContinue,
  onUpdateDraft,
  stepCount,
  stepIndex,
}: StepConstraintsProps) {
  const { theme } = useReedTheme();

  function patchDetail(area: ConstraintArea, patch: Partial<ConstraintDetailData>) {
    const existing = draft.constraintDetails[area] || { severity: null, timing: null, customDetail: null };
    onUpdateDraft({
      constraintDetails: {
        ...draft.constraintDetails,
        [area]: { ...existing, ...patch },
      },
    });
  }

  return (
    <OnboardingShell
      backPlacement={backPlacement}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      onBack={onBack}
      onContinue={onContinue}
      stepCount={stepCount}
      stepIndex={stepIndex}
    >
      <View style={styles.titleBlock}>
        <ReedText variant="title">
          Any pain or health issues I should work around?
        </ReedText>
        <ReedText tone="muted">
          Leave this empty if you're fully cleared — I'll adapt exercise choices for anything you flag.
        </ReedText>
      </View>

      {/* Main selection chips */}
      <ChipSelect<ConstraintArea>
        onChange={selected => {
          onUpdateDraft({ constraintAreas: selected });
        }}
        options={CONSTRAINT_CHIPS}
        selected={draft.constraintAreas}
      />

      {/* Render detailed follow-up for EACH selected constraint */}
      {draft.constraintAreas.length > 0 ? (
        <View style={styles.detailsContainer}>
          <View style={[styles.mainDivider, { backgroundColor: theme.colors.borderSoft }]} />
          
          {draft.constraintAreas.map(area => {
            const detail = draft.constraintDetails[area] || { severity: null, timing: null, customDetail: null };
            
            return (
              <View key={area} style={[styles.areaDetailBlock, { borderColor: theme.colors.borderSoft }]}>
                <ReedText variant="bodyStrong" style={{ color: theme.colors.accentPrimary }}>
                  {CONSTRAINT_LABELS[area]}
                </ReedText>

                {area === 'other' ? (
                  <View style={styles.row}>
                    <ReedText variant="bodyStrong">What is it?</ReedText>
                    <ReedInput
                      placeholder="e.g. Asthma, Hernia..."
                      value={detail.customDetail ?? ''}
                      onChangeText={text => patchDetail(area, { customDetail: text })}
                    />
                  </View>
                ) : null}

                <View style={styles.row}>
                  <ReedText variant="bodyStrong">How bad is it?</ReedText>
                  <SegmentedControl<PainSeverity>
                    compact
                    onChange={value => patchDetail(area, { severity: value })}
                    options={PAIN_SEVERITY_OPTIONS}
                    value={detail.severity ?? 'mild'}
                  />
                </View>

                <View style={styles.row}>
                  <ReedText variant="bodyStrong">When does it show up?</ReedText>
                  <SegmentedControl<PainTiming>
                    compact
                    onChange={value => patchDetail(area, { timing: value })}
                    options={PAIN_TIMING_OPTIONS}
                    value={detail.timing ?? 'under_load'}
                  />
                </View>
              </View>
            );
          })}

          <ReedText tone="muted" variant="caption">
            Not medical advice — I'll adapt your exercise selection based on this.
          </ReedText>
        </View>
      ) : null}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 10,
  },
  detailsContainer: {
    gap: 20,
    marginTop: 8,
  },
  mainDivider: {
    height: 1,
  },
  areaDetailBlock: {
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  row: {
    gap: 8,
  },
});

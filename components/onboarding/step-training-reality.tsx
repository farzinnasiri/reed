// ---------------------------------------------------------------------------
// Step 3: Training Reality — flat, direct, no nested cards.
// Four segmented controls live as flat inline rows with a thin separator
// between them — no outer surface wrapper. Style chips and equipment chips
// stand alone with section labels.
// ---------------------------------------------------------------------------

import { StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ChipSelect } from './chip-select';
import { OnboardingShell } from './onboarding-shell';
import { useReedTheme } from '@/design/provider';
import type {
  Effort,
  EquipmentAccess,
  OnboardingDraft,
  SessionDuration,
  TrainingAge,
  TrainingStyle,
  WeeklySessions,
} from './types';

import {
  DURATION_OPTIONS,
  EFFORT_OPTIONS,
  EQUIPMENT_CHIPS,
  TRAINING_AGE_OPTIONS,
  TRAINING_STYLE_CHIPS,
  WEEKLY_OPTIONS,
} from './labels';

type StepTrainingRealityProps = {
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

export function isTrainingRealityValid(draft: OnboardingDraft): boolean {
  return (
    draft.trainingAge !== null &&
    draft.weeklySessions !== null &&
    draft.sessionDuration !== null &&
    draft.effort !== null &&
    draft.trainingStyles.length > 0 &&
    draft.trainingStyles.length <= 3 &&
    draft.equipmentAccess.length > 0
  );
}

export function StepTrainingReality({
  backPlacement,
  cancelLabel,
  draft,
  onBack,
  onCancel,
  onContinue,
  onUpdateDraft,
  stepCount,
  stepIndex,
}: StepTrainingRealityProps) {
  const { theme } = useReedTheme();

  return (
    <OnboardingShell
      backPlacement={backPlacement}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      continueDisabled={!isTrainingRealityValid(draft)}
      onBack={onBack}
      onContinue={onContinue}
      stepCount={stepCount}
      stepIndex={stepIndex}
    >
      <View style={styles.titleBlock}>
        <ReedText variant="title">
          How do you actually train?
        </ReedText>
        <ReedText tone="muted">
          Not the plan you wish you had — the one you show up to.
        </ReedText>
      </View>

      {/* Flat rows — no outer card */}
      <View style={styles.fieldGroup}>
        <View style={styles.fieldRow}>
          <ReedText variant="bodyStrong" style={styles.fieldLabel}>
            How long have you been training?
          </ReedText>
          <SegmentedControl<TrainingAge>
            compact
            onChange={value => onUpdateDraft({ trainingAge: value })}
            options={TRAINING_AGE_OPTIONS}
            value={draft.trainingAge ?? 'starting'}
          />
        </View>

        <View style={[styles.separator, { backgroundColor: theme.colors.borderSoft }]} />

        <View style={styles.fieldRow}>
          <ReedText variant="bodyStrong" style={styles.fieldLabel}>
            Sessions per week
          </ReedText>
          <SegmentedControl<WeeklySessions>
            compact
            onChange={value => onUpdateDraft({ weeklySessions: value })}
            options={WEEKLY_OPTIONS}
            value={draft.weeklySessions ?? 'one_to_two'}
          />
        </View>

        <View style={[styles.separator, { backgroundColor: theme.colors.borderSoft }]} />

        <View style={styles.fieldRow}>
          <ReedText variant="bodyStrong" style={styles.fieldLabel}>
            Session length
          </ReedText>
          <SegmentedControl<SessionDuration>
            compact
            onChange={value => onUpdateDraft({ sessionDuration: value })}
            options={DURATION_OPTIONS}
            value={draft.sessionDuration ?? 'under_45'}
          />
        </View>

        <View style={[styles.separator, { backgroundColor: theme.colors.borderSoft }]} />

        <View style={styles.fieldRow}>
          <ReedText variant="bodyStrong" style={styles.fieldLabel}>
            Effort level
          </ReedText>
          <SegmentedControl<Effort>
            compact
            onChange={value => onUpdateDraft({ effort: value })}
            options={EFFORT_OPTIONS}
            value={draft.effort ?? 'easy'}
          />
        </View>
      </View>

      {/* Training style — chips, plain section */}
      <View style={styles.chipSection}>
        <View style={styles.chipHeader}>
          <ReedText variant="bodyStrong">Training style</ReedText>
          <ReedText tone="muted" variant="caption">Up to 3</ReedText>
        </View>
        <ChipSelect<TrainingStyle>
          max={3}
          onChange={selected => onUpdateDraft({ trainingStyles: selected })}
          options={TRAINING_STYLE_CHIPS}
          selected={draft.trainingStyles}
        />
      </View>

      {/* Equipment — chips, plain section */}
      <View style={styles.chipSection}>
        <ReedText variant="bodyStrong">Where do you train?</ReedText>
        <ChipSelect<EquipmentAccess>
          onChange={selected => onUpdateDraft({ equipmentAccess: selected })}
          options={EQUIPMENT_CHIPS}
          selected={draft.equipmentAccess}
        />
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 10,
  },
  fieldGroup: {
    gap: 0,
  },
  fieldRow: {
    gap: 10,
    paddingVertical: 14,
  },
  fieldLabel: {
    // inherits bodyStrong
  },
  separator: {
    height: 1,
  },
  chipSection: {
    gap: 12,
  },
  chipHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
  },
});

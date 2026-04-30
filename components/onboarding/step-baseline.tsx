// ---------------------------------------------------------------------------
// Step 2: Baseline — birth date, body sizing, recovery.
// All number inputs use keyboardType="number-pad" for mobile.
// Birth date is three separate fields: day, month, year.
// Flat layout — no nested surface cards.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { RECOVERY_OPTIONS } from './labels';
import { OnboardingShell } from './onboarding-shell';
import type { OnboardingDraft, RecoveryQuality } from './types';

const RECOVERY_COPY: Record<RecoveryQuality, string> = {
  solid: 'Usually rested, stable energy.',
  mixed: 'Some poor sleep or inconsistent energy.',
  fragile: 'Poor sleep, high stress, or often un-restored.',
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isBaselineValid(draft: OnboardingDraft): boolean {
  const age = calcAge(draft);
  const height = parseFloat(draft.heightCm);
  const weight = parseFloat(draft.weightKg);

  if (age === null || age < 13 || age > 90) return false;
  if (Number.isNaN(height) || height < 100 || height > 250) return false;
  if (Number.isNaN(weight) || weight < 25 || weight > 300) return false;
  if (!draft.recoveryQuality) return false;
  if (!isValidDate(draft)) return false;

  return true;
}

function isValidDate(draft: OnboardingDraft): boolean {
  const { birthDay, birthMonth, birthYear } = draft;
  if (!birthDay || !birthMonth || !birthYear) return false;
  if (birthMonth < 1 || birthMonth > 12) return false;
  if (birthDay < 1 || birthDay > 31) return false;
  if (birthYear < 1900 || birthYear > new Date().getFullYear()) return false;
  return true;
}

function calcAge(draft: OnboardingDraft): number | null {
  if (!draft.birthYear || !draft.birthMonth || !draft.birthDay) return null;
  const today = new Date();
  let age = today.getFullYear() - draft.birthYear;
  const monthDiff = today.getMonth() + 1 - draft.birthMonth;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < draft.birthDay)) {
    age--;
  }
  return age;
}

function getBirthError(draft: OnboardingDraft): string | null {
  if (!isValidDate(draft)) return null; // only show after user has filled all three
  const age = calcAge(draft);
  if (age === null) return null;
  if (age < 13) return 'Must be at least 13 to use Reed.';
  if (age > 90) return 'Check this date.';
  return null;
}

function getHeightError(value: string): string | null {
  if (!value) return null;
  const h = parseFloat(value);
  if (Number.isNaN(h) || h < 100 || h > 250) return 'Expected 100–250 cm.';
  return null;
}

function getWeightError(value: string): string | null {
  if (!value) return null;
  const w = parseFloat(value);
  if (Number.isNaN(w) || w < 25 || w > 300) return 'Expected 25–300 kg.';
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type StepBaselineProps = {
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

export function StepBaseline({
  backPlacement,
  cancelLabel,
  draft,
  onBack,
  onCancel,
  onContinue,
  onUpdateDraft,
  stepCount,
  stepIndex,
}: StepBaselineProps) {
  const { theme } = useReedTheme();
  const [showBodyComp, setShowBodyComp] = useState(
    Boolean(draft.bodyFatPercent || draft.skeletalMuscleMassKg || draft.restingHeartRate),
  );

  const [dayStr, setDayStr] = useState(draft.birthDay != null ? String(draft.birthDay) : '');
  const [monthStr, setMonthStr] = useState(draft.birthMonth != null ? String(draft.birthMonth) : '');
  const [yearStr, setYearStr] = useState(draft.birthYear != null ? String(draft.birthYear) : '');

  const birthError = getBirthError(draft);
  const heightError = getHeightError(draft.heightCm);
  const weightError = getWeightError(draft.weightKg);

  return (
    <OnboardingShell
      backPlacement={backPlacement}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      continueDisabled={!isBaselineValid(draft)}
      onBack={onBack}
      onContinue={onContinue}
      stepCount={stepCount}
      stepIndex={stepIndex}
    >
      <View style={styles.titleBlock}>
        <ReedText variant="title">Tell me about your body.</ReedText>
        <ReedText tone="muted">
          Just the sizing and recovery baseline. Everything else can wait.
        </ReedText>
      </View>

      {/* Birth date — three number inputs in a row */}
      <View style={styles.fieldGroup}>
        <ReedText variant="bodyStrong">Date of birth</ReedText>
        <View style={styles.dateRow}>
          <View style={styles.dateFieldDay}>
            <ReedInput
              keyboardType="number-pad"
              label="Day"
              maxLength={2}
              onChangeText={text => {
                const clean = text.replace(/\D/g, '');
                setDayStr(clean);
                onUpdateDraft({ birthDay: clean ? parseInt(clean, 10) : null });
              }}
              placeholder="DD"
              value={dayStr}
            />
          </View>
          <View style={styles.dateFieldMonth}>
            <ReedInput
              keyboardType="number-pad"
              label="Month"
              maxLength={2}
              onChangeText={text => {
                const clean = text.replace(/\D/g, '');
                setMonthStr(clean);
                onUpdateDraft({ birthMonth: clean ? parseInt(clean, 10) : null });
              }}
              placeholder="MM"
              value={monthStr}
            />
          </View>
          <View style={styles.dateFieldYear}>
            <ReedInput
              keyboardType="number-pad"
              label="Year"
              maxLength={4}
              onChangeText={text => {
                const clean = text.replace(/\D/g, '');
                setYearStr(clean);
                onUpdateDraft({ birthYear: clean ? parseInt(clean, 10) : null });
              }}
              placeholder="YYYY"
              value={yearStr}
            />
          </View>
        </View>
        {birthError ? (
          <ReedText tone="danger" variant="caption">{birthError}</ReedText>
        ) : null}
      </View>

      {/* Height + weight */}
      <View style={styles.row}>
        <View style={styles.halfField}>
          <ReedInput
            keyboardType="decimal-pad"
            label="Height (cm)"
            onChangeText={text => onUpdateDraft({ heightCm: text })}
            placeholder="170"
            value={draft.heightCm}
          />
          {heightError ? (
            <ReedText tone="danger" variant="caption">{heightError}</ReedText>
          ) : null}
        </View>
        <View style={styles.halfField}>
          <ReedInput
            keyboardType="decimal-pad"
            label="Weight (kg)"
            onChangeText={text => onUpdateDraft({ weightKg: text })}
            placeholder="70"
            value={draft.weightKg}
          />
          {weightError ? (
            <ReedText tone="danger" variant="caption">{weightError}</ReedText>
          ) : null}
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.colors.borderSoft }]} />

      {/* Recovery */}
      <View style={styles.fieldGroup}>
        <ReedText variant="bodyStrong">How's your sleep and recovery?</ReedText>
        <SegmentedControl<RecoveryQuality>
          onChange={value => onUpdateDraft({ recoveryQuality: value })}
          options={RECOVERY_OPTIONS}
          value={draft.recoveryQuality ?? 'solid'}
        />
        {draft.recoveryQuality ? (
          <ReedText tone="muted" variant="caption">
            {RECOVERY_COPY[draft.recoveryQuality]}
          </ReedText>
        ) : null}
      </View>

      {/* Optional body composition */}
      {!showBodyComp ? (
        <Pressable
          onPress={() => setShowBodyComp(true)}
          style={({ pressed }) => [styles.revealLink, getTapScaleStyle(pressed)]}
        >
          <ReedText tone="accent" variant="bodyStrong">
            + I already track body composition
          </ReedText>
        </Pressable>
      ) : (
        <View style={styles.fieldGroup}>
          <View style={[styles.divider, { backgroundColor: theme.colors.borderSoft }]} />
          <ReedText variant="bodyStrong" tone="muted">Body composition (optional)</ReedText>
          <ReedInput
            keyboardType="decimal-pad"
            label="Body fat %"
            onChangeText={text => onUpdateDraft({ bodyFatPercent: text })}
            placeholder="e.g. 15"
            value={draft.bodyFatPercent}
          />
          <ReedInput
            keyboardType="decimal-pad"
            label="Skeletal muscle mass (kg)"
            onChangeText={text => onUpdateDraft({ skeletalMuscleMassKg: text })}
            placeholder="e.g. 32"
            value={draft.skeletalMuscleMassKg}
          />
          <ReedInput
            keyboardType="number-pad"
            label="Resting heart rate (bpm)"
            onChangeText={text => onUpdateDraft({ restingHeartRate: text })}
            placeholder="e.g. 62"
            value={draft.restingHeartRate}
          />
        </View>
      )}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 10,
  },
  fieldGroup: {
    gap: 10,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateFieldDay: {
    width: 64,
  },
  dateFieldMonth: {
    width: 72,
  },
  dateFieldYear: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
    gap: 4,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  revealLink: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
  },
});

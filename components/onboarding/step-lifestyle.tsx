// ---------------------------------------------------------------------------
// Step: Lifestyle — normal-day context outside workouts.
// Uses plain-language option rows instead of compressed segmented labels.
// ---------------------------------------------------------------------------

import { Pressable, StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { OnboardingShell } from './onboarding-shell';
import type { DailyMovement, EatingRoutine, IdleMovement, OnboardingDraft, UsualSteps } from './types';

type Option<T extends string> = {
  description: string;
  label: string;
  value: T;
};

const DAILY_MOVEMENT_OPTIONS: Array<Option<DailyMovement>> = [
  { label: 'Mostly sitting', value: 'mostly_sitting', description: 'Desk, school, driving, long seated blocks.' },
  { label: 'On my feet often', value: 'on_feet', description: 'Standing, errands, service work, light movement.' },
  { label: 'Out and about', value: 'walks_a_lot', description: 'Commute, active routine, lots of time moving.' },
  { label: 'Physical job', value: 'physical_job', description: 'Lifting, carrying, manual work, labor.' },
];

const IDLE_MOVEMENT_OPTIONS: Array<Option<IdleMovement>> = [
  { label: 'Mostly still', value: 'mostly_still', description: 'When I sit, I usually stay settled.' },
  { label: 'Some fidgeting', value: 'fidget_sometimes', description: 'I tap, shift, or get up here and there.' },
  { label: 'Always moving', value: 'always_moving', description: 'I pace, fidget, or move around a lot.' },
];

const USUAL_STEPS_OPTIONS: Array<Option<UsualSteps>> = [
  { label: 'Not sure', value: 'not_sure', description: 'You do not track steps right now.' },
  { label: 'Under 4k', value: 'under_4k', description: 'Mostly low daily movement.' },
  { label: '4k–8k', value: 'four_to_8k', description: 'A normal mixed day.' },
  { label: '8k–12k', value: 'eight_to_12k', description: 'A noticeably active day.' },
  { label: '12k+', value: 'over_12k', description: 'High daily movement most days.' },
];

const EATING_ROUTINE_OPTIONS: Array<Option<EatingRoutine>> = [
  { label: 'Pretty consistent', value: 'consistent', description: 'Meals are predictable most days.' },
  { label: 'Hit or miss', value: 'hit_or_miss', description: 'Some days are solid, some get messy.' },
  { label: 'I often under-eat', value: 'often_under_eat', description: 'You miss meals or struggle to eat enough.' },
  { label: 'I often overeat', value: 'often_overeat', description: 'Intake often runs higher than intended.' },
  { label: 'Not sure', value: 'not_sure', description: 'No strong pattern yet.' },
];

type StepLifestyleProps = {
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

export function StepLifestyle({
  backPlacement,
  cancelLabel,
  draft,
  onBack,
  onCancel,
  onContinue,
  onUpdateDraft,
  stepCount,
  stepIndex,
}: StepLifestyleProps) {
  return (
    <OnboardingShell
      backPlacement={backPlacement}
      cancelLabel={cancelLabel}
      onBack={onBack}
      onCancel={onCancel}
      onContinue={onContinue}
      stepCount={stepCount}
      stepIndex={stepIndex}
    >
      <View style={styles.titleBlock}>
        <ReedText variant="title">What does a normal day look like?</ReedText>
        <ReedText tone="muted">
          This helps me understand the work your body does outside workouts.
        </ReedText>
      </View>

      <View style={styles.sections}>
        <OptionGroup<DailyMovement>
          onChange={value => onUpdateDraft({ dailyMovement: value })}
          options={DAILY_MOVEMENT_OPTIONS}
          title="Daily movement"
          value={draft.dailyMovement}
        />
        <OptionGroup<UsualSteps>
          onChange={value => onUpdateDraft({ usualSteps: value })}
          options={USUAL_STEPS_OPTIONS}
          title="Usual daily steps"
          value={draft.usualSteps}
        />
        <OptionGroup<IdleMovement>
          onChange={value => onUpdateDraft({ idleMovement: value })}
          options={IDLE_MOVEMENT_OPTIONS}
          title="When sitting still"
          value={draft.idleMovement}
        />
        <OptionGroup<EatingRoutine>
          onChange={value => onUpdateDraft({ eatingRoutine: value })}
          options={EATING_ROUTINE_OPTIONS}
          title="Eating routine"
          value={draft.eatingRoutine}
        />
      </View>
    </OnboardingShell>
  );
}

type OptionGroupProps<T extends string> = {
  onChange: (value: T) => void;
  options: Array<Option<T>>;
  title: string;
  value: T | null;
};

function OptionGroup<T extends string>({ onChange, options, title, value }: OptionGroupProps<T>) {
  const { theme } = useReedTheme();

  return (
    <View style={styles.group}>
      <ReedText variant="bodyStrong">{title}</ReedText>
      <View style={styles.optionStack}>
        {options.map(option => {
          const isActive = option.value === value;

          return (
            <Pressable
              accessibilityLabel={`${title}: ${option.label}. ${option.description}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.optionRow,
                {
                  backgroundColor: isActive ? theme.colors.accentPrimary : theme.colors.controlFill,
                  borderColor: isActive ? theme.colors.accentPrimary : theme.colors.controlBorder,
                },
                getTapScaleStyle(pressed),
              ]}
            >
              <View style={styles.optionText}>
                <ReedText
                  style={{ color: isActive ? theme.colors.accentPrimaryText : theme.colors.textPrimary }}
                  variant="bodyStrong"
                >
                  {option.label}
                </ReedText>
                <ReedText
                  style={{ color: isActive ? theme.colors.accentPrimaryText : theme.colors.textMuted }}
                  variant="caption"
                >
                  {option.description}
                </ReedText>
              </View>
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: isActive ? theme.colors.accentPrimaryText : theme.colors.borderSoft,
                  },
                ]}
              >
                {isActive ? (
                  <View style={[styles.radioDot, { backgroundColor: theme.colors.accentPrimaryText }]} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 10,
  },
  sections: {
    gap: 26,
  },
  group: {
    gap: 12,
  },
  optionStack: {
    gap: 8,
  },
  optionRow: {
    alignItems: 'center',
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: {
    flex: 1,
    gap: 3,
  },
  radio: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioDot: {
    borderRadius: reedRadii.pill,
    height: 10,
    width: 10,
  },
});

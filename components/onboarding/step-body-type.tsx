// ---------------------------------------------------------------------------
// Step: Body Type — optional, low-pressure starting point picker.
// Selection is useful context, but continuing without a choice is valid.
// ---------------------------------------------------------------------------

import { Pressable, StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { OnboardingShell } from './onboarding-shell';
import type { BodyType, OnboardingDraft } from './types';

const BODY_TYPE_OPTIONS: Array<{ label: string; subtitle: string; value: BodyType }> = [
  {
    label: 'Lean build',
    subtitle: "I'm slim and don't carry much fat or muscle yet.",
    value: 'skinny',
  },
  {
    label: 'Lean with belly fat',
    subtitle: 'I look smaller overall, but carry fat around my middle.',
    value: 'skinny_fat',
  },
  {
    label: 'Higher body fat',
    subtitle: 'I have more fat to lose before definition shows.',
    value: 'high_fat',
  },
  {
    label: 'Bigger build',
    subtitle: 'I have size already and want to shape it better.',
    value: 'bulky',
  },
  {
    label: 'Athletic build',
    subtitle: 'I already look trained or move like I train.',
    value: 'athletic',
  },
];

type StepBodyTypeProps = {
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

export function StepBodyType({
  backPlacement,
  cancelLabel,
  draft,
  onBack,
  onCancel,
  onContinue,
  onUpdateDraft,
  stepCount,
  stepIndex,
}: StepBodyTypeProps) {
  const { theme } = useReedTheme();

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
        <ReedText variant="title">
          What best describes your starting point?
        </ReedText>
        <ReedText tone="muted">
          Pick one if it helps. You can also leave it blank.
        </ReedText>
      </View>

      <View style={styles.pickerStage}>
        <View style={styles.optionList}>
          {BODY_TYPE_OPTIONS.map(option => {
            const isActive = draft.bodyType === option.value;

            return (
              <Pressable
                accessibilityLabel={`${option.label}. ${option.subtitle}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={option.value}
                onPress={() => onUpdateDraft({ bodyType: isActive ? null : option.value })}
                style={({ pressed }) => [
                  styles.optionRow,
                  {
                    backgroundColor: isActive ? theme.colors.accentPrimary : theme.colors.controlFill,
                    borderColor: isActive ? theme.colors.accentPrimary : theme.colors.controlBorder,
                  },
                  getTapScaleStyle(pressed),
                ]}
              >
                <View
                  style={[
                    styles.placeholderImage,
                    {
                      backgroundColor: isActive ? theme.colors.accentPrimaryText : theme.colors.canvasSecondary,
                      borderColor: isActive ? theme.colors.accentPrimaryText : theme.colors.borderSoft,
                    },
                  ]}
                />
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
                    {option.subtitle}
                  </ReedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 10,
  },
  pickerStage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 420,
  },
  optionList: {
    gap: 12,
    width: '100%',
  },
  optionRow: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: reedRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '92%',
  },
  placeholderImage: {
    borderRadius: reedRadii.md,
    borderWidth: 1,
    height: 44,
    width: 44,
  },
  optionText: {
    flex: 1,
    gap: 3,
  },
});

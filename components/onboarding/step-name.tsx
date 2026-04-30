import { StyleSheet, View } from 'react-native';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { OnboardingShell } from './onboarding-shell';

type StepNameProps = {
  backPlacement?: 'footer' | 'header';
  cancelLabel?: string;
  displayName: string;
  onBack: () => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
  onContinue: () => void;
  onUpdateName: (value: string) => void;
  stepCount: number;
  stepIndex: number;
};

export function StepName({
  backPlacement,
  cancelLabel,
  displayName,
  onBack,
  onCancel,
  onContinue,
  onUpdateName,
  stepCount,
  stepIndex,
}: StepNameProps) {
  const trimmed = displayName.trim();

  return (
    <OnboardingShell
      backPlacement={backPlacement}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      backLabel="Maybe later"
      continueDisabled={trimmed.length < 2}
      continueLabel="Continue"
      onBack={onBack}
      onContinue={onContinue}
      stepCount={stepCount}
      stepIndex={stepIndex}
    >
      <View style={styles.titleBlock}>
        <ReedText variant="title">What should I call you?</ReedText>
        <ReedText tone="muted">
          This is the name Reed will use in your profile and coaching context.
        </ReedText>
      </View>

      <ReedInput
        autoCapitalize="words"
        autoCorrect={false}
        label="Name"
        onChangeText={onUpdateName}
        placeholder="e.g. Farzin"
        value={displayName}
      />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 10,
  },
});

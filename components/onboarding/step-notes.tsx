import { StyleSheet, View } from 'react-native';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { OnboardingShell } from './onboarding-shell';

const USER_NOTES_MAX_LENGTH = 1200;

type StepNotesProps = {
  backPlacement?: 'footer' | 'header';
  cancelLabel?: string;
  notes: string;
  onBack: () => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
  onContinue: () => void;
  onUpdateNotes: (value: string) => void;
  stepCount: number;
  stepIndex: number;
};

export function StepNotes({
  backPlacement,
  cancelLabel,
  notes,
  onBack,
  onCancel,
  onContinue,
  onUpdateNotes,
  stepCount,
  stepIndex,
}: StepNotesProps) {
  return (
    <OnboardingShell
      backPlacement={backPlacement}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      continueLabel="Continue"
      onBack={onBack}
      onContinue={onContinue}
      stepCount={stepCount}
      stepIndex={stepIndex}
    >
      <View style={styles.titleBlock}>
        <ReedText variant="title">Anything else I should know?</ReedText>
        <ReedText tone="muted">
          Optional. Add any notes about preferences, schedule realities, past injuries, or context you want Reed to keep in mind.
        </ReedText>
      </View>

      <View style={styles.inputHeaderRow}>
        <ReedText variant="label" tone="muted">YOUR NOTE (OPTIONAL)</ReedText>
        <ReedText tone="muted" variant="caption">
          {notes.trim().length}/{USER_NOTES_MAX_LENGTH}
        </ReedText>
      </View>

      <ReedInput
        autoCapitalize="sentences"
        autoCorrect
        maxLength={USER_NOTES_MAX_LENGTH}
        multiline
        numberOfLines={5}
        onChangeText={onUpdateNotes}
        placeholder="e.g. I travel twice a month, prefer lower-back friendly hinge work, and want short weekday sessions."
        style={styles.notesInput}
        textAlignVertical="top"
        value={notes}
      />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 10,
  },
  inputHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notesInput: {
    minHeight: 136,
    paddingTop: 14,
  },
});

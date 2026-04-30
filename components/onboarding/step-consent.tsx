// ---------------------------------------------------------------------------
// Step 1: Consent
// - Introduces Reed in first person
// - Checkbox toggles local state ONLY — does not advance the screen
// - "Let's go" button is the only way to proceed, disabled until checked
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { OnboardingShell } from './onboarding-shell';

type StepConsentProps = {
  backPlacement?: 'footer' | 'header';
  cancelLabel?: string;
  onConsent: () => void;
  onDecline: () => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
  stepCount: number;
  stepIndex: number;
};

export function StepConsent({
  backPlacement,
  cancelLabel,
  onConsent,
  onDecline,
  onCancel,
  stepCount,
  stepIndex,
}: StepConsentProps) {
  const { theme } = useReedTheme();
  // Local state — checking the box does NOT advance the screen.
  const [checked, setChecked] = useState(false);

  return (
    <OnboardingShell
      backPlacement={backPlacement}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      backLabel="Decline"
      continueDisabled={!checked}
      continueLabel="Let's go"
      onBack={onDecline}
      onContinue={onConsent}
      showBack={true}
      showContinue={true}
      stepCount={stepCount}
      stepIndex={stepIndex}
    >
      {/* Introduction */}
      <View style={styles.intro}>
        <ReedText tone="muted" variant="bodyStrong">
          Hey, I'm Reed.
        </ReedText>
        <ReedText variant="display">
          I learn once.{'\n'}Then I get out of your way.
        </ReedText>
      </View>

      <ReedText tone="muted">
        A few questions about your training, your body, and your constraints.
        I'll use them to build a profile that fits you — so I stop guessing
        every time you show up.
      </ReedText>

      {/* Consent checkbox — tapping ONLY toggles, does not navigate */}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => setChecked(prev => !prev)}
        style={({ pressed }) => [
          styles.consentSurface,
          {
            borderColor: checked
              ? theme.colors.accentPrimary
              : theme.colors.borderStrong,
            backgroundColor: 'transparent',
          },
          getTapScaleStyle(pressed),
        ]}
      >
        <View style={styles.consentInner}>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: checked
                  ? theme.colors.accentPrimary
                  : theme.colors.borderStrong,
                backgroundColor: checked
                  ? theme.colors.accentPrimary
                  : 'transparent',
              },
            ]}
          />
          <ReedText
            style={{
              color: theme.colors.textPrimary,
              flex: 1,
            }}
            variant="bodyStrong"
          >
            Use my answers to build my training profile.
          </ReedText>
        </View>
      </Pressable>

      <ReedText tone="muted" variant="caption">
        Nothing is shared. I use this for recommendations, substitutions, and
        recovery logic. You can edit or delete your profile any time.
      </ReedText>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: 8,
    paddingTop: 8,
  },
  consentSurface: {
    borderRadius: reedRadii.md,
    borderWidth: 1.5,
  },
  consentInner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  checkbox: {
    borderRadius: 4,
    borderWidth: 1.5,
    height: 18,
    width: 18,
  },
});

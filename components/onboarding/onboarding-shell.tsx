// ---------------------------------------------------------------------------
// OnboardingShell - shared layout for all onboarding steps.
// Action row: back link has a FIXED width so continue button stays the same
// size across all steps regardless of back label length.
// ---------------------------------------------------------------------------

import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canUseGlassBlur, getGlassControlTokens } from '@/components/ui/glass-material';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { ScreenBackdrop } from '@/components/ui/screen-backdrop';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';

// Fixed width for the back link so the Continue button is always the same size.
const BACK_LINK_WIDTH = 128;
const ACTION_DOCK_HEIGHT = 74;

type OnboardingShellProps = {
  backLabel?: string;
  backPlacement?: 'footer' | 'header';
  cancelLabel?: string;
  children: ReactNode;
  continueDisabled?: boolean;
  continueLabel?: string;
  onBack?: () => void;
  onCancel?: () => void;
  onContinue: () => void;
  showContinue?: boolean;
  showBack?: boolean;
  stepIndex: number;
  stepCount: number;
};

export function OnboardingShell({
  backLabel = 'Back',
  backPlacement = 'footer',
  cancelLabel = 'Cancel',
  children,
  continueDisabled = false,
  continueLabel = 'Continue',
  onBack,
  onCancel,
  onContinue,
  showContinue = true,
  showBack = true,
  stepIndex,
  stepCount,
}: OnboardingShellProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const canUseBlur = canUseGlassBlur();
  const controls = getGlassControlTokens(theme);

  const showHeaderBack = backPlacement === 'header' && showBack && onBack;
  const showHeaderCancel = Boolean(onCancel);
  const showFooterBack = backPlacement === 'footer' && showBack && onBack;
  const actionDockBottom = insets.bottom + theme.spacing.md;
  const actionDockReservedSpace = actionDockBottom + ACTION_DOCK_HEIGHT + theme.spacing.sm;

  return (
    <ScreenBackdrop>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <View style={{ height: insets.top + theme.spacing.xs }} />

        {/* Wordmark + dot progress */}
        <View style={[styles.header, { paddingHorizontal: theme.spacing.lg }]}> 
          {showHeaderCancel ? (
            <Pressable
              accessibilityLabel={cancelLabel}
              onPress={onCancel}
              style={({ pressed }) => [styles.headerBackLink, getTapScaleStyle(pressed)]}
            >
              <ReedText tone="muted" variant="bodyStrong">
                {cancelLabel}
              </ReedText>
            </Pressable>
          ) : showHeaderBack ? (
            <Pressable
              accessibilityLabel={backLabel}
              onPress={onBack}
              style={({ pressed }) => [styles.headerBackLink, getTapScaleStyle(pressed)]}
            >
              <ReedText tone="muted" variant="bodyStrong">
                {backLabel}
              </ReedText>
            </Pressable>
          ) : (
            <ReedText variant="brand">REED</ReedText>
          )}

          <View
            accessibilityLabel={`Step ${stepIndex + 1} of ${stepCount}`}
            style={styles.dots}
          >
            {Array.from({ length: stepCount }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i <= stepIndex
                        ? theme.colors.accentPrimary
                        : theme.colors.borderSoft,
                    width: i === stepIndex ? 16 : 6,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Step content */}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: actionDockReservedSpace,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          {children}
        </ScrollView>

        {/* Action row - frosted control dock */}
        <View
          style={[
            styles.actionDockOuter,
            {
              bottom: actionDockBottom,
              left: theme.spacing.lg,
              right: theme.spacing.lg,
            },
          ]}
        >
          <View
            style={[
              styles.actionDock,
              {
                backgroundColor: controls.shellBackgroundColor,
                borderColor: controls.shellBorderColor,
              },
            ]}
          >
            {canUseBlur ? (
              <BlurView
                intensity={theme.mode === 'dark' ? 36 : 44}
                style={StyleSheet.absoluteFill}
                tint={theme.blur.tint}
              />
            ) : null}
            <View style={styles.actionRow}>
              <View style={styles.backSlot}>
                {showFooterBack ? (
                  <ReedButton
                    accessibilityLabel={backLabel}
                    elevated={false}
                    label={backLabel}
                    onPress={onBack}
                    style={styles.backButton}
                    variant="ghost"
                  />
                ) : null}
              </View>

              {showContinue ? (
                <ReedButton
                  disabled={continueDisabled}
                  elevated={false}
                  label={continueLabel}
                  onPress={onContinue}
                  style={styles.continueButton}
                />
              ) : null}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenBackdrop>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    borderRadius: 999,
    height: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: 28,
    paddingTop: 12,
  },
  actionDockOuter: {
    position: 'absolute',
    zIndex: 10,
  },
  actionDock: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  // Fixed-width slot - back label text never affects continue button size
  backSlot: {
    width: BACK_LINK_WIDTH,
  },
  headerBackLink: {
    justifyContent: 'center',
    minHeight: 44,
  },
  backButton: {
    width: '100%',
  },
  backLink: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 54, // matches ReedButton inner minHeight
  },
  continueButton: {
    flex: 1,
  },
});

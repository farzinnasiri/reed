// ---------------------------------------------------------------------------
// Step 6: Profile Review — what Reed understood.
// Clean document feel. No card-in-card. Sections flow like a brief.
// Edit links are inline text, not buttons.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ReedText } from '@/components/ui/reed-text';
import { ReedButton } from '@/components/ui/reed-button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { OnboardingShell } from './onboarding-shell';
import { buildReviewSections, buildTradeoffStatement } from './review-summary';
import type { OnboardingDraft, OnboardingStep } from './types';

type StepReviewProps = {
  backPlacement?: 'footer' | 'header';
  cancelLabel?: string;
  continueLabel?: string;
  draft: OnboardingDraft;
  onBack: () => void;
  onCancel?: () => Promise<void> | void;
  onCreateProfile: (draft: OnboardingDraft) => Promise<void> | void;
  onEditStep: (step: OnboardingStep) => void;
  onSaveProfile?: (draft: OnboardingDraft) => Promise<void>;
  stepCount: number;
  stepIndex: number;
};

const LOADING_LINES = [
  'Setting your training budget',
  'Checking recovery constraints',
  'Prioritizing your first block',
];

export function buildCompleteOnboardingPayload(draft: OnboardingDraft) {
  return {
    displayName: draft.displayName.trim(),
    baseline: {
      birthDay: draft.birthDay ?? 0,
      birthMonth: draft.birthMonth ?? 0,
      birthYear: draft.birthYear ?? 0,
      heightCm: parseRequiredNumber(draft.heightCm),
      recoveryQuality: draft.recoveryQuality,
    },
    constraints: {
      areas: draft.constraintAreas,
      details: Object.fromEntries(
        draft.constraintAreas.map(area => {
          const detail = draft.constraintDetails[area];
          return [
            area,
            {
              customDetail: normalizeText(detail?.customDetail ?? null),
              severity: detail?.severity ?? null,
              timing: detail?.timing ?? null,
            },
          ];
        }),
      ),
    },
    goalDetails: Object.fromEntries(
      draft.rankedGoals
        .filter(goal => draft.goalDetails[goal])
        .map(goal => {
          const detail = draft.goalDetails[goal]!;
          return [
            goal,
            {
              customDetail: normalizeText(detail.customDetail),
              detail: normalizeText(detail.detail),
              focusAreas: detail.focusAreas,
            },
          ];
        }),
    ),
    bodyMetrics: {
      bodyFatPercent: parseOptionalNumber(draft.bodyFatPercent),
      restingHeartRate: parseOptionalNumber(draft.restingHeartRate),
      skeletalMuscleMassKg: parseOptionalNumber(draft.skeletalMuscleMassKg),
      weightKg: parseOptionalNumber(draft.weightKg),
    },
    performanceAnchors: {
      bodyweight: Object.fromEntries(
        Object.entries(draft.bodyweightStrengthAnchors)
          .map(([key, value]) => [key, parseOptionalInteger(value ?? '')])
          .filter(([, value]) => value !== null),
      ),
      cardio: {
        run1KmSeconds: parseOptionalDurationToSeconds(draft.cardioAnchor.run1KmTime),
        run5KmSeconds: parseOptionalDurationToSeconds(draft.cardioAnchor.run5KmTime),
        stairFloors: parseOptionalInteger(draft.cardioAnchor.floors),
        stairMinutes: parseOptionalNumber(draft.cardioAnchor.minutes),
      },
      loaded: Object.fromEntries(
        Object.entries(draft.loadedStrengthAnchors).flatMap(([key, value]) => {
          if (!value) {
            return [];
          }
          const parsed = {
            loadKg: parseOptionalNumber(value.loadKg),
            reps: parseOptionalInteger(value.reps),
          };
          return parsed.loadKg !== null && parsed.reps !== null ? [[key, parsed] as const] : [];
        }),
      ),
    },
    userNotes: normalizeText(draft.userNotes),
    profilingConsent: true as const,
    rankedGoals: draft.rankedGoals,
    trainingReality: {
      effort: draft.effort,
      equipmentAccess: draft.equipmentAccess,
      sessionDuration: draft.sessionDuration,
      trainingAge: draft.trainingAge,
      trainingStyles: draft.trainingStyles,
      weeklySessions: draft.weeklySessions,
    },
  };
}

function parseRequiredNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInteger(value: string) {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDurationToSeconds(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(':').map(part => part.trim());
  if (parts.length === 2) {
    const minutes = Number.parseInt(parts[0], 10);
    const seconds = Number.parseInt(parts[1], 10);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes * 60 + seconds;
    }
  }
  const numeric = Number.parseFloat(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeText(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getProfileCreationError(error: unknown) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (message) {
      return message;
    }
  }

  return 'Could not save your profile. Try again.';
}

export function StepReview({
  backPlacement,
  cancelLabel,
  continueLabel,
  draft,
  onBack,
  onCancel,
  onCreateProfile,
  onEditStep,
  onSaveProfile,
  stepCount,
  stepIndex,
}: StepReviewProps) {
  const { theme } = useReedTheme();
  const completeOnboarding = useMutation(api.profiles.completeOnboarding);
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [loadingLineIndex, setLoadingLineIndex] = useState(0);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, []);

  const sections = buildReviewSections(draft);
  const tradeoff = buildTradeoffStatement(draft);

  async function handleCreate() {
    setIsCreating(true);
    setCreationError(null);

    loadingIntervalRef.current = setInterval(() => {
      setLoadingLineIndex(prev => (prev + 1) % LOADING_LINES.length);
    }, 700);

    try {
      if (onSaveProfile) {
        await onSaveProfile(draft);
      } else {
        await completeOnboarding(buildCompleteOnboardingPayload(draft));
      }
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      await onCreateProfile(draft);
    } catch (error) {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      if (!isMountedRef.current) {
        return;
      }
      setCreationError(getProfileCreationError(error));
      setIsCreating(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <OnboardingShell
        backPlacement={backPlacement}
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        continueDisabled={isCreating}
        continueLabel={continueLabel ?? 'Create my profile'}
        onBack={onBack}
        onContinue={handleCreate}
        showBack={!isCreating}
        stepCount={stepCount}
        stepIndex={stepIndex}
      >
      {/* Opening */}
      <View style={styles.titleBlock}>
        <ReedText variant="title">Here's what I understood.</ReedText>
        <ReedText tone="muted">
          Edit anything before I build your first block.
        </ReedText>
      </View>

      {/* Sections — document feel, no card wrappers */}
      <View style={styles.sections}>
        {sections.map((section, index) => (
          <View key={section.heading}>
            {index > 0 ? (
              <View
                style={[styles.sectionDivider, { backgroundColor: theme.colors.borderSoft }]}
              />
            ) : null}
            <View style={styles.sectionRow}>
              <View style={styles.sectionContent}>
                <ReedText variant="label" tone="muted">
                  {section.heading.toUpperCase()}
                </ReedText>
                <ReedText>{section.body}</ReedText>
              </View>

              {/* Inline edit link */}
              {section.editStep ? (
                <Pressable
                  onPress={() => onEditStep(section.editStep!)}
                  style={({ pressed }) => [styles.editLink, getTapScaleStyle(pressed)]}
                >
                  <ReedText tone="accent" variant="caption">
                    Edit
                  </ReedText>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {/* Tradeoff statement — slightly heavier weight, still flat */}
      <View style={[styles.tradeoffBlock, { borderTopColor: theme.colors.borderSoft }]}>
        <ReedText variant="label" tone="muted">TRADEOFF</ReedText>
        <ReedText variant="bodyStrong">{tradeoff}</ReedText>
      </View>

      {/* Error state */}
      {creationError ? (
        <View style={styles.errorBlock}>
          <ReedText tone="danger" variant="caption">{creationError}</ReedText>
          <ReedButton label="Try again" onPress={handleCreate} style={styles.retryButton} />
        </View>
      ) : null}
      </OnboardingShell>

    {isCreating ? (
      <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
        <GlassSurface style={styles.loadingCard}>
          <ReedText variant="bodyStrong">Building your starting point.</ReedText>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={String(theme.colors.accentPrimary)} />
            <ReedText tone="muted">{LOADING_LINES[loadingLineIndex]}</ReedText>
          </View>
        </GlassSurface>
      </View>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 10,
  },
  sections: {
    gap: 0,
  },
  sectionDivider: {
    height: 1,
    marginVertical: 16,
  },
  sectionRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  sectionContent: {
    flex: 1,
    gap: 6,
  },
  editLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    paddingTop: 2,
  },
  tradeoffBlock: {
    borderTopWidth: 1,
    gap: 8,
    paddingTop: 20,
  },
  loadingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  loadingCard: {
    alignItems: 'center',
    gap: 16,
    padding: 24,
    width: '100%',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  errorBlock: {
    alignItems: 'center',
    gap: 12,
  },
  retryButton: {
    alignSelf: 'center',
  },
});

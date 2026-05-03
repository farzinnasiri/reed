import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { getGlassControlTokens } from '@/components/ui/glass-material';
import { authClient } from '@/lib/auth-client';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { buildCompleteOnboardingPayload } from '@/components/onboarding/step-review';
import { EMPTY_DRAFT, type OnboardingDraft } from '@/components/onboarding/types';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

type SettingsSurfaceProps = {
  onEditingProfileChange?: (isEditing: boolean) => void;
};

export function SettingsSurface({ onEditingProfileChange }: SettingsSurfaceProps) {
  const { data: session } = authClient.useSession();
  const { preference, setPreference, theme } = useReedTheme();
  const glassControls = getGlassControlTokens(theme);
  const viewerProfile = useQuery(api.profiles.viewer, {});
  const onboardingEditorData = useQuery(api.profiles.viewerTrainingProfile, {});
  const completeOnboarding = useMutation(api.profiles.completeOnboarding);
  const updateTrainingProfile = useMutation(api.profiles.updateTrainingProfile);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const editDraft = useMemo(() => {
    if (onboardingEditorData) {
      return draftFromTrainingProfile(onboardingEditorData, viewerProfile?.displayName ?? '');
    }

    if (onboardingEditorData === null) {
      return {
        ...EMPTY_DRAFT,
        displayName: viewerProfile?.displayName ?? session?.user.name ?? '',
        profilingConsent: true,
      };
    }

    return null;
  }, [onboardingEditorData, session?.user.name, viewerProfile?.displayName]);
  const [deletePassword, setDeletePassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  async function runAction(action: () => Promise<void>) {
    setIsWorking(true);
    setErrorMessage(null);

    try {
      await action();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSignOut() {
    await runAction(async () => {
      const result = await authClient.signOut();

      if (result.error) {
        throw result.error;
      }
    });
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently removes your auth account and app profile. This cannot be undone.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          style: 'destructive',
          text: 'Delete',
          onPress: () => {
            void handleDeleteAccount();
          },
        },
      ],
    );
  }

  async function handleDeleteAccount() {
    await runAction(async () => {
      const result = await authClient.deleteUser({
        password: deletePassword.trim() || undefined,
      });

      if (result.error) {
        throw result.error;
      }
    });
  }

  const themeOptions = [
    {
      accessibilityLabel: 'Use system theme',
      label: 'System',
      icon: (
        <Ionicons
          color={String(preference === 'system' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name="phone-portrait-outline"
          size={18}
        />
      ),
      value: 'system' as const,
    },
    {
      accessibilityLabel: 'Use light theme',
      label: 'Light',
      icon: (
        <Ionicons
          color={String(preference === 'light' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name="sunny-outline"
          size={18}
        />
      ),
      value: 'light' as const,
    },
    {
      accessibilityLabel: 'Use dark theme',
      label: 'Dark',
      icon: (
        <Ionicons
          color={String(preference === 'dark' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name="moon-outline"
          size={18}
        />
      ),
      value: 'dark' as const,
    },
  ];

  if (isEditingProfile) {
    if (onboardingEditorData === undefined || !editDraft) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator color={String(theme.colors.accentPrimary)} />
          <ReedText tone="muted">Loading your profile.</ReedText>
        </View>
      );
    }

    return (
      <OnboardingFlow
        cancelLabel="Cancel"
        includeConsent={false}
        initialDraft={editDraft}
        onCancel={() => {
          setIsEditingProfile(false);
          onEditingProfileChange?.(false);
        }}
        onComplete={() => {
          setIsEditingProfile(false);
          onEditingProfileChange?.(false);
        }}
        onDecline={() => {
          setIsEditingProfile(false);
          onEditingProfileChange?.(false);
        }}
        onSaveProfile={async draft => {
          const payload = buildCompleteOnboardingPayload(draft);
          if (onboardingEditorData) {
            await updateTrainingProfile(payload);
          } else {
            await completeOnboarding(payload);
          }
        }}
        reviewContinueLabel="Save changes"
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xl,
          paddingBottom: 132,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBlock}>
        <View style={styles.headerCopy}>
          <ReedText variant="brand">Account</ReedText>
          <ReedText variant="display">Settings</ReedText>
        </View>
      </View>

      <GlassSurface>
        <View style={styles.sectionHeader}>
          <Ionicons color={String(theme.colors.textMuted)} name="color-palette-outline" size={18} />
          <ReedText variant="bodyStrong">Appearance</ReedText>
        </View>
        <ReedText tone="muted">Choose how Reed looks across your device.</ReedText>
        <SegmentedControl
          onChange={value => setPreference(value)}
          options={themeOptions}
          value={preference}
        />
      </GlassSurface>

      <GlassSurface>
        <View style={styles.sectionHeader}>
          <Ionicons color={String(theme.colors.textMuted)} name="accessibility-outline" size={18} />
          <ReedText variant="bodyStrong">Training profile</ReedText>
        </View>
        <ReedText tone="muted">
          Update the assumptions Reed uses for recommendations, substitutions, and future coaching context.
        </ReedText>
        <ReedButton
          disabled={onboardingEditorData === undefined}
          label={onboardingEditorData ? 'Edit training profile' : 'Create training profile'}
          onPress={() => {
            setIsEditingProfile(true);
            onEditingProfileChange?.(true);
          }}
          variant="secondary"
        />
      </GlassSurface>

      <GlassSurface>
        <View style={styles.sectionHeader}>
          <Ionicons color={String(theme.colors.textMuted)} name="person-outline" size={18} />
          <ReedText variant="bodyStrong">Account</ReedText>
        </View>
        <View
          style={[
            styles.accountEmailShell,
            {
              backgroundColor: glassControls.shellBackgroundColor,
              borderColor: glassControls.shellBorderColor,
            },
          ]}
        >
          <ReedText tone="muted" variant="caption">
            Signed in as
          </ReedText>
          <ReedText variant="bodyStrong">{session?.user.email ?? 'Signed in'}</ReedText>
        </View>
        <FeedbackBlock errorMessage={errorMessage} />
        <ReedButton disabled={isWorking} label="Sign out" onPress={handleSignOut} />
      </GlassSurface>

      <GlassSurface tone="danger">
        <View style={styles.sectionHeader}>
          <Ionicons color={String(theme.colors.dangerText)} name="trash-outline" size={18} />
          <ReedText tone="danger" variant="bodyStrong">
            Delete account
          </ReedText>
        </View>
        <ReedText tone="muted">
          Email/password accounts should provide the current password. Social accounts may need a
          fresh sign-in before deletion works.
        </ReedText>
        <ReedInput
          autoCapitalize="none"
          autoCorrect={false}
          label="Current password"
          onChangeText={setDeletePassword}
          placeholder="Required for email/password accounts"
          secureTextEntry
          value={deletePassword}
        />
        <ReedButton disabled={isWorking} label="Delete account" onPress={confirmDeleteAccount} variant="danger" />
      </GlassSurface>
    </ScrollView>
  );
}

type StoredTrainingProfile = {
  latestBodyMetrics: Array<{ metricKey: string; value: number }>;
  latestCardioBenchmarks: Array<{ anchorKey: string; distanceMeters?: number | null; durationSeconds?: number | null; floors?: number | null }>;
  latestStrengthBenchmarks: Array<{ anchorKey: string; loadKg?: number | null; reps: number }>;
  trainingProfile: {
    baseline: {
      birthDay: number;
      birthMonth: number;
      birthYear: number;
      heightCm: number;
      recoveryQuality: OnboardingDraft['recoveryQuality'];
    };
    constraints: {
      areas: OnboardingDraft['constraintAreas'];
      details: OnboardingDraft['constraintDetails'];
    };
    goalDetails: OnboardingDraft['goalDetails'];
    rankedGoals: OnboardingDraft['rankedGoals'];
    userNotes?: string | null;
    trainingReality: {
      effort: OnboardingDraft['effort'];
      equipmentAccess: OnboardingDraft['equipmentAccess'];
      sessionDuration: OnboardingDraft['sessionDuration'];
      trainingAge: OnboardingDraft['trainingAge'];
      trainingStyles: OnboardingDraft['trainingStyles'];
      weeklySessions: OnboardingDraft['weeklySessions'];
    };
  };
};

function draftFromTrainingProfile(data: StoredTrainingProfile, displayName: string): OnboardingDraft {
  const currentBodyMetrics = new Map(data.latestBodyMetrics.map(metric => [metric.metricKey, metric.value]));
  const currentStrengthBenchmarks = new Map(data.latestStrengthBenchmarks.map(metric => [metric.anchorKey, metric]));
  const currentCardioBenchmarks = new Map(data.latestCardioBenchmarks.map(metric => [metric.anchorKey, metric]));

  return {
    ...EMPTY_DRAFT,
    birthDay: data.trainingProfile.baseline.birthDay,
    birthMonth: data.trainingProfile.baseline.birthMonth,
    birthYear: data.trainingProfile.baseline.birthYear,
    bodyFatPercent: formatOptionalInput(currentBodyMetrics.get('body_fat_percent') ?? null),
    constraintAreas: data.trainingProfile.constraints.areas,
    constraintDetails: data.trainingProfile.constraints.details,
    displayName,
    effort: data.trainingProfile.trainingReality.effort,
    equipmentAccess: data.trainingProfile.trainingReality.equipmentAccess,
    goalDetails: data.trainingProfile.goalDetails,
    heightCm: formatRequiredInput(data.trainingProfile.baseline.heightCm),
    profilingConsent: true,
    rankedGoals: data.trainingProfile.rankedGoals,
    recoveryQuality: data.trainingProfile.baseline.recoveryQuality,
    userNotes: data.trainingProfile.userNotes ?? '',
    restingHeartRate: formatOptionalInput(currentBodyMetrics.get('resting_heart_rate') ?? null),
    sessionDuration: data.trainingProfile.trainingReality.sessionDuration,
    skeletalMuscleMassKg: formatOptionalInput(currentBodyMetrics.get('skeletal_muscle_mass') ?? null),
    trainingAge: data.trainingProfile.trainingReality.trainingAge,
    trainingStyles: data.trainingProfile.trainingReality.trainingStyles,
    weeklySessions: data.trainingProfile.trainingReality.weeklySessions,
    weightKg: formatOptionalInput(currentBodyMetrics.get('body_weight') ?? null),
    loadedStrengthAnchors: {
      squat: strengthAnchorInput(currentStrengthBenchmarks.get('squat')),
      bench_press: strengthAnchorInput(currentStrengthBenchmarks.get('bench_press')),
      deadlift: strengthAnchorInput(currentStrengthBenchmarks.get('deadlift')),
      overhead_press: strengthAnchorInput(currentStrengthBenchmarks.get('overhead_press')),
    },
    bodyweightStrengthAnchors: {
      pull_up: formatOptionalInput(currentStrengthBenchmarks.get('pull_up')?.reps ?? null),
      push_up: formatOptionalInput(currentStrengthBenchmarks.get('push_up')?.reps ?? null),
      dip: formatOptionalInput(currentStrengthBenchmarks.get('dip')?.reps ?? null),
    },
    cardioAnchor: {
      floors: formatOptionalInput(currentCardioBenchmarks.get('stair_test')?.floors ?? null),
      minutes: formatCardioMinutes(currentCardioBenchmarks.get('stair_test')?.durationSeconds ?? null),
      run1KmTime: formatCardioDuration(currentCardioBenchmarks.get('run_1km')?.durationSeconds ?? null),
      run5KmTime: formatCardioDuration(currentCardioBenchmarks.get('run_5km')?.durationSeconds ?? null),
    },
  };
}

function strengthAnchorInput(value: { loadKg?: number | null; reps: number } | undefined) {
  if (!value || value.loadKg == null) {
    return { loadKg: '', reps: '' };
  }
  return {
    loadKg: formatRequiredInput(value.loadKg),
    reps: formatRequiredInput(value.reps),
  };
}

function formatRequiredInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatCardioDuration(value: number | null) {
  if (value === null) {
    return '';
  }
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatCardioMinutes(value: number | null) {
  if (value === null) {
    return '';
  }
  const minutes = value / 60;
  return formatRequiredInput(minutes);
}

function formatOptionalInput(value: number | null) {
  if (value === null) {
    return '';
  }
  return formatRequiredInput(value);
}

function FeedbackBlock({
  errorMessage,
}: {
  errorMessage: string | null;
}) {
  if (!errorMessage) {
    return null;
  }

  return (
    <View style={styles.feedbackBlock}>
      {errorMessage ? <ReedText tone="danger">{errorMessage}</ReedText> : null}
    </View>
  );
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      code?: string;
      message?: string;
      status?: number;
      statusText?: string;
    };

    if (maybeError.code === 'SESSION_EXPIRED') {
      return 'This action needs a fresh login. Sign in again, then retry.';
    }

    if (maybeError.message) {
      return maybeError.message;
    }

    if (maybeError.statusText) {
      return maybeError.statusText;
    }
  }

  return 'Something went wrong while talking to auth.';
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  loadingState: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  headerBlock: {
    gap: 8,
  },
  headerCopy: {
    gap: 4,
  },
  feedbackBlock: {
    gap: 6,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  accountEmailShell: {
    borderRadius: reedRadii.md,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});

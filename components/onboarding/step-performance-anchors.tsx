import { StyleSheet, View } from 'react-native';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { OnboardingShell } from './onboarding-shell';
import type {
  BodyweightStrengthAnchorKey,
  CardioAnchorInput,
  LoadedStrengthAnchorInput,
  LoadedStrengthAnchorKey,
  OnboardingDraft,
} from './types';

const LOADED_ANCHORS: { key: LoadedStrengthAnchorKey; label: string }[] = [
  { key: 'squat', label: 'Squat' },
  { key: 'bench_press', label: 'Bench press' },
  { key: 'deadlift', label: 'Deadlift' },
  { key: 'overhead_press', label: 'Overhead press' },
];

const BODYWEIGHT_ANCHORS: { key: BodyweightStrengthAnchorKey; label: string }[] = [
  { key: 'pull_up', label: 'Pull-ups max reps' },
  { key: 'push_up', label: 'Push-ups max reps' },
  { key: 'dip', label: 'Dips max reps' },
];

type StepPerformanceAnchorsProps = {
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

export function StepPerformanceAnchors({
  backPlacement,
  cancelLabel,
  draft,
  onBack,
  onCancel,
  onContinue,
  onUpdateDraft,
  stepCount,
  stepIndex,
}: StepPerformanceAnchorsProps) {
  return (
    <OnboardingShell
      backPlacement={backPlacement}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      onBack={onBack}
      onContinue={onContinue}
      stepCount={stepCount}
      stepIndex={stepIndex}
    >
      <View style={styles.titleBlock}>
        <ReedText variant="title">Give Reed a few anchors.</ReedText>
        <ReedText tone="muted">
          Optional. If you know a few recent numbers, Reed can start closer to your actual level.
        </ReedText>
      </View>

      <View style={styles.section}>
        <ReedText variant="bodyStrong">Recent hard sets</ReedText>
        <ReedText tone="muted" variant="caption">Load and reps. Estimates are fine.</ReedText>
        {LOADED_ANCHORS.map(anchor => {
          const value = draft.loadedStrengthAnchors[anchor.key] ?? { loadKg: '', reps: '' };
          return (
            <View key={anchor.key} style={styles.anchorBlock}>
              <ReedText variant="bodyStrong">{anchor.label}</ReedText>
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <ReedInput
                    keyboardType="decimal-pad"
                    label="kg"
                    onChangeText={text =>
                      patchLoadedAnchor(onUpdateDraft, draft.loadedStrengthAnchors, anchor.key, {
                        ...value,
                        loadKg: text,
                      })
                    }
                    placeholder="100"
                    value={value.loadKg}
                  />
                </View>
                <View style={styles.halfField}>
                  <ReedInput
                    keyboardType="number-pad"
                    label="Reps"
                    onChangeText={text =>
                      patchLoadedAnchor(onUpdateDraft, draft.loadedStrengthAnchors, anchor.key, {
                        ...value,
                        reps: text,
                      })
                    }
                    placeholder="5"
                    value={value.reps}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <ReedText variant="bodyStrong">Bodyweight maxes</ReedText>
        <ReedText tone="muted" variant="caption">Clean reps, not all-time chaos.</ReedText>
        {BODYWEIGHT_ANCHORS.map(anchor => (
          <ReedInput
            key={anchor.key}
            keyboardType="number-pad"
            label={anchor.label}
            onChangeText={text =>
              onUpdateDraft({
                bodyweightStrengthAnchors: {
                  ...draft.bodyweightStrengthAnchors,
                  [anchor.key]: text,
                },
              })
            }
            placeholder="e.g. 12"
            value={draft.bodyweightStrengthAnchors[anchor.key] ?? ''}
          />
        ))}
      </View>

      <View style={styles.section}>
        <ReedText variant="bodyStrong">Cardio anchor</ReedText>
        <ReedText tone="muted" variant="caption">One is enough.</ReedText>
        <View style={styles.row}>
          <View style={styles.halfField}>
            <ReedInput
              label="1 km run time"
              onChangeText={text => patchCardioAnchor(onUpdateDraft, draft.cardioAnchor, { run1KmTime: text })}
              placeholder="mm:ss"
              value={draft.cardioAnchor.run1KmTime}
            />
          </View>
          <View style={styles.halfField}>
            <ReedInput
              label="5 km run time"
              onChangeText={text => patchCardioAnchor(onUpdateDraft, draft.cardioAnchor, { run5KmTime: text })}
              placeholder="mm:ss"
              value={draft.cardioAnchor.run5KmTime}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.halfField}>
            <ReedInput
              keyboardType="number-pad"
              label="Stair test floors"
              onChangeText={text => patchCardioAnchor(onUpdateDraft, draft.cardioAnchor, { floors: text })}
              placeholder="40"
              value={draft.cardioAnchor.floors}
            />
          </View>
          <View style={styles.halfField}>
            <ReedInput
              label="Stair test minutes"
              onChangeText={text => patchCardioAnchor(onUpdateDraft, draft.cardioAnchor, { minutes: text })}
              placeholder="15"
              value={draft.cardioAnchor.minutes}
            />
          </View>
        </View>
        <ReedText tone="muted" variant="caption">
          No problem if you skip this. Reed can calibrate from workouts too.
        </ReedText>
      </View>
    </OnboardingShell>
  );
}

function patchLoadedAnchor(
  onUpdateDraft: (patch: Partial<OnboardingDraft>) => void,
  anchors: OnboardingDraft['loadedStrengthAnchors'],
  key: LoadedStrengthAnchorKey,
  value: LoadedStrengthAnchorInput,
) {
  onUpdateDraft({
    loadedStrengthAnchors: {
      ...anchors,
      [key]: value,
    },
  });
}

function patchCardioAnchor(
  onUpdateDraft: (patch: Partial<OnboardingDraft>) => void,
  current: CardioAnchorInput,
  patch: Partial<CardioAnchorInput>,
) {
  onUpdateDraft({ cardioAnchor: { ...current, ...patch } });
}

const styles = StyleSheet.create({
  titleBlock: {
    gap: 10,
  },
  section: {
    gap: 12,
  },
  anchorBlock: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
});

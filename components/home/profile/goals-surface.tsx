import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetFlatList, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, usePaginatedQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedIconButton } from '@/components/ui/reed-icon-button';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedSheet } from '@/components/ui/reed-sheet';
import { ReedSheetTextInput } from '@/components/ui/reed-sheet-input';
import { ReedText } from '@/components/ui/reed-text';
import { bareInputStyle, blurActiveElementOnWeb } from '@/components/ui/focus';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';
import { getTapScaleStyle } from '@/design/motion';
import { useUserOperation } from '@/lib/use-user-operation';

// One height for the form and the exercise picker, so choosing an exercise never resizes the sheet.
const SHEET_FRACTION = 0.9;

type MetricKind =
  | 'exerciseMaxLoadKg'
  | 'exerciseTotalReps'
  | 'exerciseBestHoldSeconds'
  | 'exerciseTotalDurationSeconds'
  | 'cardioDistanceMeters'
  | 'cardioDurationSeconds'
  | 'trainingDays';
type Cadence = 'once' | 'daily' | 'weekly' | 'total';

type ExerciseItem = {
  _id: Id<'exerciseCatalog'>;
  name: string;
  recipeKey: string | null;
};

const metricOptions: Array<{ kind: MetricKind; label: string; unit: string; requiresExercise: boolean }> = [
  { kind: 'exerciseMaxLoadKg', label: 'Load', unit: 'kg', requiresExercise: true },
  { kind: 'exerciseTotalReps', label: 'Reps', unit: 'reps', requiresExercise: true },
  { kind: 'exerciseBestHoldSeconds', label: 'Hold', unit: 'sec', requiresExercise: true },
  { kind: 'exerciseTotalDurationSeconds', label: 'Exercise time', unit: 'sec', requiresExercise: true },
  { kind: 'cardioDistanceMeters', label: 'Distance', unit: 'm', requiresExercise: true },
  { kind: 'cardioDurationSeconds', label: 'Cardio time', unit: 'sec', requiresExercise: true },
  { kind: 'trainingDays', label: 'Training days', unit: 'days', requiresExercise: false },
];

export function CreateGoalSheet({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  const { theme } = useReedTheme();
  const createTarget = useMutation(api.trainingTargets.create);
  const insets = useSafeAreaInsets();
  const submission = useUserOperation('goal.create', 'Could not save your goal. Check your connection and try again.');
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const [exerciseSearchText, setExerciseSearchText] = useState('');
  const [committedExerciseSearchText, setCommittedExerciseSearchText] = useState('');
  const search = usePaginatedQuery(
    api.exerciseCatalog.searchForPicker,
    visible && isExercisePickerOpen
      ? {
          query: committedExerciseSearchText || undefined,
        }
      : 'skip',
    { initialNumItems: 40 },
  );
  const exercises = useMemo(() => dedupeExercises(search.results as ExerciseItem[]), [search.results]);
  const { loadMore } = search;
  const lastSettledResultCountRef = useRef(0);
  useEffect(() => {
    lastSettledResultCountRef.current = 0;
  }, [committedExerciseSearchText]);
  useEffect(() => {
    if (search.status !== 'CanLoadMore') return;
    if (search.results.length === lastSettledResultCountRef.current) {
      loadMore(40);
      return;
    }
    lastSettledResultCountRef.current = search.results.length;
  }, [loadMore, search.results.length, search.status]);
  const [metricKind, setMetricKind] = useState<MetricKind>('exerciseTotalReps');
  const [cadence, setCadence] = useState<Cadence>('once');
  const [exerciseId, setExerciseId] = useState<Id<'exerciseCatalog'> | null>(null);
  const [selectedExerciseName, setSelectedExerciseName] = useState<string | null>(null);
  const [threshold, setThreshold] = useState('10');
  const [periodCount, setPeriodCount] = useState('7');
  const [days, setDays] = useState('30');
  const [notes, setNotes] = useState('');
  const metric = metricOptions.find((option) => option.kind === metricKind) ?? metricOptions[1];
  const preview = buildPreview({
    cadence,
    days,
    exerciseName: selectedExerciseName ?? undefined,
    metric,
    periodCount,
    threshold,
  });
  const isPeriodicGoal = cadence === 'daily' || cadence === 'weekly';
  const canSave =
    Number.isFinite(Number(threshold)) &&
    Number(threshold) > 0 &&
    Number.isFinite(Number(isPeriodicGoal ? periodCount : days)) &&
    (isPeriodicGoal ? Number(periodCount) >= 1 : Number(days) >= 1) &&
    (!metric.requiresExercise || exerciseId);

  useEffect(() => {
    if (!visible || !isExercisePickerOpen) {
      return;
    }
    const timeout = setTimeout(() => setCommittedExerciseSearchText(exerciseSearchText.trim()), 180);
    return () => clearTimeout(timeout);
  }, [exerciseSearchText, isExercisePickerOpen, visible]);

  async function save() {
    if (!canSave || submission.isWorking) return;
    await submission.run(async () => {
      const now = Date.now();
      const durationDays = Math.max(1, Math.round(Number(days)));
      const periods = Math.max(1, Math.round(Number(periodCount)));
      const effectiveDurationDays = isPeriodicGoal ? periods * (cadence === 'weekly' ? 7 : 1) : durationDays;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await createTarget({
        endsAt: now + effectiveDurationDays * 24 * 60 * 60 * 1000,
        notes: notes.trim() || undefined,
        previewText: preview,
        rule: {
          cadence,
          exerciseCatalogId: metric.requiresExercise ? exerciseId : null,
          metricKind,
          periodCount: cadence === 'daily' || cadence === 'weekly' ? periods : undefined,
          threshold: Number(threshold),
          thresholdUnit: metric.unit,
        },
        timeZone,
        title: preview,
      });
      closeSheet();
    });
  }

  function closeSheet() {
    blurActiveElementOnWeb();
    onClose();
  }

  function openExercisePicker() {
    blurActiveElementOnWeb();
    setIsExercisePickerOpen(true);
  }

  function closeExercisePicker() {
    blurActiveElementOnWeb();
    setIsExercisePickerOpen(false);
  }

  function selectExercise(id: Id<'exerciseCatalog'>) {
    blurActiveElementOnWeb();
    setExerciseId(id);
    setSelectedExerciseName(exercises.find((exercise) => exercise._id === id)?.name ?? null);
    setIsExercisePickerOpen(false);
  }

  const gutter = theme.spacing.gutter;

  return (
    <ReedSheet
      heightFraction={SHEET_FRACTION}
      onBack={isExercisePickerOpen ? closeExercisePicker : undefined}
      onDismiss={() => {
        setIsExercisePickerOpen(false);
        onClose();
      }}
      open={visible}
    >
      <View style={styles.sheet}>
        {isExercisePickerOpen ? (
          <>
            <View style={[styles.sheetHeader, { paddingHorizontal: gutter }]}>
              <ReedIconButton accessibilityLabel="Back to goal" onPress={closeExercisePicker} variant="ghost">
                <Ionicons color={String(theme.colors.inkSecondary)} name="chevron-back" size={22} />
              </ReedIconButton>
              <View style={styles.headerCopy}>
                <ReedText variant="headline">Choose exercise</ReedText>
                <ReedText tone="muted" variant="caption">Any supported catalogue exercise.</ReedText>
              </View>
            </View>

            <View style={{ paddingHorizontal: gutter }}>
              <View style={[styles.searchShell, { backgroundColor: theme.colors.surfaceRaised }]}>
                <Ionicons color={String(theme.colors.inkMuted)} name="search" size={16} />
                <ReedSheetTextInput
                  accessibilityLabel="Search exercises"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setExerciseSearchText}
                  placeholder="Search exercises"
                  placeholderTextColor={String(theme.colors.inkMuted)}
                  selectionColor={String(theme.colors.accent)}
                  style={[styles.searchInput, bareInputStyle, { color: theme.colors.ink, fontFamily: theme.typography.body.fontFamily }]}
                  value={exerciseSearchText}
                />
              </View>
            </View>

            <BottomSheetFlatList
              contentContainerStyle={StyleSheet.flatten([styles.pickerContent, { paddingBottom: insets.bottom + theme.spacing.md, paddingHorizontal: gutter }])}
              data={exercises}
              initialNumToRender={12}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(exercise: ExerciseItem) => exercise._id}
              ListEmptyComponent={<ReedText tone="muted" variant="caption">No exercises found.</ReedText>}
              maxToRenderPerBatch={8}
              onEndReached={search.status === 'CanLoadMore' ? () => loadMore(40) : undefined}
              onEndReachedThreshold={0.6}
              renderItem={({ item: exercise }: { item: ExerciseItem }) => {
                const selected = exercise._id === exerciseId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => selectExercise(exercise._id)}
                    style={({ pressed }) => [styles.exerciseResultRow, { borderBottomColor: theme.colors.line }, getTapScaleStyle(pressed)]}
                  >
                    <ReedText numberOfLines={1} style={styles.exercisePickerCopy} variant="bodyStrong">{exercise.name}</ReedText>
                    {selected ? <Ionicons color={String(theme.colors.accentInk)} name="checkmark-circle" size={22} /> : null}
                  </Pressable>
                );
              }}
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
              windowSize={7}
            />
          </>
        ) : (
          <>
            <View style={[styles.sheetHeader, { paddingHorizontal: gutter }]}>
              <View style={styles.headerCopy}>
                <ReedText variant="title">New goal</ReedText>
                <ReedText tone="muted" variant="caption">Structured, measurable, time-bound.</ReedText>
              </View>
              <ReedIconButton accessibilityLabel="Close goal creator" onPress={closeSheet} variant="ghost">
                <Ionicons color={String(theme.colors.inkSecondary)} name="close" size={22} />
              </ReedIconButton>
            </View>
            <BottomSheetScrollView
              contentContainerStyle={StyleSheet.flatten([styles.creatorStack, { paddingHorizontal: gutter }])}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
            >
              <ReedText variant="bodyStrong">Measure</ReedText>
              <View style={styles.optionWrap}>
                {metricOptions.map((option) => (
                  <Choice
                    key={option.kind}
                    active={metricKind === option.kind}
                    label={option.label}
                    onPress={() => {
                      setMetricKind(option.kind);
                      if (!option.requiresExercise) {
                        setExerciseId(null);
                        setSelectedExerciseName(null);
                      }
                    }}
                  />
                ))}
              </View>
              {metric.requiresExercise ? (
                <>
                  <ReedText variant="bodyStrong">Exercise</ReedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={openExercisePicker}
                    style={({ pressed }) => [styles.exercisePickerButton, { backgroundColor: theme.colors.surfaceRaised }, getTapScaleStyle(pressed)]}
                  >
                    <View style={styles.exercisePickerCopy}>
                      <ReedText variant="bodyStrong">{selectedExerciseName ?? 'Choose exercise'}</ReedText>
                      <ReedText tone="muted" variant="caption">Search the full catalogue</ReedText>
                    </View>
                    <Ionicons color={String(theme.colors.inkMuted)} name="chevron-forward" size={18} />
                  </Pressable>
                </>
              ) : null}
              <ReedInput
                keyboardType="numeric"
                label={`Target (${metric.unit})`}
                onChangeText={setThreshold}
                value={threshold}
              />
              <ReedText variant="bodyStrong">Time rule</ReedText>
              <View style={styles.optionWrap}>
                {(['once', 'total', 'daily', 'weekly'] as Cadence[]).map((item) => (
                  <Choice key={item} active={cadence === item} label={cadenceLabel(item)} onPress={() => setCadence(item)} />
                ))}
              </View>
              {cadence === 'daily' || cadence === 'weekly' ? (
                <ReedInput
                  keyboardType="numeric"
                  label={cadence === 'daily' ? 'Days' : 'Weeks'}
                  onChangeText={setPeriodCount}
                  value={periodCount}
                />
              ) : null}
              {!isPeriodicGoal ? (
                <ReedInput
                  keyboardType="numeric"
                  label="Deadline window, days from today"
                  onChangeText={setDays}
                  value={days}
                />
              ) : null}
              <ReedInput
                blurOnSubmit
                label="Notes (optional)"
                multiline
                onChangeText={setNotes}
                placeholder="Add context, constraints, or why this matters."
                returnKeyType="done"
                scrollEnabled={false}
                style={styles.notesInput}
                textAlignVertical="top"
                value={notes}
              />
              <View style={[styles.preview, { backgroundColor: theme.colors.surfaceRaised }]}>
                <ReedText tone="muted" variant="caption">Preview</ReedText>
                <ReedText variant="bodyStrong">{preview}</ReedText>
              </View>
            </BottomSheetScrollView>
            <View style={[styles.sheetFooter, { paddingBottom: insets.bottom + theme.spacing.md, paddingHorizontal: gutter }]}>
              {submission.errorMessage ? (
                <ReedText accessibilityLiveRegion="polite" tone="danger" variant="caption">{submission.errorMessage}</ReedText>
              ) : null}
              <ReedButton
                disabled={!canSave || submission.isWorking}
                label={submission.isWorking ? 'Saving…' : 'Save goal'}
                onPress={save}
              />
            </View>
          </>
        )}
      </View>
    </ReedSheet>
  );
}

function dedupeExercises(exercises: ExerciseItem[]) {
  const seen = new Set<string>();
  return exercises.filter((exercise) => {
    if (seen.has(exercise._id)) return false;
    seen.add(exercise._id);
    return true;
  });
}

function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { theme } = useReedTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: active ? theme.colors.accentSoft : theme.colors.surfaceRaised },
        getTapScaleStyle(pressed),
      ]}
    >
      <ReedText ellipsizeMode="tail" numberOfLines={1} style={styles.choiceLabel} tone={active ? 'accent' : 'secondary'} variant="bodyStrong">
        {label}
      </ReedText>
    </Pressable>
  );
}

function buildPreview({
  cadence,
  days,
  exerciseName,
  metric,
  periodCount,
  threshold,
}: {
  cadence: Cadence;
  days: string;
  exerciseName?: string;
  metric: { kind: MetricKind; label: string; unit: string; requiresExercise: boolean };
  periodCount: string;
  threshold: string;
}) {
  const subject = metric.requiresExercise ? (exerciseName ?? 'Selected exercise') : 'Train';
  const amount = `${threshold || '0'} ${metric.unit}`;
  if (cadence === 'daily') return `${subject}: ${amount} every day for ${periodCount || '0'} days.`;
  if (cadence === 'weekly') return `${subject}: ${amount} each week for ${periodCount || '0'} weeks.`;
  if (cadence === 'total') return `${subject}: ${amount} total in ${days || '0'} days.`;
  return `${subject}: reach ${amount} by ${days || '0'} days from now.`;
}
function cadenceLabel(cadence: Cadence) {
  return cadence === 'once' ? 'By date' : cadence === 'total' ? 'Total' : cadence === 'daily' ? 'Daily' : 'Weekly';
}

const styles = StyleSheet.create({
  sheet: { flex: 1, gap: 12, minHeight: 0 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  headerCopy: { flex: 1, gap: 2, paddingTop: 4 },
  scroll: { flex: 1, minHeight: 0 },
  choice: {
    alignItems: 'center',
    borderRadius: reedRadii.pill,
    justifyContent: 'center',
    maxWidth: '100%',
    minHeight: 40,
    minWidth: 0,
    paddingHorizontal: 16,
  },
  choiceLabel: { maxWidth: '100%', minWidth: 0, textAlign: 'center' },
  creatorStack: { gap: 14, paddingBottom: 16, paddingTop: 4 },
  exercisePickerButton: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  exercisePickerCopy: { flex: 1, gap: 2 },
  exerciseResultRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: 12,
  },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notesInput: { minHeight: 104, paddingTop: 14 },
  pickerContent: { paddingTop: 4 },
  preview: { borderRadius: reedRadii.md, gap: 4, padding: 16 },
  sheetFooter: { gap: 8, paddingTop: 8 },
  searchInput: { flex: 1, fontSize: 15.5, minHeight: 48, padding: 0 },
  searchShell: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
  },
});

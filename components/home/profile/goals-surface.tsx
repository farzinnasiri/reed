import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedInput } from '@/components/ui/reed-input';
import { ReedText } from '@/components/ui/reed-text';
import { getGlassControlTokens } from '@/components/ui/glass-material';
import { useReedTheme } from '@/design/provider';
import { getTapScaleStyle } from '@/design/motion';

type MetricKind = 'exerciseMaxLoadKg' | 'exerciseTotalReps' | 'exerciseBestHoldSeconds' | 'exerciseTotalDurationSeconds' | 'cardioDistanceMeters' | 'cardioDurationSeconds' | 'sessionCount';
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
  { kind: 'sessionCount', label: 'Training days', unit: 'sessions', requiresExercise: false },
];

export function GoalsSurface() {
  const targets = useQuery(api.trainingTargets.list, { includeArchived: false });
  const completeManually = useMutation(api.trainingTargets.completeManually);
  const archive = useMutation(api.trainingTargets.archive);
  const [isCreating, setIsCreating] = useState(false);
  const active = targets?.filter(target => target.status === 'active') ?? [];
  const finished = targets?.filter(target => target.status !== 'active') ?? [];

  return (
    <View style={styles.stack}>
      <View style={styles.headerRow}>
        <View>
          <ReedText variant="bodyStrong">Concrete goals</ReedText>
          <ReedText tone="muted" variant="caption">Measured from your logs.</ReedText>
        </View>
        <ReedButton label="New goal" onPress={() => setIsCreating(true)} />
      </View>

      {targets === undefined ? (
        <View style={styles.loadingRow}><ActivityIndicator /><ReedText tone="muted">Loading goals.</ReedText></View>
      ) : targets.length === 0 ? (
        <EmptyGoals onCreate={() => setIsCreating(true)} />
      ) : (
        <View style={styles.stack}>
          {active.map(target => (
            <GoalRow
              key={target._id}
              onArchive={() => archive({ targetId: target._id })}
              onComplete={() => completeManually({ targetId: target._id })}
              target={target}
            />
          ))}
          {finished.length > 0 ? <ReedText tone="muted" variant="caption">Completed / missed</ReedText> : null}
          {finished.slice(0, 4).map(target => (
            <GoalRow key={target._id} onArchive={() => archive({ targetId: target._id })} target={target} />
          ))}
        </View>
      )}

      <CreateGoalSheet visible={isCreating} onClose={() => setIsCreating(false)} />
    </View>
  );
}

function EmptyGoals({ onCreate }: { onCreate: () => void }) {
  const { theme } = useReedTheme();
  return (
    <View style={[styles.emptyState, { borderColor: theme.colors.controlBorder }]}> 
      <ReedText variant="bodyStrong">No concrete goals yet</ReedText>
      <ReedText tone="muted" variant="caption">Create a measurable target with a deadline. Reed will track it from sessions and quick logs.</ReedText>
      <ReedButton label="Create first goal" onPress={onCreate} />
    </View>
  );
}

function GoalRow({ onArchive, onComplete, target }: { onArchive: () => void; onComplete?: () => void; target: NonNullable<ReturnType<typeof useQuery<typeof api.trainingTargets.list>>>[number] }) {
  const { theme } = useReedTheme();
  const progress = target.progressSummary;
  const percent = progress.required > 0 ? Math.min(1, progress.current / progress.required) : 0;
  return (
    <View style={[styles.goalRow, { borderColor: theme.colors.controlBorder }]}> 
      <View style={styles.goalTopLine}>
        <ReedText variant="bodyStrong" style={styles.goalTitle}>{target.title}</ReedText>
        <StatusPill status={target.status} />
      </View>
      <ReedText tone="muted" variant="caption">{target.previewText}</ReedText>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { backgroundColor: theme.colors.accentPrimary, width: `${percent * 100}%` }]} /></View>
      <View style={styles.goalMetaRow}>
        <ReedText variant="caption">{progress.currentLabel}</ReedText>
        <ReedText tone="muted" variant="caption">Due {formatDate(target.endsAt)}</ReedText>
      </View>
      {progress.totalPeriods ? <ReedText tone="muted" variant="caption">{progress.satisfiedPeriods ?? 0}/{progress.totalPeriods} periods complete</ReedText> : null}
      <View style={styles.goalActions}>
        {target.status === 'active' && onComplete ? <TextButton label="Mark complete" onPress={onComplete} /> : null}
        {target.status !== 'archived' ? <TextButton label="Archive" onPress={onArchive} /> : null}
        {target.completionSource ? <ReedText tone="muted" variant="caption">{target.completionSource === 'verified' ? 'Completed from logs' : 'Marked complete'}</ReedText> : null}
      </View>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const { theme } = useReedTheme();
  return <View style={[styles.statusPill, { borderColor: theme.colors.controlBorder }]}><ReedText tone={status === 'missed' ? 'danger' : 'muted'} variant="caption">{status}</ReedText></View>;
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useReedTheme();
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.textButton, getTapScaleStyle(pressed)]}><ReedText style={{ color: theme.colors.accentPrimary }} variant="caption">{label}</ReedText></Pressable>;
}

export function CreateGoalSheet({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  const { theme } = useReedTheme();
  const controls = getGlassControlTokens(theme);
  const createTarget = useMutation(api.trainingTargets.create);
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const [exerciseSearchText, setExerciseSearchText] = useState('');
  const search = useQuery(api.exerciseCatalog.searchForAddSheet, {
    equipment: null,
    muscleGroups: null,
    query: exerciseSearchText.trim() || undefined,
  });
  const exercises = useMemo(() => dedupeExercises([...(search?.favorites ?? []), ...(search?.recents ?? []), ...(search?.results ?? [])] as ExerciseItem[]), [search]);
  const [metricKind, setMetricKind] = useState<MetricKind>('exerciseTotalReps');
  const [cadence, setCadence] = useState<Cadence>('once');
  const [exerciseId, setExerciseId] = useState<Id<'exerciseCatalog'> | null>(null);
  const [threshold, setThreshold] = useState('10');
  const [periodCount, setPeriodCount] = useState('7');
  const [days, setDays] = useState('30');
  const [notes, setNotes] = useState('');
  const metric = metricOptions.find(option => option.kind === metricKind) ?? metricOptions[1];
  const selectedExercise = exercises.find(exercise => exercise._id === exerciseId) ?? null;
  const preview = buildPreview({ cadence, days, exerciseName: selectedExercise?.name, metric, periodCount, threshold });
  const canSave = Number(threshold) > 0 && Number(days) > 0 && (!metric.requiresExercise || exerciseId);

  async function save() {
    if (!canSave) return;
    const now = Date.now();
    const durationDays = Math.max(1, Math.round(Number(days)));
    const periods = Math.max(1, Math.round(Number(periodCount)));
    await createTarget({
      endsAt: now + durationDays * 24 * 60 * 60 * 1000,
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
      title: preview,
    });
    onClose();
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalBackdrop}
      >
        <GlassSurface elevated={false} style={styles.sheet} contentStyle={styles.sheetContent}>
          <View style={styles.sheetHandleArea}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.colors.handleFill }]} />
          </View>
          <View style={styles.sheetHeader}>
            <View><ReedText variant="title">New goal</ReedText><ReedText tone="muted" variant="caption">Structured, measurable, time-bound.</ReedText></View>
            <Pressable accessibilityLabel="Close goal creator" onPress={onClose}><Ionicons color={String(theme.colors.textPrimary)} name="close" size={24} /></Pressable>
          </View>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.creatorScroll}
            contentContainerStyle={styles.creatorStack}
          >
            <ReedText variant="bodyStrong">Measure</ReedText>
            <View style={styles.optionWrap}>{metricOptions.map(option => <Choice key={option.kind} active={metricKind === option.kind} label={option.label} onPress={() => { setMetricKind(option.kind); if (!option.requiresExercise) setExerciseId(null); }} />)}</View>
            {metric.requiresExercise ? (
              <>
                <ReedText variant="bodyStrong">Exercise</ReedText>
                <Pressable
                  onPress={() => setIsExercisePickerOpen(true)}
                  style={({ pressed }) => [
                    styles.exercisePickerButton,
                    { backgroundColor: controls.shellBackgroundColor, borderColor: controls.shellBorderColor },
                    getTapScaleStyle(pressed),
                  ]}
                >
                  <View style={styles.exercisePickerCopy}>
                    <ReedText variant="bodyStrong">{selectedExercise?.name ?? 'Choose exercise'}</ReedText>
                    <ReedText tone="muted" variant="caption">Search the full catalogue</ReedText>
                  </View>
                  <Ionicons color={String(theme.colors.textMuted)} name="chevron-forward" size={18} />
                </Pressable>
              </>
            ) : null}
            <ReedInput keyboardType="numeric" label={`Target (${metric.unit})`} onChangeText={setThreshold} value={threshold} />
            <ReedText variant="bodyStrong">Time rule</ReedText>
            <View style={styles.optionWrap}>{(['once', 'total', 'daily', 'weekly'] as Cadence[]).map(item => <Choice key={item} active={cadence === item} label={cadenceLabel(item)} onPress={() => setCadence(item)} />)}</View>
            {(cadence === 'daily' || cadence === 'weekly') ? <ReedInput keyboardType="numeric" label={cadence === 'daily' ? 'Days' : 'Weeks'} onChangeText={setPeriodCount} value={periodCount} /> : null}
            <ReedInput keyboardType="numeric" label="Deadline window, days from today" onChangeText={setDays} value={days} />
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
            <View style={[styles.preview, { borderColor: theme.colors.controlBorder }]}><ReedText tone="muted" variant="caption">Preview</ReedText><ReedText variant="bodyStrong">{preview}</ReedText></View>
          </ScrollView>
          <View style={[styles.sheetFooter, { borderTopColor: theme.colors.controlBorder }]}>
            <ReedButton disabled={!canSave} label="Save goal" onPress={save} />
          </View>
          <ExercisePickerModal
            exercises={exercises}
            onClose={() => setIsExercisePickerOpen(false)}
            onSearchChange={setExerciseSearchText}
            onSelect={id => {
              setExerciseId(id);
              setIsExercisePickerOpen(false);
            }}
            searchText={exerciseSearchText}
            selectedExerciseId={exerciseId}
            visible={isExercisePickerOpen}
          />
        </GlassSurface>
      </KeyboardAvoidingView>
    </Modal>
  );
}


function ExercisePickerModal({
  exercises,
  onClose,
  onSearchChange,
  onSelect,
  searchText,
  selectedExerciseId,
  visible,
}: {
  exercises: ExerciseItem[];
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (id: Id<'exerciseCatalog'>) => void;
  searchText: string;
  selectedExerciseId: Id<'exerciseCatalog'> | null;
  visible: boolean;
}) {
  const { theme } = useReedTheme();
  const controls = getGlassControlTokens(theme);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <GlassSurface elevated={false} style={styles.pickerSheet} contentStyle={styles.pickerContent}>
          <View style={styles.sheetHeader}>
            <View>
              <ReedText variant="section">Choose exercise</ReedText>
              <ReedText tone="muted" variant="caption">Any supported catalogue exercise.</ReedText>
            </View>
            <Pressable accessibilityLabel="Close exercise picker" onPress={onClose}>
              <Ionicons color={String(theme.colors.textPrimary)} name="close" size={22} />
            </Pressable>
          </View>

          <View style={[styles.searchShell, { backgroundColor: controls.shellBackgroundColor, borderColor: controls.shellBorderColor }]}>
            <Ionicons color={String(theme.colors.textMuted)} name="search" size={16} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={onSearchChange}
              placeholder="Search exercises"
              placeholderTextColor={String(theme.colors.textMuted)}
              style={[styles.searchInput, { color: theme.colors.textPrimary, fontFamily: theme.typography.body.fontFamily }]}
              value={searchText}
            />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.pickerResults}>
            {exercises.length === 0 ? (
              <ReedText tone="muted" variant="caption">No exercises found.</ReedText>
            ) : exercises.map(exercise => {
              const selected = exercise._id === selectedExerciseId;
              return (
                <Pressable
                  key={exercise._id}
                  onPress={() => onSelect(exercise._id)}
                  style={({ pressed }) => [
                    styles.exerciseResultRow,
                    { borderBottomColor: theme.colors.controlBorder },
                    getTapScaleStyle(pressed),
                  ]}
                >
                  <View style={styles.exercisePickerCopy}>
                    <ReedText numberOfLines={1} variant="bodyStrong">{exercise.name}</ReedText>
                  </View>
                  {selected ? <Ionicons color={String(theme.colors.accentPrimary)} name="checkmark" size={20} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  );
}

function dedupeExercises(exercises: ExerciseItem[]) {
  const seen = new Set<string>();
  return exercises.filter(exercise => {
    if (seen.has(exercise._id)) return false;
    seen.add(exercise._id);
    return true;
  });
}

function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { theme } = useReedTheme();
  const controls = getGlassControlTokens(theme);
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.choice, { backgroundColor: active ? controls.activeBackgroundColor : controls.shellBackgroundColor, borderColor: active ? theme.colors.accentPrimary : controls.shellBorderColor }, getTapScaleStyle(pressed)]}><ReedText variant="caption">{label}</ReedText></Pressable>;
}

function buildPreview({ cadence, days, exerciseName, metric, periodCount, threshold }: { cadence: Cadence; days: string; exerciseName?: string; metric: { kind: MetricKind; label: string; unit: string; requiresExercise: boolean }; periodCount: string; threshold: string }) {
  const subject = metric.requiresExercise ? (exerciseName ?? 'Selected exercise') : 'Train';
  const amount = `${threshold || '0'} ${metric.unit}`;
  if (cadence === 'daily') return `${subject}: ${amount} every day for ${periodCount || '0'} days.`;
  if (cadence === 'weekly') return `${subject}: ${amount} each week for ${periodCount || '0'} weeks.`;
  if (cadence === 'total') return `${subject}: ${amount} total in ${days || '0'} days.`;
  return `${subject}: reach ${amount} by ${days || '0'} days from now.`;
}
function cadenceLabel(cadence: Cadence) { return cadence === 'once' ? 'By date' : cadence === 'total' ? 'Total' : cadence === 'daily' ? 'Daily' : 'Weekly'; }
function formatDate(ts: number) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(ts)); }

const styles = StyleSheet.create({
  choice: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  creatorScroll: { flex: 1, minHeight: 0 },
  creatorStack: { gap: 14, paddingBottom: 96 },
  emptyState: { borderRadius: 18, borderWidth: 1, gap: 10, padding: 16 },
  exercisePickerButton: { alignItems: 'center', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', padding: 14 },
  exercisePickerCopy: { flex: 1, gap: 2 },
  exerciseResultRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', paddingVertical: 13 },
  goalActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  goalMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  goalRow: { borderRadius: 18, borderWidth: 1, gap: 8, padding: 14 },
  goalTitle: { flex: 1 },
  goalTopLine: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  modalBackdrop: { backgroundColor: 'rgba(15, 23, 42, 0.28)', flex: 1, justifyContent: 'flex-end', padding: 12 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notesInput: { minHeight: 104, paddingTop: 14 },
  pickerBackdrop: { backgroundColor: 'rgba(15, 23, 42, 0.38)', flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 48 },
  pickerContent: { gap: 14, padding: 18 },
  pickerResults: { maxHeight: 420 },
  pickerSheet: { alignSelf: 'stretch', borderRadius: 26, maxHeight: '78%' },
  preview: { borderRadius: 18, borderWidth: 1, gap: 4, padding: 14 },
  progressFill: { borderRadius: 999, height: '100%' },
  progressTrack: { backgroundColor: 'rgba(100, 116, 139, 0.18)', borderRadius: 999, height: 6, overflow: 'hidden' },
  sheet: { alignSelf: 'stretch', borderRadius: 28, height: '88%' },
  sheetContent: { flex: 1, gap: 14, minHeight: 0, paddingBottom: 16, paddingHorizontal: 20, paddingTop: 8 },
  sheetFooter: { borderTopWidth: 1, paddingTop: 14 },
  sheetHandle: { borderRadius: 999, height: 4, width: 44 },
  sheetHandleArea: { alignItems: 'center', justifyContent: 'center', paddingBottom: 4, paddingTop: 2 },
  searchInput: { flex: 1, fontSize: 16, minHeight: 38, padding: 0 },
  searchShell: { alignItems: 'center', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 10, paddingHorizontal: 12 },
  sheetHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  stack: { gap: 12 },
  statusPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  textButton: { paddingVertical: 4 },
});

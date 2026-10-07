import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BodyMap } from '@/components/onboarding/pain-map';
import { Field } from '@/components/onboarding/controls';
import { derivePractices, type Draft } from '@/components/onboarding/draft';
import { OnboardingReedContext } from '@/components/onboarding/reed-context';
import { BornStep, HeightStep, WeightStep, SexStep, ShapeStep } from '@/components/onboarding/steps-body';
import { DayStep, PushStep, RhythmStep, SleepStep, WeekStep } from '@/components/onboarding/steps-life';
import { ValuesStep } from '@/components/onboarding/steps-values';
import { WorldStep, WorldsStep } from '@/components/onboarding/steps-world';
import { NotesStep } from '@/components/onboarding/steps-notes';
import { CATEGORY_BY_ID, type CategoryId } from '@/components/onboarding/content';
import { onboardingPayload } from '@/components/onboarding/persistence';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { reedProfileMetrics } from '@/design/system';
import type { ProfileChange } from '@/domains/profile/edits';
import type { ProfileEditorId } from './profile-contract';

const titles = {
  name: 'Your name', born: 'Year of birth', height: 'Height', weight: 'Weight', sex: 'Gender', shape: 'Body reference',
  bodymap: 'Discomfort', values: 'Your priorities', worlds: 'Your practices', week: 'Your week', rhythm: 'Coaching rhythm',
  push: 'How hard to push', sleep: 'Sleep & recovery', day: 'Your day', notes: 'Notes for Reed',
};
export function profileEditorTitle(editor: ProfileEditorId) {
  return editor.startsWith('world:') ? CATEGORY_BY_ID[editor.slice(6) as CategoryId].label : titles[editor as keyof typeof titles];
}

export function profileChangeFromDraft(editor: ProfileEditorId, draft: Draft): ProfileChange {
  const { answers, displayName } = onboardingPayload(draft);
  if (editor.startsWith('world:') || editor === 'worlds') return { field: 'practices', value: answers.practices };
  switch (editor) {
    case 'name': return { field: 'name', value: displayName };
    case 'born': return { field: 'birthYear', value: answers.birthYear };
    case 'height': return { field: 'heightCm', value: answers.heightCm };
    case 'weight': return { field: 'weightKg', value: answers.weightKg };
    case 'sex': return { field: 'sex', value: answers.sex };
    case 'shape': return { field: 'shape', value: answers.shape };
    case 'bodymap': return { field: 'discomfort', value: answers.discomfort };
    case 'values': return { field: 'values', value: answers.values };
    case 'week': return { field: 'days', value: answers.days };
    case 'rhythm': return { field: 'rhythm', value: { rhythm: answers.rhythm, blockWeeks: answers.blockWeeks } };
    case 'push': return { field: 'push', value: answers.push };
    case 'sleep': return { field: 'sleep', value: { sleep: answers.sleep, sleepQuality: answers.sleepQuality } };
    case 'day': return { field: 'dayLoad', value: answers.dayLoad };
    case 'notes': return { field: 'notes', value: answers.notes };
    default: throw new Error('Choose a profile field to edit.');
  }
}

const steps = { born: BornStep, height: HeightStep, weight: WeightStep, sex: SexStep, shape: ShapeStep, values: ValuesStep, worlds: WorldsStep, week: WeekStep, rhythm: RhythmStep, push: PushStep, sleep: SleepStep, day: DayStep, notes: NotesStep };
const noop = () => {};

/** Reuses answer controls, never the onboarding navigator or its completion ceremony. */
export function ProfileEditor({ editor, initialDraft, bodyHeight, onSave, render }: {
  editor: ProfileEditorId;
  initialDraft: Draft;
  bodyHeight: number;
  onSave: (change: ProfileChange) => Promise<void>;
  render: (content: React.ReactNode, footer: React.ReactNode) => React.ReactNode;
}) {
  const { theme } = useReedTheme();
  const [draft, setDraft] = useState(initialDraft);
  const [pending, setPending] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const update = useCallback((patch: Partial<Draft>) => { setDraft(current => ({ ...current, ...patch })); setError(null); }, []);
  const context = useMemo(() => ({ editing: true, stageViewportHeight: bodyHeight, reed: null, setLetterReady: noop, setLetterDelivered: noop, revealAnswer: noop, setListening: noop, say: noop, setAnswerPending: setPending, setBeforeNext: noop }), [bodyHeight]);
  const practices = useMemo(() => derivePractices(draft), [draft]);
  const change = safeChange(editor, draft);
  const changed = (editor === 'bodymap' && !initialDraft.bodyMapDone) || JSON.stringify(profileChangeFromDraft(editor, initialDraft)) !== JSON.stringify(change);
  const valid = change !== null && (editor !== 'name' || !!draft.name.trim()) && (editor !== 'worlds' || draft.categories.length > 0);
  async function save() {
    if (inFlight.current || pending || !valid || !changed) return;
    inFlight.current = true;
    setWorking(true);
    setError(null);
    try { await onSave(profileChangeFromDraft(editor, draft)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save. Try again.'); }
    finally { inFlight.current = false; setWorking(false); }
  }
  const props = { editing: true, draft, update, practices, next: () => { void save(); }, edit: noop };
  const category = editor.startsWith('world:') ? editor.slice(6) as CategoryId : null;
  const Step = steps[editor as keyof typeof steps];
  const content = <View style={{ gap: theme.spacing.lg }}>
    {editor === 'name' ? <Field accessibilityLabel="Your name" maxLength={60} autoCapitalize="words" value={draft.name} onChangeText={name => update({ name })} returnKeyType="done" onSubmitEditing={() => { void save(); }} />
      : editor === 'bodymap' ? <BodyMap availableHeight={bodyHeight} pain={draft.bodyPain} onChange={bodyPain => update({ bodyPain, bodyMapDone: true })} sex={draft.sex} shape={draft.shape} />
        : category ? draft.categories.includes(category) ? <WorldStep {...props} category={category} /> : <ReedText tone="secondary">{CATEGORY_BY_ID[category].label} will be removed from your practices.</ReedText> : <Step {...props} />}
    {category ? <ReedButton label={draft.categories.includes(category) ? `Remove ${CATEGORY_BY_ID[category].label}` : 'Undo removal'} variant="quiet" onPress={() => update({ categories: draft.categories.includes(category) ? draft.categories.filter(id => id !== category) : [...draft.categories, category] })} disabled={draft.categories.length === 1 && draft.categories.includes(category)} /> : null}
    {editor === 'shape' ? <ReedText tone="muted" variant="caption">A visual reference, not a measured body-fat percentage.</ReedText> : null}
  </View>;
  const footer = <View style={{ gap: theme.spacing.xs }}>
    {error ? <ReedText accessibilityLiveRegion="polite" tone="danger" variant="caption">{error}</ReedText> : null}
    <ReedButton label={working ? 'Saving…' : 'Save changes'} disabled={working || pending || !valid || !changed} onPress={() => { void save(); }} />
  </View>;
  return <OnboardingReedContext.Provider value={context}>
    <View style={[styles.fill, { pointerEvents: working ? 'none' : 'auto' }]}>{render(content, footer)}</View>
  </OnboardingReedContext.Provider>;
}
function safeChange(editor: ProfileEditorId, draft: Draft) {
  try { return profileChangeFromDraft(editor, draft); } catch { return null; }
}
const styles = StyleSheet.create({ fill: { flex: 1, width: '100%', maxWidth: reedProfileMetrics.maxWidth, alignSelf: 'center' } });

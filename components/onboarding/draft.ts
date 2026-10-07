import { useCallback, useMemo, useState } from 'react';
import type { MoveValue } from './motivations';
import { CATEGORY_BY_ID, LEVELS, type BodyShape, type CategoryId, type DayState, type Sex } from './content';

// Answers stay in memory until the authenticated completion or profile-update mutation saves them.

export type StepId =
  | 'welcome'
  | 'hello'
  | 'worlds'
  | `world:${CategoryId}`
  | 'values'
  | 'consent'
  | 'sex'
  | 'born'
  | 'height'
  | 'weight'
  | 'shape'
  | 'bodymap'
  | 'sleep'
  | 'day'
  | 'week'
  | 'rhythm'
  | 'push'
  | 'synth'
  | 'review'
  | 'notes'
  | 'letter';

export type BodyPain = { area: string; view: 'front' | 'back'; x: number; y: number; intensity: number };

export type Units = 'metric' | 'imperial';

export type Draft = {
  name: string;
  categories: CategoryId[];
  /** Level per discipline id (`world:Label`), 1 to 4. Absent means not picked. */
  levels: Record<string, number>;
  customs: Partial<Record<CategoryId, string[]>>;
  values: MoveValue[];
  consent: boolean;
  sex: Sex | null;
  birthYear: number | null;
  units: Units;
  heightCm: number | null;
  weightKg: number | null;
  shape: BodyShape | null;
  /** True once the body-map step was answered, even with nothing hurting. */
  bodyMapDone: boolean;
  bodyPain: Record<string, BodyPain>;
  sleep: number | null;
  sleepQuality: number | null;
  dayLoad: 'sitting' | 'feet' | 'physical' | 'varies' | null;
  days: DayState[];
  rhythm: 'plan' | 'rotate' | 'daily' | null;
  blockWeeks: number;
  push: number;
  notes: string;
};

export const EMPTY_DRAFT: Draft = {
  name: '',
  categories: [],
  levels: {},
  customs: {},
  values: [],
  consent: false,
  sex: null,
  birthYear: null,
  units: 'metric',
  heightCm: null,
  weightKg: null,
  shape: null,
  bodyMapDone: false,
  bodyPain: {},
  sleep: null,
  sleepQuality: null,
  dayLoad: null,
  days: ['free', 'free', 'free', 'free', 'free', 'free', 'free'],
  rhythm: null,
  blockWeeks: 2,
  push: 1,
  notes: '',
};

export type Practice = { id: string; label: string; category: CategoryId; /** 0 when the user stopped at the world. */ level: number };

export function disciplineId(category: CategoryId, label: string) {
  return `${category}:${label}`;
}

/** The disciplines shown for a world: the built-in ones, then anything the user added. */
export function worldDisciplines(draft: Draft, category: CategoryId) {
  const builtIn = CATEGORY_BY_ID[category].disciplines;
  const custom = (draft.customs[category] ?? []).filter(label => !builtIn.some(entry => entry.label.toLowerCase() === label.toLowerCase()));
  return [...builtIn, ...custom.map(label => ({ label, hint: undefined as string | undefined }))];
}

/** What the user does: each discipline they set a level on, or the whole world when they stopped there. */
export function derivePractices(draft: Draft): Practice[] {
  const practices: Practice[] = [];
  for (const category of draft.categories) {
    const picked = worldDisciplines(draft, category).filter(entry => (draft.levels[disciplineId(category, entry.label)] ?? 0) > 0);
    if (picked.length === 0) practices.push({ id: category, label: CATEGORY_BY_ID[category].label, category, level: 0 });
    else for (const entry of picked) practices.push({ id: disciplineId(category, entry.label), label: entry.label, category, level: draft.levels[disciplineId(category, entry.label)] });
  }
  return practices;
}

export function buildSteps(draft: Draft): StepId[] {
  return [
    'welcome',
    'hello',
    'values',
    'worlds',
    ...draft.categories.map((id): StepId => `world:${id}`),
    'consent', 'sex', 'born', 'height', 'weight', 'shape', 'bodymap',
    'sleep', 'day', 'week',
    'rhythm', 'push',
    'synth', 'review', 'notes', 'letter',
  ];
}

/** The progress bar groups the questions into five chapters. */
export const CHAPTER_COUNT = 5;
export function chapterOf(step: StepId): number {
  if (step === 'welcome') return -1;
  if (step === 'hello' || step === 'values') return 0;
  if (step === 'worlds' || step.startsWith('world:')) return 1;
  if (['consent', 'sex', 'born', 'height', 'weight', 'shape', 'bodymap'].includes(step)) return 2;
  if (step === 'sleep' || step === 'day' || step === 'week') return 3;
  return 4;
}

/** Steps nobody has to answer. Reed asks again later, in the app, when it needs the answer. */
const SKIPPABLE: StepId[] = ['notes', 'values', 'bodymap', 'sleep', 'day', 'week', 'rhythm'];
export function isSkippable(step: StepId) {
  return step.startsWith('world:') || SKIPPABLE.includes(step);
}

/** Steps whose primary button works with nothing chosen: it accepts what the control already shows. */
const ACCEPTS_DEFAULT: StepId[] = ['born', 'height', 'weight', 'shape', 'bodymap', 'week', 'push'];

export function canContinue(step: StepId, draft: Draft) {
  if (ACCEPTS_DEFAULT.includes(step)) return true;
  switch (step) {
    case 'hello': return draft.name.trim().length > 0;
    case 'worlds': return draft.categories.length > 0;
    case 'values': return draft.values.length > 0;
    case 'sex': return draft.sex !== null;
    case 'sleep': return draft.sleep !== null;
    case 'day': return draft.dayLoad !== null;
    case 'rhythm': return draft.rhythm !== null;
    default: return true;
  }
}

/** What Reed still wants to know. Shown on the summary and asked again once the app needs it. */
export function askLater(draft: Draft) {
  const missing: string[] = [];
  if (draft.sex === null) missing.push('sex');
  if (draft.birthYear === null) missing.push('year born');
  if (draft.heightCm === null) missing.push('height');
  if (draft.weightKg === null) missing.push('weight');
  if (draft.shape === null) missing.push('body shape');
  if (!draft.bodyMapDone) missing.push('aches and injuries');
  if (draft.sleep === null) missing.push('sleep');
  if (draft.dayLoad === null) missing.push('how active your days are');
  if (draft.rhythm === null) missing.push('how you like to train');
  return missing;
}

export function useOnboardingFlow(initialDraft = EMPTY_DRAFT, initialStep: StepId = 'welcome') {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [step, setStep] = useState<StepId>(initialStep);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [returnToReview, setReturnToReview] = useState(false);

  const practices = useMemo(() => derivePractices(draft), [draft]);
  const steps = useMemo(() => buildSteps(draft), [draft]);

  const update = useCallback((patch: Partial<Draft>) => setDraft(current => ({ ...current, ...patch })), []);

  const move = useCallback((target: StepId) => {
    setDirection(steps.indexOf(target) >= steps.indexOf(step) ? 1 : -1);
    setStep(target);
  }, [step, steps]);

  const next = useCallback(() => {
    if (returnToReview && step !== 'review') {
      setReturnToReview(false);
      move('review');
      return;
    }
    const target = steps[steps.indexOf(step) + 1];
    if (target) move(target);
  }, [move, returnToReview, step, steps]);

  const back = useCallback(() => {
    if (returnToReview) {
      setReturnToReview(false);
      move('review');
      return;
    }
    const target = steps[steps.indexOf(step) - 1];
    if (target) move(target);
  }, [move, returnToReview, step, steps]);

  const edit = useCallback((target: StepId) => {
    setReturnToReview(true);
    move(target);
  }, [move]);

  return { draft, update, step, steps, direction, practices, next, back, edit, returnToReview };
}

export function firstName(draft: Draft) {
  const name = draft.name.trim().split(/\s+/)[0];
  return name ? name.charAt(0).toLocaleUpperCase() + name.slice(1) : 'there';
}

export function levelName(level: number) {
  return level > 0 ? LEVELS[level - 1] : null;
}

/** Start with the most established practice; actual training can revise the focus. */
export function proposeFocus(draft: Draft, practices: Practice[]) {
  const ranked = [...practices].sort((a, b) => b.level - a.level);
  const lead = ranked[0];
  const rotation = ranked.slice(1);
  const asks = lead ? CATEGORY_BY_ID[lead.category].asks : [];
  const free = draft.days.flatMap((state, index) => (state === 'free' ? [index] : []));
  const supportCount = Math.min(free.length, draft.values.includes('longevity') ? 2 : draft.push === 0 ? 2 : draft.push === 1 ? 3 : 4);
  const support = supportCount === 0 ? [] : Array.from({ length: supportCount }, (_, index) => free[Math.floor(((index + 0.5) * free.length) / supportCount)]);
  return { lead, rotation, asks, support: [...new Set(support)] };
}

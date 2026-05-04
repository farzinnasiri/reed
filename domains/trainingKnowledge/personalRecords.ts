import type { RecipeKey } from '../workout/recipes';
import { summarizeMetrics } from '../workout/recipes';

export type RecordKind =
  | 'estimated_1rm'
  | 'heaviest_load'
  | 'rep_best'
  | 'set_volume'
  | 'session_volume'
  | 'duration'
  | 'distance'
  | 'fastest_1k'
  | 'fastest_5k'
  | 'floors';

export type ActivityRecordInput = {
  activityLogId: string;
  derivedEffectiveLoadKg: number | null;
  exerciseCatalogId: string;
  exerciseName: string;
  loggedAt: number;
  metrics: Record<string, number>;
  profileId: string;
  recipeKey: RecipeKey;
  sessionId: string | null;
  warmup: boolean;
};

export type PersonalRecord = {
  exerciseCatalogId: string;
  exerciseName: string;
  kind: RecordKind;
  label: string;
  value: number;
  unit: string;
  displayValue: string;
  summary: string;
  evidence: {
    activityLogId: string;
    loggedAt: number;
    metrics: Record<string, number>;
    recipeKey: RecipeKey;
    sessionId: string | null;
  };
};

export type RecordHighlight = PersonalRecord & {
  priority: number;
};

export type SessionRecordResult = {
  nearRecords: PersonalRecord[];
  records: PersonalRecord[];
};

type RecordCandidate = Omit<PersonalRecord, 'exerciseName'>;

type RecordRule = {
  kind: RecordKind;
  label: string;
  priority: number;
  calculate(activity: ActivityRecordInput): RecordCandidate | null;
  higherIsBetter?: boolean;
};

const NEAR_RECORD_RATIO = 0.95;

const rules: RecordRule[] = [
  {
    kind: 'estimated_1rm',
    label: 'Estimated max',
    priority: 100,
    calculate: activity => {
      const reps = getReps(activity.metrics);
      const load = getEffectiveLoad(activity);
      if (reps <= 0 || load <= 0 || reps > 20) return null;
      const value = round(load * (1 + reps / 30), 1);
      return buildCandidate(activity, 'estimated_1rm', 'Estimated max', value, 'kg', `${formatNumber(value)} kg`, `${formatNumber(load)} kg × ${formatInteger(reps)}`);
    },
  },
  {
    kind: 'heaviest_load',
    label: 'Heaviest set',
    priority: 90,
    calculate: activity => {
      const load = getEffectiveLoad(activity);
      if (load <= 0) return null;
      const reps = getReps(activity.metrics);
      const suffix = reps > 0 ? ` × ${formatInteger(reps)}` : '';
      return buildCandidate(activity, 'heaviest_load', 'Heaviest set', load, 'kg', `${formatNumber(load)} kg`, `${formatNumber(load)} kg${suffix}`);
    },
  },
  {
    kind: 'rep_best',
    label: 'Rep best',
    priority: 80,
    calculate: activity => {
      const reps = getReps(activity.metrics);
      if (reps <= 0) return null;
      const load = getEffectiveLoad(activity);
      const summary = load > 0 ? `${formatNumber(load)} kg × ${formatInteger(reps)}` : `${formatInteger(reps)} reps`;
      return buildCandidate(activity, 'rep_best', 'Rep best', reps, 'reps', `${formatInteger(reps)} reps`, summary);
    },
  },
  {
    kind: 'set_volume',
    label: 'Set volume',
    priority: 50,
    calculate: activity => {
      const reps = getReps(activity.metrics);
      const load = getEffectiveLoad(activity);
      const value = round(load * reps, 1);
      if (value <= 0) return null;
      return buildCandidate(activity, 'set_volume', 'Set volume', value, 'kg', `${formatInteger(value)} kg`, `${formatNumber(load)} kg × ${formatInteger(reps)}`);
    },
  },
  {
    kind: 'duration',
    label: 'Longest effort',
    priority: 45,
    calculate: activity => {
      const duration = getDurationSeconds(activity.metrics);
      if (duration <= 0) return null;
      return buildCandidate(activity, 'duration', 'Longest effort', duration, 's', formatDuration(duration), summarizeMetrics(activity.recipeKey, activity.metrics));
    },
  },
  {
    kind: 'distance',
    label: 'Longest distance',
    priority: 44,
    calculate: activity => {
      const distance = finiteOrZero(activity.metrics.distance);
      if (distance <= 0) return null;
      return buildCandidate(activity, 'distance', 'Longest distance', distance, 'km', `${formatNumber(distance)} km`, summarizeMetrics(activity.recipeKey, activity.metrics));
    },
  },
  {
    kind: 'fastest_1k',
    label: 'Fastest 1K',
    priority: 42,
    higherIsBetter: false,
    calculate: activity => calculateFastestDistance(activity, 'fastest_1k', 'Fastest 1K', 1),
  },
  {
    kind: 'fastest_5k',
    label: 'Fastest 5K',
    priority: 41,
    higherIsBetter: false,
    calculate: activity => calculateFastestDistance(activity, 'fastest_5k', 'Fastest 5K', 5),
  },
  {
    kind: 'floors',
    label: 'Most floors',
    priority: 40,
    calculate: activity => {
      const floors = finiteOrZero(activity.metrics.floors);
      if (floors <= 0) return null;
      return buildCandidate(activity, 'floors', 'Most floors', floors, 'floors', `${formatInteger(floors)} floors`, summarizeMetrics(activity.recipeKey, activity.metrics));
    },
  },
];

export function calculatePersonalRecords(input: { activities: ActivityRecordInput[] }) {
  const best = new Map<string, PersonalRecord>();

  for (const activity of input.activities) {
    if (activity.warmup) continue;
    for (const rule of rules) {
      const candidate = rule.calculate(activity);
      if (!candidate) continue;
      const key = getRecordKey(candidate.exerciseCatalogId, candidate.kind);
      const current = best.get(key);
      const record: PersonalRecord = { ...candidate, exerciseName: activity.exerciseName };
      if (!current || compareRecords(record, current, rule) > 0) {
        best.set(key, record);
      }
    }
  }

  return Array.from(best.values()).sort(compareRecordsForDisplay);
}

export function calculateRecordHighlights(input: { limit: number; records: PersonalRecord[] }) {
  const usedExercises = new Set<string>();
  const highlights: RecordHighlight[] = [];
  for (const record of input.records
    .map(record => ({ ...record, priority: getRule(record.kind)?.priority ?? 0 }))
    .sort((left, right) => right.priority - left.priority || right.evidence.loggedAt - left.evidence.loggedAt)) {
    if (usedExercises.has(record.exerciseCatalogId) && highlights.length < input.limit - 1) continue;
    usedExercises.add(record.exerciseCatalogId);
    highlights.push(record);
    if (highlights.length >= input.limit) break;
  }
  return highlights;
}

export function detectSessionRecords(input: { historicalActivities: ActivityRecordInput[]; sessionActivities: ActivityRecordInput[] }) {
  const historicalRecords = calculatePersonalRecords({ activities: input.historicalActivities });
  const sessionRecords = calculatePersonalRecords({ activities: input.sessionActivities });
  const historicalByKey = new Map(historicalRecords.map(record => [getRecordKey(record.exerciseCatalogId, record.kind), record]));
  const records: PersonalRecord[] = [];
  const nearRecords: PersonalRecord[] = [];

  for (const record of sessionRecords) {
    const previous = historicalByKey.get(getRecordKey(record.exerciseCatalogId, record.kind));
    const rule = getRule(record.kind);
    if (!previous || compareRecords(record, previous, rule) > 0) {
      records.push(record);
      continue;
    }
    if (isNearRecord(record, previous, rule)) nearRecords.push(record);
  }

  return { nearRecords, records };
}

function buildCandidate(activity: ActivityRecordInput, kind: RecordKind, label: string, value: number, unit: string, displayValue: string, summary: string): RecordCandidate {
  return {
    displayValue,
    evidence: {
      activityLogId: activity.activityLogId,
      loggedAt: activity.loggedAt,
      metrics: activity.metrics,
      recipeKey: activity.recipeKey,
      sessionId: activity.sessionId,
    },
    exerciseCatalogId: activity.exerciseCatalogId,
    kind,
    label,
    summary,
    unit,
    value,
  };
}

function calculateFastestDistance(activity: ActivityRecordInput, kind: RecordKind, label: string, distanceKm: number) {
  const distance = finiteOrZero(activity.metrics.distance);
  const duration = getDurationSeconds(activity.metrics);
  if (distance < distanceKm || duration <= 0) return null;
  const value = duration * (distanceKm / distance);
  return buildCandidate(activity, kind, label, round(value, 1), 's', formatDuration(value), summarizeMetrics(activity.recipeKey, activity.metrics));
}

function compareRecords(left: PersonalRecord, right: PersonalRecord, rule = getRule(left.kind)) {
  const direction = rule?.higherIsBetter === false ? -1 : 1;
  if (left.value === right.value) return left.evidence.loggedAt - right.evidence.loggedAt;
  return (left.value - right.value) * direction;
}

function compareRecordsForDisplay(left: PersonalRecord, right: PersonalRecord) {
  const leftRule = getRule(left.kind);
  const rightRule = getRule(right.kind);
  return (rightRule?.priority ?? 0) - (leftRule?.priority ?? 0) || left.exerciseName.localeCompare(right.exerciseName);
}

function isNearRecord(record: PersonalRecord, previous: PersonalRecord, rule = getRule(record.kind)) {
  if (!previous.value) return false;
  if (rule?.higherIsBetter === false) return record.value <= previous.value / NEAR_RECORD_RATIO;
  return record.value >= previous.value * NEAR_RECORD_RATIO;
}

function getRecordKey(exerciseCatalogId: string, kind: RecordKind) {
  return `${exerciseCatalogId}:${kind}`;
}

function getRule(kind: RecordKind) {
  return rules.find(rule => rule.kind === kind);
}

function getEffectiveLoad(activity: ActivityRecordInput) {
  return round(finiteOrZero(activity.derivedEffectiveLoadKg) || finiteOrZero(activity.metrics.load) || finiteOrZero(activity.metrics.addedLoad), 1);
}

function getReps(metrics: Record<string, number>) {
  const paired = Math.min(finiteOrZero(metrics.leftReps), finiteOrZero(metrics.rightReps));
  return paired > 0 ? paired : finiteOrZero(metrics.reps);
}

function getDurationSeconds(metrics: Record<string, number>) {
  const paired = Math.min(finiteOrZero(metrics.leftDuration), finiteOrZero(metrics.rightDuration));
  return paired > 0 ? paired : finiteOrZero(metrics.duration) || finiteOrZero(metrics.time);
}

function finiteOrZero(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function round(value: number, decimals = 0) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatInteger(value: number) {
  return Math.round(value).toLocaleString('en');
}

function formatDuration(seconds: number) {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

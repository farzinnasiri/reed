export type TargetRule = {
  cadence: 'daily' | 'once' | 'total' | 'weekly';
  exerciseCatalogId: string | null;
  metricKind:
    | 'cardioDistanceMeters'
    | 'cardioDistanceWithinDuration'
    | 'cardioDurationSeconds'
    | 'exerciseBestHoldSeconds'
    | 'exerciseMaxLoadKg'
    | 'exerciseRepsAtLoad'
    | 'exerciseTotalDurationSeconds'
    | 'exerciseTotalReps'
    | 'sessionCount';
  minDurationSeconds?: number;
  minLoadKg?: number;
  minReps?: number;
  periodCount?: number;
  threshold: number;
  thresholdUnit: string;
};

export type TargetEvaluationSubject = {
  endsAt: number;
  rule: TargetRule;
  startsAt: number;
  timeZone?: string;
};

export type TargetEvidenceLog = {
  _id: string;
  derivedEffectiveLoadKg?: number;
  loggedAt: number;
  metrics: Record<string, number>;
  setOutcomeDetails?: {
    failedReps?: number;
    rangeOfMotion?: 'bottom_partial' | 'full' | 'mid_partial' | 'top_partial';
  };
  warmup: boolean;
};

export type TargetProgressSummary = {
  current: number;
  currentLabel: string;
  currentPeriod?: TargetProgressSlice;
  overall?: TargetProgressSlice;
  required: number;
  requiredLabel: string;
  satisfiedPeriods?: number;
  totalPeriods?: number;
};

export type TargetProgressSlice = {
  current: number;
  label: string;
  required: number;
  valueLabel: string;
};

export type TargetVerifiedSnapshot = {
  evaluatedAt: number;
  evidenceActivityLogIds: string[];
  summary: string;
};

export type TargetEvaluationResult = {
  completed: boolean;
  progressSummary: TargetProgressSummary;
  verifiedSnapshot?: TargetVerifiedSnapshot;
};

export function emptyTargetProgress(rule: TargetRule): TargetProgressSummary {
  return progress(rule.threshold, 0, progressLabel(0, rule.threshold, rule.thresholdUnit, goalScopeLabel(rule.cadence)), `${formatNumber(rule.threshold)} ${rule.thresholdUnit}`, goalScopeLabel(rule.cadence));
}

export function isEligibleTargetEvidence(log: TargetEvidenceLog) {
  if (log.warmup) return false;
  if (log.setOutcomeDetails?.failedReps && log.setOutcomeDetails.failedReps > 0) return false;
  if (log.setOutcomeDetails?.rangeOfMotion && log.setOutcomeDetails.rangeOfMotion !== 'full') return false;
  return true;
}

export function evaluateTargetProgress(subject: TargetEvaluationSubject, evidenceLogs: TargetEvidenceLog[], now: number): TargetEvaluationResult {
  const logs = evidenceLogs.filter(isEligibleTargetEvidence);
  const rule = subject.rule;
  if (rule.cadence === 'daily' || rule.cadence === 'weekly') {
    return evaluatePeriodQuota(subject, logs, now);
  }

  const current = aggregateMetricValue(rule, logs, rule.cadence, subject.timeZone);
  const completed = current >= rule.threshold;
  return {
    completed,
    progressSummary: progress(rule.threshold, current, progressLabel(current, rule.threshold, rule.thresholdUnit, 'total'), unitLabel(rule.thresholdUnit, rule.threshold), 'total'),
    verifiedSnapshot: completed ? snapshot(now, logs, `${formatNumber(current)} / ${formatNumber(rule.threshold)} ${rule.thresholdUnit}`) : undefined,
  };
}

function evaluatePeriodQuota(subject: TargetEvaluationSubject, logs: TargetEvidenceLog[], now: number): TargetEvaluationResult {
  const rule = subject.rule;
  const periods = buildPeriods({
    cadence: rule.cadence === 'weekly' ? 'weekly' : 'daily',
    endsAt: subject.endsAt,
    periodCount: rule.periodCount,
    startsAt: subject.startsAt,
    timeZone: subject.timeZone,
  });
  let satisfied = 0;
  let currentPeriodValue = 0;

  for (const period of periods) {
    const periodLogs = logs.filter(log => log.loggedAt >= period.startAt && log.loggedAt <= period.endAt);
    const value = aggregateMetricValue(rule, periodLogs, 'total', subject.timeZone);

    if (now >= period.startAt && now <= period.endAt) currentPeriodValue = value;
    if (value >= rule.threshold) satisfied += 1;
  }

  const requiredPeriods = periods.length;
  const completed = requiredPeriods > 0 && satisfied >= requiredPeriods;
  return {
    completed,
    progressSummary: {
      current: currentPeriodValue,
      currentLabel: progressLabel(currentPeriodValue, rule.threshold, rule.thresholdUnit, rule.cadence === 'daily' ? 'today' : 'this week'),
      currentPeriod: {
        current: currentPeriodValue,
        label: rule.cadence === 'daily' ? 'Today' : 'This week',
        required: rule.threshold,
        valueLabel: progressLabel(currentPeriodValue, rule.threshold, rule.thresholdUnit, rule.cadence === 'daily' ? 'today' : 'this week'),
      },
      overall: {
        current: satisfied,
        label: 'Goal',
        required: requiredPeriods,
        valueLabel: `${formatNumber(satisfied)} / ${formatNumber(requiredPeriods)} ${rule.cadence === 'daily' ? 'days hit' : 'weeks hit'}`,
      },
      required: rule.threshold,
      requiredLabel: `${formatNumber(rule.threshold)} ${rule.thresholdUnit}`,
      satisfiedPeriods: satisfied,
      totalPeriods: requiredPeriods,
    },
    verifiedSnapshot: completed ? snapshot(now, logs, `${satisfied} / ${requiredPeriods} periods complete`) : undefined,
  };
}

function metricValue(rule: TargetRule, log: TargetEvidenceLog) {
  switch (rule.metricKind) {
    case 'exerciseMaxLoadKg':
      return log.metrics.load ?? log.metrics.addedLoad ?? log.derivedEffectiveLoadKg ?? 0;
    case 'exerciseRepsAtLoad': {
      const load = log.metrics.load ?? log.metrics.addedLoad ?? log.derivedEffectiveLoadKg ?? 0;
      return load >= (rule.minLoadKg ?? 0) ? totalReps(log) : 0;
    }
    case 'exerciseTotalReps':
      return totalReps(log);
    case 'exerciseBestHoldSeconds':
      return log.metrics.duration ?? log.metrics.leftDuration ?? log.metrics.rightDuration ?? 0;
    case 'exerciseTotalDurationSeconds':
    case 'cardioDurationSeconds':
      return (log.metrics.duration ?? 0) + (log.metrics.leftDuration ?? 0) + (log.metrics.rightDuration ?? 0);
    case 'cardioDistanceMeters':
      return (log.metrics.distance ?? 0) * 1000;
    case 'cardioDistanceWithinDuration': {
      const duration = log.metrics.duration ?? 0;
      return duration > 0 && duration <= (rule.minDurationSeconds ?? Number.MAX_SAFE_INTEGER) ? (log.metrics.distance ?? 0) * 1000 : 0;
    }
    case 'sessionCount':
      return 1;
  }
}

function aggregateMetricValue(rule: TargetRule, logs: TargetEvidenceLog[], cadence: TargetRule['cadence'], timeZone?: string) {
  if (rule.metricKind === 'sessionCount') {
    return countActiveDays(logs, timeZone);
  }

  const values = logs.map(log => metricValue(rule, log)).filter(value => value > 0);
  return cadence === 'once' || isBestEffortMetric(rule.metricKind)
    ? Math.max(0, ...values)
    : values.reduce((sum, value) => sum + value, 0);
}

function countActiveDays(logs: TargetEvidenceLog[], timeZone?: string) {
  const days = new Set(logs.map(log => getLocalDayKey(log.loggedAt, timeZone)));
  return days.size;
}

function isBestEffortMetric(metricKind: TargetRule['metricKind']) {
  return metricKind === 'exerciseMaxLoadKg' ||
    metricKind === 'exerciseBestHoldSeconds' ||
    metricKind === 'cardioDistanceWithinDuration';
}

function totalReps(log: TargetEvidenceLog) {
  return (log.metrics.reps ?? 0) + (log.metrics.leftReps ?? 0) + (log.metrics.rightReps ?? 0);
}

function buildPeriods({
  cadence,
  endsAt,
  periodCount,
  startsAt,
  timeZone,
}: {
  cadence: 'daily' | 'weekly';
  endsAt: number;
  periodCount?: number;
  startsAt: number;
  timeZone?: string;
}) {
  const length = cadence === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const max = periodCount ?? Math.max(1, Math.ceil((endsAt - startsAt) / length));
  const firstStart = cadence === 'daily'
    ? startOfLocalDay(startsAt, timeZone)
    : startOfLocalWeek(startsAt, timeZone);

  return Array.from({ length: max }, (_, index) => {
    const startAt = firstStart + index * length;
    return {
      startAt,
      endAt: Math.min(endsAt, startAt + length - 1),
    };
  });
}

function progress(required: number, current: number, currentLabel: string, requiredLabel: string, label: string): TargetProgressSummary {
  return {
    current,
    currentLabel,
    overall: {
      current,
      label,
      required,
      valueLabel: currentLabel,
    },
    required,
    requiredLabel,
  };
}

function snapshot(evaluatedAt: number, logs: TargetEvidenceLog[], summary: string): TargetVerifiedSnapshot {
  return { evaluatedAt, evidenceActivityLogIds: logs.slice(-10).map(log => log._id), summary };
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function unitLabel(unit: string, value: number) {
  return `${formatNumber(value)} ${unit}`;
}

function progressLabel(current: number, required: number, unit: string, scope: string) {
  return `${formatNumber(current)} / ${formatNumber(required)} ${unit} ${scope}`;
}

function goalScopeLabel(cadence: TargetRule['cadence']) {
  if (cadence === 'daily') return 'today';
  if (cadence === 'weekly') return 'this week';
  return 'total';
}

function startOfLocalWeek(timestamp: number, timeZone?: string) {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const parts = getLocalParts(timestamp, normalizedTimeZone);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: normalizedTimeZone, weekday: 'short' }).format(new Date(timestamp));
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  const mondayOffset = dayIndex === 0 ? 6 : Math.max(0, dayIndex - 1);
  return localTimeToUtcMs({ ...parts, hour: 0, minute: 0, second: 0, millisecond: 0 }, normalizedTimeZone) - mondayOffset * 24 * 60 * 60 * 1000;
}

function startOfLocalDay(timestamp: number, timeZone?: string) {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const parts = getLocalParts(timestamp, normalizedTimeZone);
  return localTimeToUtcMs({ ...parts, hour: 0, minute: 0, second: 0, millisecond: 0 }, normalizedTimeZone);
}

function getLocalParts(timestamp: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
  return {
    day: Number(parts.day),
    hour: Number(parts.hour),
    millisecond: 0,
    minute: Number(parts.minute),
    month: Number(parts.month),
    second: Number(parts.second),
    year: Number(parts.year),
  };
}

function localTimeToUtcMs(parts: ReturnType<typeof getLocalParts>, timeZone: string) {
  let guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
  for (let index = 0; index < 2; index += 1) {
    const offset = getTimeZoneOffsetMs(guess, timeZone);
    guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond) - offset;
  }
  return guess;
}

function getTimeZoneOffsetMs(timestamp: number, timeZone: string) {
  const parts = getLocalParts(timestamp, timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
  return localAsUtc - timestamp;
}

function normalizeTimeZone(timeZone?: string) {
  if (!timeZone || timeZone.length > 80) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'UTC';
  }
}

function getLocalDayKey(timestamp: number, timeZone?: string) {
  const parts = getLocalParts(timestamp, normalizeTimeZone(timeZone));
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

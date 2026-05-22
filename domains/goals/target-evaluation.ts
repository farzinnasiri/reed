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
  required: number;
  requiredLabel: string;
  satisfiedPeriods?: number;
  totalPeriods?: number;
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
  return progress(rule.threshold, 0, `0 ${rule.thresholdUnit}`, `${formatNumber(rule.threshold)} ${rule.thresholdUnit}`);
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

  const values = logs.map(log => metricValue(rule, log)).filter(value => value > 0);
  const current = rule.cadence === 'once' ? Math.max(0, ...values) : values.reduce((sum, value) => sum + value, 0);
  const completed = current >= rule.threshold;
  return {
    completed,
    progressSummary: progress(rule.threshold, current, unitLabel(rule.thresholdUnit, current), unitLabel(rule.thresholdUnit, rule.threshold)),
    verifiedSnapshot: completed ? snapshot(now, logs, `${formatNumber(current)} / ${formatNumber(rule.threshold)} ${rule.thresholdUnit}`) : undefined,
  };
}

function evaluatePeriodQuota(subject: TargetEvaluationSubject, logs: TargetEvidenceLog[], now: number): TargetEvaluationResult {
  const rule = subject.rule;
  const periods = buildPeriods(subject.startsAt, subject.endsAt, rule.cadence === 'weekly' ? 'weekly' : 'daily', rule.periodCount);
  let satisfied = 0;
  let currentPeriodValue = 0;

  for (const period of periods) {
    const value = logs
      .filter(log => log.loggedAt >= period.startAt && log.loggedAt <= period.endAt)
      .map(log => metricValue(rule, log))
      .reduce((sum, item) => sum + item, 0);

    if (now >= period.startAt && now <= period.endAt) currentPeriodValue = value;
    if (value >= rule.threshold) satisfied += 1;
  }

  const requiredPeriods = periods.length;
  const completed = requiredPeriods > 0 && satisfied >= requiredPeriods;
  return {
    completed,
    progressSummary: {
      current: currentPeriodValue,
      currentLabel: `${formatNumber(currentPeriodValue)} ${rule.thresholdUnit} this ${rule.cadence === 'daily' ? 'day' : 'week'}`,
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

function totalReps(log: TargetEvidenceLog) {
  return (log.metrics.reps ?? 0) + (log.metrics.leftReps ?? 0) + (log.metrics.rightReps ?? 0);
}

function buildPeriods(startsAt: number, endsAt: number, cadence: 'daily' | 'weekly', periodCount?: number) {
  const length = cadence === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const max = periodCount ?? Math.max(1, Math.ceil((endsAt - startsAt) / length));
  return Array.from({ length: max }, (_, index) => ({
    startAt: startsAt + index * length,
    endAt: Math.min(endsAt, startsAt + (index + 1) * length - 1),
  }));
}

function progress(required: number, current: number, currentLabel: string, requiredLabel: string): TargetProgressSummary {
  return { current, currentLabel, required, requiredLabel };
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

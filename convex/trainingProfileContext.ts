import type { CompleteOnboardingPayload } from './profileValidators';

export function buildTrainingProfileContextSummary({
  displayName,
  payload,
  now,
}: {
  displayName?: string;
  payload: CompleteOnboardingPayload;
  now: number;
}) {
  const name = displayName?.trim() || 'The user';
  const age = getAge(payload.baseline.birthYear, payload.baseline.birthMonth, payload.baseline.birthDay);
  const rankedGoals = payload.rankedGoals.map(goal => formatGoalWithDetail(goal, payload.goalDetails[goal]));
  const topGoal = rankedGoals[0] ?? 'a balanced training plan';
  const secondaryGoals = rankedGoals.slice(1);
  const bodyMetrics = formatBodyMetrics(payload.bodyMetrics);
  const performanceAnchors = formatPerformanceAnchors(payload.performanceAnchors);
  const constraints = formatConstraints(payload.constraints);
  const conservativeReasons = getConservativeReasons(payload);

  const lines = [
    `${name} has consented to profiling. They are ${age} years old and ${formatNumber(payload.baseline.heightCm)} cm tall. Their current recovery baseline is ${formatRecovery(payload.baseline.recoveryQuality)}.`,
    `They have been training ${formatTrainingAge(payload.trainingReality.trainingAge)}, usually ${formatWeeklySessions(payload.trainingReality.weeklySessions)} for ${formatSessionDuration(payload.trainingReality.sessionDuration)}, with ${formatEffort(payload.trainingReality.effort)}. Their current training style is ${formatList(payload.trainingReality.trainingStyles.map(formatTrainingStyle))}. They train with access to ${formatList(payload.trainingReality.equipmentAccess.map(formatEquipmentAccess))}.`,
    secondaryGoals.length > 0
      ? `Their top priority is ${topGoal}. Other ranked priorities are ${formatList(secondaryGoals)}. Reed should protect the top priority when time, recovery, or equipment gets tight.`
      : `Their top priority is ${topGoal}. Reed should protect this priority when time, recovery, or equipment gets tight.`,
    constraints,
    bodyMetrics,
    performanceAnchors,
    payload.userNotes && payload.userNotes.trim().length > 0 ? `User note: ${payload.userNotes.trim()}` : '',
    conservativeReasons.length > 0
      ? `Programming should be conservative because ${formatList(conservativeReasons)}.`
      : 'Programming can start from the stated training budget while monitoring fatigue and adherence.',
    `This profile summary was generated deterministically from onboarding answers on ${new Date(now).toISOString()}. It should be used as AI context, not as a medical diagnosis or a replacement for the structured profile fields.`,
  ];

  return lines.filter(Boolean).join('\n\n');
}

function formatGoalWithDetail(
  goal: string,
  detail: { customDetail: string | null; detail: string | null; focusAreas: string[] } | undefined,
) {
  const goalLabel = formatGoal(goal);
  if (!detail) {
    return goalLabel;
  }

  const detailParts = [
    detail.detail === 'other' ? detail.customDetail : detail.detail,
    detail.focusAreas.length > 0 ? formatList(detail.focusAreas.map(formatGoalDetail)) : null,
  ].filter((part): part is string => Boolean(part));

  return detailParts.length > 0 ? `${goalLabel} (${detailParts.join('; ')})` : goalLabel;
}

function formatBodyMetrics(metrics: CompleteOnboardingPayload['bodyMetrics']) {
  const parts = [
    metrics.weightKg !== null ? `${formatNumber(metrics.weightKg)} kg body weight` : null,
    metrics.bodyFatPercent !== null ? `${formatNumber(metrics.bodyFatPercent)}% body fat` : null,
    metrics.skeletalMuscleMassKg !== null ? `${formatNumber(metrics.skeletalMuscleMassKg)} kg skeletal muscle mass` : null,
    metrics.restingHeartRate !== null ? `${formatNumber(metrics.restingHeartRate)} bpm estimated resting heart rate` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? `Body metrics available: ${formatList(parts)}.` : '';
}

function formatPerformanceAnchors(anchors: CompleteOnboardingPayload['performanceAnchors']) {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(anchors.loaded)) {
    if (value.loadKg !== null && value.reps !== null) {
      parts.push(`${formatStrengthAnchorKey(key)} ${formatNumber(value.loadKg)} kg x ${value.reps}`);
    }
  }

  for (const [key, reps] of Object.entries(anchors.bodyweight)) {
    parts.push(`${formatStrengthAnchorKey(key)} max ${reps} reps`);
  }

  if (anchors.cardio.run1KmSeconds !== null) {
    parts.push(`1 km run in ${formatDuration(anchors.cardio.run1KmSeconds)}`);
  }
  if (anchors.cardio.run5KmSeconds !== null) {
    parts.push(`5 km run in ${formatDuration(anchors.cardio.run5KmSeconds)}`);
  }
  if (anchors.cardio.stairFloors !== null && anchors.cardio.stairMinutes !== null) {
    parts.push(`stair test ${anchors.cardio.stairFloors} floors in ${formatNumber(anchors.cardio.stairMinutes)} minutes`);
  }

  return parts.length > 0 ? `Performance anchors available: ${formatList(parts)}.` : '';
}

function formatConstraints(constraints: CompleteOnboardingPayload['constraints']) {
  if (constraints.areas.length === 0) {
    return 'They did not flag pain or health constraints during onboarding.';
  }

  const parts = constraints.areas.map(area => {
    const detail = constraints.details[area];
    const areaLabel = area === 'other' && detail?.customDetail ? detail.customDetail : formatConstraintArea(area);
    const qualifiers = [detail?.severity, detail?.timing ? formatPainTiming(detail.timing) : null].filter(Boolean);
    return qualifiers.length > 0 ? `${areaLabel} (${qualifiers.join(', ')})` : areaLabel;
  });

  return `They flagged constraints Reed should respect: ${formatList(parts)}. Reed can adapt exercise selection from this information, but it is not medical advice.`;
}

function getConservativeReasons(payload: CompleteOnboardingPayload) {
  const reasons: string[] = [];

  if (payload.baseline.recoveryQuality === 'fragile') {
    reasons.push('recovery is fragile');
  }
  if (payload.constraints.areas.some(area => payload.constraints.details[area]?.severity === 'high')) {
    reasons.push('at least one constraint is high severity');
  }
  if (payload.constraints.areas.some(area => payload.constraints.details[area]?.timing === 'recent_injury')) {
    reasons.push('a recent injury was flagged');
  }

  return reasons;
}

function getAge(year: number, month: number, day: number) {
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
    age -= 1;
  }
  return age;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatList(values: string[]) {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function humanize(value: string) {
  return value.replace(/_/g, ' ');
}

function formatRecovery(value: string) {
  return `${value} recovery`;
}

function formatTrainingAge(value: string) {
  const labels: Record<string, string> = {
    starting: 'as someone just starting',
    under_6_months: 'for under 6 months',
    six_to_18_months: 'for 6-18 months',
    over_18_months: 'for over 18 months',
  };
  return labels[value] ?? humanize(value);
}

function formatWeeklySessions(value: string) {
  const labels: Record<string, string> = {
    one_to_two: '1-2 sessions per week',
    two_to_four: '2-4 sessions per week',
    four_plus: '4+ sessions per week',
  };
  return labels[value] ?? humanize(value);
}

function formatSessionDuration(value: string) {
  const labels: Record<string, string> = {
    under_45: 'under 45 minutes',
    fortyfive_to_75: '45-75 minutes',
    over_75: '75+ minutes',
  };
  return labels[value] ?? humanize(value);
}

function formatEffort(value: string) {
  const labels: Record<string, string> = {
    easy: 'easy effort',
    moderate: 'moderate effort',
    hard: 'hard effort',
  };
  return labels[value] ?? humanize(value);
}

function formatTrainingStyle(value: string) {
  const labels: Record<string, string> = {
    classic_gym: 'classic gym training',
    calisthenics: 'calisthenics',
    sport_support: 'sport-support training',
    cardio: 'cardio',
    mobility_rehab: 'mobility/rehab work',
  };
  return labels[value] ?? humanize(value);
}

function formatEquipmentAccess(value: string) {
  const labels: Record<string, string> = {
    full_gym: 'a full gym',
    calisthenics_park: 'a calisthenics park',
    home_equipment: 'home equipment',
    crowded_gym: 'a crowded gym environment',
    no_fixed_equipment: 'no fixed equipment',
  };
  return labels[value] ?? humanize(value);
}

function formatGoal(value: string) {
  const labels: Record<string, string> = {
    build_muscle: 'build muscle',
    get_stronger: 'get stronger',
    master_skill: 'master a skill',
    support_sport: 'support a sport',
    improve_conditioning: 'improve conditioning',
    move_without_pain: 'move without pain',
  };
  return labels[value] ?? humanize(value);
}

function formatStrengthAnchorKey(value: string) {
  const labels: Record<string, string> = {
    squat: 'squat',
    bench_press: 'bench press',
    deadlift: 'deadlift',
    overhead_press: 'overhead press',
    pull_up: 'pull-ups',
    push_up: 'push-ups',
    dip: 'dips',
  };
  return labels[value] ?? humanize(value);
}

function formatGoalDetail(value: string) {
  const labels: Record<string, string> = {
    muscle_up: 'muscle-up',
    weighted_pull_up: 'weighted pull-up',
    overhead_press: 'overhead press',
    clean_and_jerk: 'clean & jerk',
    snow_sports: 'snow sports',
    row_erg: 'rowing erg',
    air_bike: 'air bike',
    stationary_bike: 'stationary bike',
    running_road: 'road/track running',
    cycling_outdoor: 'outdoor cycling',
  };
  return labels[value] ?? humanize(value);
}

function formatConstraintArea(value: string) {
  const labels: Record<string, string> = {
    lower_back: 'lower back',
    neck: 'neck',
    shoulder: 'shoulder',
    knee: 'knee',
    hip: 'hip',
    wrist_elbow: 'wrist/elbow',
    heart: 'heart',
    lungs: 'lungs/breathing',
    other: 'other constraint',
  };
  return labels[value] ?? humanize(value);
}

function formatPainTiming(value: string) {
  const labels: Record<string, string> = {
    under_load: 'under load',
    daily_life: 'during daily life',
    recent_injury: 'recent injury',
  };
  return labels[value] ?? humanize(value);
}

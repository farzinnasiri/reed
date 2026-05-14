import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { summarizeTrainingWindow } from '../domains/trainingKnowledge/trainingHistory';
import { summarizeConsistency } from '../domains/trainingKnowledge/consistency';
import { buildBodyweightTrend } from '../domains/trainingKnowledge/bodyStatus';
import { calculatePersonalRecords, calculateRecordHighlights } from '../domains/trainingKnowledge/personalRecords';
import type { RecipeKey } from '../domains/workout/recipes';

const DAY_MS = 24 * 60 * 60 * 1000;
const TRAJECTORY_WINDOW_DAYS = 84;
const CURRENT_STATE_WINDOW_DAYS = 14;
const BODY_WINDOW_DAYS = 120;
const RECORD_WINDOW_DAYS = 365;
const JOURNEY_VERSION = 1;

type JourneyTrigger = 'session_ended' | 'onboarding_updated' | 'assessment_updated' | 'body_metrics_updated';
type SignalTrend = 'up' | 'flat' | 'down';
type SignalConfidence = 'low' | 'medium' | 'high';

type JourneySignal = {
  value: number;
  trend: SignalTrend;
  confidence: SignalConfidence;
  windowDays: number;
  evidenceCount: number;
  lastMaterialChangeAt: number | null;
};

type JourneySnapshotInput = {
  profileId: Id<'profiles'>;
  trigger: JourneyTrigger;
  version: number;
  createdAt: number;
  fingerprint: string;
  baseline: {
    summary: string;
    topGoals: string[];
    constraints: string[];
    recovery: string;
    trainingAge: string;
    weeklyTarget: string;
    equipment: string[];
    anchorSummary: string[];
  };
  trajectory: {
    summary: string;
    windowDays: number;
    completedSessions: number;
    activeDays: number;
    topExercises: string[];
    recordHighlights: string[];
    bodyweightDeltaKg: number | null;
  };
  currentState: {
    summary: string;
    windowDays: number;
    recentSessions: number;
    recentSetCount: number;
    recentWorkFocus: string[];
    latestSessionAt: number | null;
    latestSessionSummary: string | null;
  };
  profileContext: {
    identity: {
      age: number | null;
      displayName: string | null;
      genderIdentity: string | null;
    };
    body: {
      bodyFatPercent: number | null;
      bodyType: string | null;
      heightCm: number;
      restingHeartRate: number | null;
      skeletalMuscleMassKg: number | null;
      weightKg: number | null;
    };
    lifestyle: {
      dailyMovement: string | null;
      eatingRoutine: string | null;
      idleMovement: string | null;
      usualSteps: string | null;
    };
    trainingReality: {
      effort: string;
      equipmentAccess: string[];
      sessionDuration: string;
      trainingAge: string;
      trainingStyles: string[];
      weeklySessions: string;
    };
    goals: Array<{
      detail: string | null;
      focusAreas: string[];
      goal: string;
    }>;
    constraints: Array<{
      area: string;
      customDetail: string | null;
      severity: string | null;
      timing: string | null;
    }>;
    userNotes: string | null;
  };
  watchouts: string[];
  signals: {
    consistency: JourneySignal;
    progression: JourneySignal;
    workload: JourneySignal;
    goalAlignment: JourneySignal;
    recoveryRisk: JourneySignal;
  };
  renderedContext: string;
};

export const latestForProfile = internalQuery({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('reedJourneySnapshots')
      .withIndex('by_profile_id_and_created_at', q => q.eq('profileId', args.profileId))
      .order('desc')
      .first();
  },
});

export const rebuildLatest = internalMutation({
  args: {
    profileId: v.id('profiles'),
    trigger: v.union(
      v.literal('session_ended'),
      v.literal('onboarding_updated'),
      v.literal('assessment_updated'),
      v.literal('body_metrics_updated'),
    ),
  },
  handler: async (ctx, args) => {
    const snapshot = await buildJourneySnapshot(ctx, args.profileId, args.trigger);
    const previous = await ctx.db
      .query('reedJourneySnapshots')
      .withIndex('by_profile_id_and_created_at', q => q.eq('profileId', args.profileId))
      .order('desc')
      .first();

    if (previous && !shouldAppendJourney(previous as Doc<'reedJourneySnapshots'>, snapshot)) {
      return { created: false, snapshotId: previous._id };
    }

    const snapshotId = await ctx.db.insert('reedJourneySnapshots', snapshot);
    return { created: true, snapshotId };
  },
});

async function buildJourneySnapshot(ctx: MutationCtx, profileId: Id<'profiles'>, trigger: JourneyTrigger): Promise<JourneySnapshotInput> {
  const now = Date.now();
  const profile = await ctx.db.get(profileId);
  if (!profile) throw new ConvexError('Profile not found.');

  const trainingProfile = await ctx.db
    .query('trainingProfiles')
    .withIndex('by_profile_id', q => q.eq('profileId', profileId))
    .unique();
  if (!trainingProfile) throw new ConvexError('Training profile not found.');

  const trajectoryStartAt = now - TRAJECTORY_WINDOW_DAYS * DAY_MS;
  const currentStateStartAt = now - CURRENT_STATE_WINDOW_DAYS * DAY_MS;
  const bodyStartAt = now - BODY_WINDOW_DAYS * DAY_MS;
  const recordStartAt = now - RECORD_WINDOW_DAYS * DAY_MS;

  const [sessions, trajectoryLogs, currentLogs, bodyweightPoints, latestBodyMeasurements, allRecordLogs, exercises, strengthAssessments, cardioAssessments] = await Promise.all([
    ctx.db
      .query('liveSessions')
      .withIndex('by_profile_id_and_status_and_started_at', q =>
        q.eq('profileId', profileId).eq('status', 'ended').gte('startedAt', trajectoryStartAt),
      )
      .collect(),
    ctx.db
      .query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q => q.eq('profileId', profileId).gte('loggedAt', trajectoryStartAt).lte('loggedAt', now))
      .collect(),
    ctx.db
      .query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q => q.eq('profileId', profileId).gte('loggedAt', currentStateStartAt).lte('loggedAt', now))
      .collect(),
    ctx.db
      .query('bodyMeasurements')
      .withIndex('by_profile_id_and_metric_key_and_observed_at', q =>
        q.eq('profileId', profileId).eq('metricKey', 'body_weight').gte('observedAt', bodyStartAt).lte('observedAt', now),
      )
      .collect(),
    ctx.db
      .query('bodyMeasurements')
      .withIndex('by_profile_id_and_observed_at', q => q.eq('profileId', profileId))
      .order('desc')
      .take(24),
    ctx.db
      .query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q => q.eq('profileId', profileId).gte('loggedAt', recordStartAt).lte('loggedAt', now))
      .collect(),
    ctx.db.query('exerciseCatalog').take(500),
    ctx.db
      .query('strengthAssessments')
      .withIndex('by_profile_id_and_observed_at', q => q.eq('profileId', profileId))
      .order('desc')
      .take(12),
    ctx.db
      .query('cardioAssessments')
      .withIndex('by_profile_id_and_observed_at', q => q.eq('profileId', profileId))
      .order('desc')
      .take(8),
  ]);

  const exerciseMap = new Map(exercises.map(exercise => [exercise._id, exercise]));
  const trajectorySummary = buildTrainingWindowSummary(trajectoryLogs, exerciseMap, trajectoryStartAt, now);
  const currentSummary = buildTrainingWindowSummary(currentLogs, exerciseMap, currentStateStartAt, now);
  const bodyTrend = buildBodyweightTrend({
    points: bodyweightPoints.map(point => ({ observedAt: point.observedAt, unit: point.unit, value: point.value })),
    windowStartAt: bodyStartAt,
    windowEndAt: now,
  });

  const consistency = summarizeConsistency({
    loggedAts: trajectoryLogs.map(log => log.loggedAt),
    now,
    weeklySessions: trainingProfile.trainingReality.weeklySessions,
  });

  const records = calculatePersonalRecords({
    activities: allRecordLogs.flatMap(log => mapActivityRecord(log, exerciseMap))
  });
  const recordHighlights = calculateRecordHighlights({ limit: 5, records });

  const assessmentAnchors = buildAssessmentAnchors(strengthAssessments, cardioAssessments);
  const profileContext = buildProfileContext(profile, trainingProfile, latestBodyMeasurements);
  const baseline = buildBaseline(trainingProfile, assessmentAnchors);
  const trajectory = buildTrajectory({ bodyTrend, recordHighlights, sessions, trajectoryLogs, trajectorySummary });
  const currentState = buildCurrentState({ currentSummary, sessions });
  const watchouts = buildWatchouts({ consistency, currentSummary, now, sessions, trainingProfile, trajectorySummary });
  const previous = await ctx.db
    .query('reedJourneySnapshots')
    .withIndex('by_profile_id_and_created_at', q => q.eq('profileId', profileId))
    .order('desc')
    .first();
  const signals = buildSignals({ consistency, currentSummary, now, previous, recordHighlights, sessions, trainingProfile, trajectorySummary });
  const renderedContext = renderJourneyContext({ baseline, currentState, profileContext, trajectory, watchouts, signals });
  const fingerprint = simpleHash(JSON.stringify({ baseline, currentState, profileContext, trajectory, watchouts, signals }));

  return {
    profileId,
    trigger,
    version: JOURNEY_VERSION,
    createdAt: now,
    fingerprint,
    baseline,
    trajectory,
    currentState,
    profileContext,
    watchouts,
    signals,
    renderedContext,
  };
}

function buildTrainingWindowSummary(
  logs: Doc<'activityLogs'>[],
  exerciseMap: Map<Id<'exerciseCatalog'>, Doc<'exerciseCatalog'>>,
  windowStartAt: number,
  now: number,
) {
  return summarizeTrainingWindow({
    exercises: Array.from(exerciseMap.values()).map(exercise => ({
      exerciseCatalogId: exercise._id,
      exerciseName: exercise.name,
      isCardio: exercise.isCardio,
      mainMuscleGroups: exercise.mainMuscleGroups,
    })),
    logs: logs.map(log => ({
      derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
      exerciseCatalogId: log.exerciseCatalogId,
      loggedAt: log.loggedAt,
      metrics: log.metrics,
      recipeKey: log.recipeKey,
      source: log.source,
    })),
    now,
    windowStartAt,
    windowEndAt: now,
  });
}

function buildProfileContext(
  profile: Doc<'profiles'>,
  trainingProfile: Doc<'trainingProfiles'>,
  latestBodyMeasurements: Doc<'bodyMeasurements'>[],
): JourneySnapshotInput['profileContext'] {
  const latestBodyByMetric = new Map<string, Doc<'bodyMeasurements'>>();
  for (const measurement of latestBodyMeasurements) {
    if (!latestBodyByMetric.has(measurement.metricKey)) latestBodyByMetric.set(measurement.metricKey, measurement);
  }

  const genderIdentity = trainingProfile.baseline.genderIdentity ?? trainingProfile.startingPoint?.genderIdentity ?? null;

  return {
    identity: {
      age: getAge(trainingProfile.baseline.birthYear, trainingProfile.baseline.birthMonth, trainingProfile.baseline.birthDay),
      displayName: profile.displayName?.trim() || null,
      genderIdentity: genderIdentity && genderIdentity !== 'prefer_not_to_say' ? formatGenderIdentity(genderIdentity) : null,
    },
    body: {
      bodyFatPercent: latestBodyByMetric.get('body_fat_percent')?.value ?? null,
      bodyType: trainingProfile.startingPoint?.bodyType ? formatBodyType(trainingProfile.startingPoint.bodyType) : null,
      heightCm: trainingProfile.baseline.heightCm,
      restingHeartRate: latestBodyByMetric.get('resting_heart_rate')?.value ?? null,
      skeletalMuscleMassKg: latestBodyByMetric.get('skeletal_muscle_mass')?.value ?? null,
      weightKg: latestBodyByMetric.get('body_weight')?.value ?? null,
    },
    lifestyle: {
      dailyMovement: trainingProfile.lifestyle?.dailyMovement ? formatDailyMovement(trainingProfile.lifestyle.dailyMovement) : null,
      eatingRoutine: trainingProfile.lifestyle?.eatingRoutine ? formatEatingRoutine(trainingProfile.lifestyle.eatingRoutine) : null,
      idleMovement: trainingProfile.lifestyle?.idleMovement ? formatIdleMovement(trainingProfile.lifestyle.idleMovement) : null,
      usualSteps: trainingProfile.lifestyle?.usualSteps ? formatUsualSteps(trainingProfile.lifestyle.usualSteps) : null,
    },
    trainingReality: {
      effort: formatEffort(trainingProfile.trainingReality.effort),
      equipmentAccess: trainingProfile.trainingReality.equipmentAccess.map(formatEquipment),
      sessionDuration: formatSessionDuration(trainingProfile.trainingReality.sessionDuration),
      trainingAge: formatTrainingAge(trainingProfile.trainingReality.trainingAge),
      trainingStyles: trainingProfile.trainingReality.trainingStyles.map(formatTrainingStyle),
      weeklySessions: formatWeeklyTarget(trainingProfile.trainingReality.weeklySessions),
    },
    goals: trainingProfile.rankedGoals.map(goal => formatGoalContext(goal, trainingProfile.goalDetails[goal] ?? null)),
    constraints: trainingProfile.constraints.areas.map(area => {
      const detail = trainingProfile.constraints.details[area] ?? null;
      return {
        area: formatConstraintArea(area, detail),
        customDetail: detail?.customDetail ?? null,
        severity: detail?.severity ? formatSeverity(detail.severity) : null,
        timing: detail?.timing ? formatPainTiming(detail.timing) : null,
      };
    }),
    userNotes: trainingProfile.userNotes?.trim() ? trainingProfile.userNotes.trim() : null,
  };
}

function buildBaseline(trainingProfile: Doc<'trainingProfiles'>, anchorSummary: string[]) {
  const topGoals = trainingProfile.rankedGoals.map(formatGoal);
  const constraints = trainingProfile.constraints.areas.map(area => formatConstraint(area, trainingProfile.constraints.details[area] ?? null));
  const equipment = trainingProfile.trainingReality.equipmentAccess.map(formatEquipment);

  return {
    summary: `${topGoals[0] ?? 'General training'} with ${formatRecovery(trainingProfile.baseline.recoveryQuality)} recovery and ${formatWeeklyTarget(trainingProfile.trainingReality.weeklySessions)} target cadence.`,
    topGoals,
    constraints,
    recovery: formatRecovery(trainingProfile.baseline.recoveryQuality),
    trainingAge: formatTrainingAge(trainingProfile.trainingReality.trainingAge),
    weeklyTarget: formatWeeklyTarget(trainingProfile.trainingReality.weeklySessions),
    equipment,
    anchorSummary,
  };
}

function buildTrajectory(input: {
  bodyTrend: ReturnType<typeof buildBodyweightTrend>;
  recordHighlights: ReturnType<typeof calculateRecordHighlights>;
  sessions: Doc<'liveSessions'>[];
  trajectoryLogs: Doc<'activityLogs'>[];
  trajectorySummary: ReturnType<typeof summarizeTrainingWindow>;
}) {
  const topExercises = input.trajectorySummary.byExercise.slice(0, 4).map(item => `${item.exerciseName} (${item.setCount} sets)`);
  const recordHighlights = input.recordHighlights.map(record => `${record.exerciseName}: ${record.label} ${record.displayValue}`);
  const activeDays = new Set(input.trajectoryLogs.map(log => new Date(log.loggedAt).toISOString().slice(0, 10))).size;
  const bodyweightDeltaKg = input.bodyTrend.delta === null ? null : round(input.bodyTrend.delta, 1);
  const summaryParts = [
    `${input.sessions.length} ended sessions in the last ${TRAJECTORY_WINDOW_DAYS} days`,
    topExercises.length > 0 ? `most work went to ${formatList(topExercises.slice(0, 2))}` : 'limited exercise distribution data',
    recordHighlights.length > 0 ? `${recordHighlights.length} notable record signals` : 'no strong record movement yet',
  ];

  return {
    summary: summaryParts.join('; '),
    windowDays: TRAJECTORY_WINDOW_DAYS,
    completedSessions: input.sessions.length,
    activeDays,
    topExercises,
    recordHighlights,
    bodyweightDeltaKg,
  };
}

function buildCurrentState(input: {
  currentSummary: ReturnType<typeof summarizeTrainingWindow>;
  sessions: Doc<'liveSessions'>[];
}) {
  const recentWorkFocus = input.currentSummary.byExercise.slice(0, 3).map(item => item.exerciseName);
  const latestActivity = input.currentSummary.recentActivities[0] ?? null;
  const latestSessionAt = input.sessions.length > 0
    ? input.sessions.reduce((max, session) => Math.max(max, session.endedAt ?? session.startedAt), 0)
    : null;

  return {
    summary: input.currentSummary.activityCount > 0
      ? `${input.currentSummary.activityCount} logged sets in the last ${CURRENT_STATE_WINDOW_DAYS} days with ${recentWorkFocus.length > 0 ? formatList(recentWorkFocus) : 'no clear focus'} leading.`
      : `No logged training in the last ${CURRENT_STATE_WINDOW_DAYS} days.`,
    windowDays: CURRENT_STATE_WINDOW_DAYS,
    recentSessions: countRecentSessions(input.sessions, CURRENT_STATE_WINDOW_DAYS),
    recentSetCount: input.currentSummary.activityCount,
    recentWorkFocus,
    latestSessionAt,
    latestSessionSummary: latestActivity ? `${latestActivity.exerciseName}: ${latestActivity.summary}` : null,
  };
}

function buildWatchouts(input: {
  consistency: ReturnType<typeof summarizeConsistency>;
  currentSummary: ReturnType<typeof summarizeTrainingWindow>;
  now: number;
  sessions: Doc<'liveSessions'>[];
  trainingProfile: Doc<'trainingProfiles'>;
  trajectorySummary: ReturnType<typeof summarizeTrainingWindow>;
}) {
  const watchouts: string[] = [];
  if (input.trainingProfile.constraints.areas.length > 0) {
    watchouts.push(`Respect constraints around ${formatList(input.trainingProfile.constraints.areas.map(area => formatConstraint(area, input.trainingProfile.constraints.details[area] ?? null)).slice(0, 3))}.`);
  }
  if (input.trainingProfile.baseline.recoveryQuality === 'fragile') {
    watchouts.push('Recovery baseline is fragile, so load and frequency shifts should stay conservative.');
  }
  const latestSessionAt = input.sessions.reduce<number | null>((max, session) => {
    const endedAt = session.endedAt ?? null;
    if (endedAt === null) return max;
    return max === null ? endedAt : Math.max(max, endedAt);
  }, null);
  if (latestSessionAt !== null && input.now - latestSessionAt > 10 * DAY_MS) {
    watchouts.push('Recent training gap is widening; confidence in short-term state is dropping.');
  }
  if (input.consistency.hasTrainingTarget && input.consistency.recentOnTargetRate.percent < 40) {
    watchouts.push('Cadence is currently below target, so consistency may be the limiting factor more than exercise selection.');
  }
  if (input.currentSummary.activityCount > 0 && input.trajectorySummary.byExercise.length <= 2) {
    watchouts.push('Recent work is concentrated into a narrow set of movements; broader progress signals may be incomplete.');
  }
  return watchouts;
}

function buildSignals(input: {
  consistency: ReturnType<typeof summarizeConsistency>;
  currentSummary: ReturnType<typeof summarizeTrainingWindow>;
  now: number;
  previous: Doc<'reedJourneySnapshots'> | null;
  recordHighlights: ReturnType<typeof calculateRecordHighlights>;
  sessions: Doc<'liveSessions'>[];
  trainingProfile: Doc<'trainingProfiles'>;
  trajectorySummary: ReturnType<typeof summarizeTrainingWindow>;
}) {
  const consistencyValue = input.consistency.hasTrainingTarget
    ? Math.min(100, Math.round((input.consistency.currentOnTargetWeekRun / 8) * 100))
    : 0;
  const progressionValue = Math.min(100, input.recordHighlights.length * 18 + Math.min(28, input.trajectorySummary.byExercise.length * 4));
  const workloadValue = Math.min(100, input.currentSummary.activityCount * 4 + countRecentSessions(input.sessions, CURRENT_STATE_WINDOW_DAYS) * 12);
  const goalAlignmentValue = calculateGoalAlignment(input.trainingProfile, input.trajectorySummary);
  const recoveryRiskValue = calculateRecoveryRisk(input.trainingProfile, input.currentSummary, input.sessions, input.now);

  return {
    consistency: buildSignal('consistency', consistencyValue, 84, 8, input.previous),
    progression: buildSignal('progression', progressionValue, 84, input.recordHighlights.length, input.previous),
    workload: buildSignal('workload', workloadValue, 14, input.currentSummary.activityCount, input.previous),
    goalAlignment: buildSignal('goalAlignment', goalAlignmentValue, 84, input.trajectorySummary.byExercise.length, input.previous),
    recoveryRisk: buildSignal('recoveryRisk', recoveryRiskValue, 14, input.currentSummary.activityCount, input.previous, true),
  };
}

function buildSignal(
  key: keyof Doc<'reedJourneySnapshots'>['signals'],
  value: number,
  windowDays: number,
  evidenceCount: number,
  previous: Doc<'reedJourneySnapshots'> | null,
  inverted = false,
): JourneySignal {
  const previousValue = previous?.signals[key]?.value ?? null;
  const delta = previousValue === null ? 0 : value - previousValue;
  const magnitude = Math.abs(delta);
  const trend: SignalTrend = magnitude < 6 ? 'flat' : (delta > 0 ? (inverted ? 'down' : 'up') : (inverted ? 'up' : 'down'));
  const confidence: SignalConfidence = evidenceCount >= 8 ? 'high' : evidenceCount >= 3 ? 'medium' : 'low';
  const lastMaterialChangeAt = magnitude >= 10
    ? Date.now()
    : previous?.signals[key]?.lastMaterialChangeAt ?? null;
  return { value: Math.round(value), trend, confidence, windowDays, evidenceCount, lastMaterialChangeAt };
}

function calculateGoalAlignment(trainingProfile: Doc<'trainingProfiles'>, trajectorySummary: ReturnType<typeof summarizeTrainingWindow>) {
  const topGoal = trainingProfile.rankedGoals[0] ?? null;
  if (!topGoal || trajectorySummary.byExercise.length === 0) return 50;
  const topExercises = trajectorySummary.byExercise.slice(0, 3).map(item => item.exerciseName.toLowerCase());
  if (topGoal === 'get_stronger') {
    return topExercises.some(name => /squat|bench|deadlift|press|pull/.test(name)) ? 82 : 56;
  }
  if (topGoal === 'improve_conditioning') {
    return topExercises.some(name => /run|bike|row|cardio|stair/.test(name)) ? 82 : 52;
  }
  if (topGoal === 'move_without_pain') {
    return topExercises.some(name => /mobility|rehab|carry|split|bodyweight/.test(name)) ? 76 : 58;
  }
  return 68;
}

function calculateRecoveryRisk(
  trainingProfile: Doc<'trainingProfiles'>,
  currentSummary: ReturnType<typeof summarizeTrainingWindow>,
  sessions: Doc<'liveSessions'>[],
  now: number,
) {
  let risk = trainingProfile.baseline.recoveryQuality === 'fragile' ? 70 : trainingProfile.baseline.recoveryQuality === 'mixed' ? 48 : 28;
  const recentSessions = countRecentSessions(sessions, 7);
  if (recentSessions >= 4) risk += 10;
  if (currentSummary.activityCount >= 28) risk += 8;
  const latestSessionAt = sessions.reduce<number | null>((max, session) => {
    const endedAt = session.endedAt ?? null;
    if (endedAt === null) return max;
    return max === null ? endedAt : Math.max(max, endedAt);
  }, null);
  if (latestSessionAt !== null && now - latestSessionAt > 10 * DAY_MS) risk -= 8;
  if (trainingProfile.constraints.areas.length >= 2) risk += 8;
  return clamp(risk, 0, 100);
}

function renderJourneyContext(input: {
  baseline: JourneySnapshotInput['baseline'];
  currentState: JourneySnapshotInput['currentState'];
  profileContext: JourneySnapshotInput['profileContext'];
  trajectory: JourneySnapshotInput['trajectory'];
  watchouts: string[];
  signals: JourneySnapshotInput['signals'];
}) {
  const profile = input.profileContext;
  const subject = profile.identity.displayName ?? 'This user';
  const goalLines = profile.goals.length > 0
    ? profile.goals.map((goal, index) => `${index + 1}. ${formatGoalContextLine(goal)}`)
    : ['No ranked goals captured.'];
  const constraints = profile.constraints.length > 0
    ? formatList(profile.constraints.map(formatConstraintContextLine))
    : null;
  const anchors = input.baseline.anchorSummary.length > 0
    ? `Known starting numbers include ${formatList(input.baseline.anchorSummary.slice(0, 6))}.`
    : 'Known starting numbers are limited.';
  const pronouns = getPronouns(profile);
  const recentTraining = formatRecentTrainingParagraph(subject, pronouns, input.trajectory, input.currentState);
  const coachRead = formatCoachReadParagraph(pronouns, input.signals, input.watchouts);

  return [
    `${formatIdentityPhrase(profile)} ${formatBodyPhrase(profile)} ${formatLifestylePhrase(profile)}`.replace(/\s+/g, ' ').trim(),
    '',
    formatTrainingRealityPhrase(profile),
    '',
    'His priorities are:',
    ...goalLines,
    '',
    constraints
      ? `${subject} has flagged ${constraints} constraints. Respect those when suggesting exercises, progressions, substitutions, warm-ups, or volume increases.`
      : `${subject} has not flagged pain, health, or movement constraints.`,
    '',
    anchors,
    '',
    recentTraining,
    '',
    coachRead,
    profile.userNotes ? `\nUser note: ${profile.userNotes}` : null,
  ].filter(item => item !== null).join('\n');
}

function formatIdentityPhrase(profile: JourneySnapshotInput['profileContext']) {
  const subject = profile.identity.displayName ?? 'This user';
  const details = [
    profile.identity.age !== null ? `${profile.identity.age} years old` : null,
    profile.identity.genderIdentity,
  ].filter(Boolean);

  return details.length > 0 ? `${subject} is ${details.join(', ')}.` : `${subject}'s age and gender are not specified.`;
}

function formatBodyPhrase(profile: JourneySnapshotInput['profileContext']) {
  const body = profile.body;
  const core = [`${body.heightCm} cm`, body.weightKg !== null ? `${round(body.weightKg, 1)} kg` : null].filter(isPresentString);
  const composition = [
    body.bodyType,
    body.bodyFatPercent !== null ? `${round(body.bodyFatPercent, 1)}% body fat` : null,
    body.skeletalMuscleMassKg !== null ? `${round(body.skeletalMuscleMassKg, 1)} kg skeletal muscle mass` : null,
    body.restingHeartRate !== null ? `${Math.round(body.restingHeartRate)} bpm resting heart rate` : null,
  ].filter(isPresentString);

  const coreText = core.length > 0 ? core.join(' and ') : 'body size not fully captured';
  const subject = profile.identity.displayName ?? 'They';
  const bodyType = body.bodyType ? `, with a ${body.bodyType} starting point` : '';
  const extraMetrics = composition.filter(item => item !== body.bodyType);
  const extra = extraMetrics.length > 0 ? ` Additional body markers: ${formatList(extraMetrics)}.` : '';
  return `${subject} is ${coreText}${bodyType}.${extra}`;
}

function formatLifestylePhrase(profile: JourneySnapshotInput['profileContext']) {
  const lifestyle = [
    profile.lifestyle.dailyMovement ? `normal day is ${profile.lifestyle.dailyMovement}` : null,
    profile.lifestyle.usualSteps ? `usually gets ${profile.lifestyle.usualSteps}` : null,
    profile.lifestyle.idleMovement ? `tends to be ${profile.lifestyle.idleMovement} when seated` : null,
    profile.lifestyle.eatingRoutine ? `eating routine is ${profile.lifestyle.eatingRoutine}` : null,
  ].filter(Boolean);
  return lifestyle.length > 0 ? `Outside training, ${lifestyle.join('; ')}.` : 'Lifestyle context was not captured.';
}

function formatTrainingRealityPhrase(profile: JourneySnapshotInput['profileContext']) {
  const training = profile.trainingReality;
  const style = training.trainingStyles.length > 0 ? formatList(training.trainingStyles) : 'no style selected';
  const equipment = training.equipmentAccess.length > 0 ? formatList(training.equipmentAccess) : 'no equipment context';
  const subject = profile.identity.displayName ?? 'They';
  const pronouns = getPronouns(profile);
  return `${subject} has ${training.trainingAge}. ${subject} usually trains ${training.weeklySessions} for ${training.sessionDuration} at ${training.effort} effort. ${subject} has access to ${equipment}, and ${pronouns.possessive} training style mixes ${style}.`;
}

function formatGoalContextLine(goal: JourneySnapshotInput['profileContext']['goals'][number]) {
  const detail = goal.detail ? ` — ${goal.detail}` : '';
  const focus = goal.focusAreas.length > 0 ? ` Focus areas: ${formatList(goal.focusAreas)}.` : '';
  return `${goal.goal}${detail}.${focus}`;
}

function formatConstraintContextLine(constraint: JourneySnapshotInput['profileContext']['constraints'][number]) {
  const details = [constraint.severity, constraint.timing, constraint.customDetail].filter(Boolean);
  return details.length > 0 ? `${constraint.area} (${details.join(', ')})` : constraint.area;
}

function formatRecentTrainingParagraph(
  subject: string,
  pronouns: ReturnType<typeof getPronouns>,
  trajectory: JourneySnapshotInput['trajectory'],
  currentState: JourneySnapshotInput['currentState'],
) {
  const parts = [`Over the last ${trajectory.windowDays} days, ${subject} completed ${trajectory.completedSessions} sessions`];
  if (trajectory.topExercises.length > 0) {
    parts.push(`Recent work has been concentrated around ${formatList(trajectory.topExercises.slice(0, 3))}`);
  }
  parts.push(`In the last ${currentState.windowDays} days ${pronouns.subject} logged ${currentState.recentSetCount} sets`);
  if (currentState.latestSessionSummary) parts.push(`Latest notable work was ${currentState.latestSessionSummary}`);
  if (trajectory.recordHighlights.length > 0) parts.push(`Record signals include ${formatList(trajectory.recordHighlights.slice(0, 3))}`);
  if (trajectory.bodyweightDeltaKg !== null) parts.push(`Bodyweight trend is ${signedNumber(trajectory.bodyweightDeltaKg)} kg over the recent window`);
  return `${parts.join('. ')}.`;
}

function formatCoachReadParagraph(pronouns: ReturnType<typeof getPronouns>, signals: JourneySnapshotInput['signals'], watchouts: string[]) {
  const consistency = signalNarrative('consistency', signals.consistency, 'current on-target weekly run against the 8-week UI gauge');
  const progression = signalNarrative('progression', signals.progression, 'recent PR/record signals and breadth of trained movements');
  const workload = signalNarrative('workload', signals.workload, 'logged set count and finished sessions in the last 14 days');
  const goalAlignment = signalNarrative('goal alignment', signals.goalAlignment, 'whether recent top movements match the primary training goal');
  const recoveryRisk = signalNarrative('recovery risk', signals.recoveryRisk, 'recovery baseline, recent workload, session frequency, gaps, and constraints');
  const watchoutText = watchouts.length > 0 ? ` The main watchouts are: ${watchouts.join(' ')}` : '';

  return `The current read is that ${consistency}. ${progression}. ${workload}. ${goalAlignment}. ${recoveryRisk}.${watchoutText} Coach ${pronouns.object} by making training easier to repeat before optimizing details, respecting constraints, and avoiding sudden jumps in volume or intensity when recovery risk is elevated.`;
}

function signalNarrative(label: string, signal: JourneySignal, explanation: string) {
  return `${capitalize(label)} is ${signal.value}/100, ${signal.trend}, with ${signal.confidence} confidence from ${signal.evidenceCount} evidence points, based on ${explanation}`;
}

function getPronouns(profile: JourneySnapshotInput['profileContext']) {
  if (profile.identity.genderIdentity === 'male') return { object: 'him', possessive: 'his', subject: 'he' };
  if (profile.identity.genderIdentity === 'female') return { object: 'her', possessive: 'her', subject: 'she' };
  return { object: 'them', possessive: 'their', subject: 'they' };
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function isPresentString(value: string | null | undefined): value is string {
  return Boolean(value);
}

function getAge(birthYear: number, birthMonth: number, birthDay: number) {
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const monthDiff = today.getMonth() + 1 - birthMonth;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDay)) age -= 1;
  return Number.isFinite(age) && age >= 0 ? age : null;
}

function shouldAppendJourney(previous: Doc<'reedJourneySnapshots'>, next: JourneySnapshotInput) {
  if (previous.fingerprint === next.fingerprint) return false;

  // Profile edits are explicit user intent. Even when signal scores do not move
  // enough to pass the material-change threshold, the latest journey context
  // should record the edited onboarding/profile baseline.
  if (next.trigger === 'onboarding_updated') return true;

  const changeMagnitude =
    Math.abs(previous.signals.consistency.value - next.signals.consistency.value) * 0.24 +
    Math.abs(previous.signals.progression.value - next.signals.progression.value) * 0.26 +
    Math.abs(previous.signals.workload.value - next.signals.workload.value) * 0.18 +
    Math.abs(previous.signals.goalAlignment.value - next.signals.goalAlignment.value) * 0.14 +
    Math.abs(previous.signals.recoveryRisk.value - next.signals.recoveryRisk.value) * 0.18;

  const watchoutChanged = previous.watchouts.join('|') !== next.watchouts.join('|');
  const stateChanged = previous.currentState.summary !== next.currentState.summary;
  return changeMagnitude >= 8 || watchoutChanged || stateChanged;
}

function mapActivityRecord(log: Doc<'activityLogs'>, exerciseMap: Map<Id<'exerciseCatalog'>, Doc<'exerciseCatalog'>>) {
  const exercise = exerciseMap.get(log.exerciseCatalogId);
  if (!exercise) return [];
  return [{
    activityLogId: log._id as string,
    derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
    exerciseCatalogId: log.exerciseCatalogId as string,
    exerciseName: exercise.name,
    loggedAt: log.loggedAt,
    metrics: log.metrics,
    profileId: log.profileId as string,
    recipeKey: log.recipeKey as RecipeKey,
    sessionId: log.sessionId ? log.sessionId as string : null,
    warmup: log.warmup,
  }];
}

function buildAssessmentAnchors(
  strengthAssessments: Doc<'strengthAssessments'>[],
  cardioAssessments: Doc<'cardioAssessments'>[],
) {
  const latestStrengthByAnchor = new Map<string, Doc<'strengthAssessments'>>();
  for (const assessment of strengthAssessments) {
    if (!latestStrengthByAnchor.has(assessment.anchorKey)) latestStrengthByAnchor.set(assessment.anchorKey, assessment);
  }

  const latestCardioByAnchor = new Map<string, Doc<'cardioAssessments'>>();
  for (const assessment of cardioAssessments) {
    if (!latestCardioByAnchor.has(assessment.anchorKey)) latestCardioByAnchor.set(assessment.anchorKey, assessment);
  }

  return [
    ...Array.from(latestStrengthByAnchor.values()).map(formatStrengthAnchor),
    ...Array.from(latestCardioByAnchor.values()).map(formatCardioAnchor),
  ].filter(Boolean).slice(0, 6);
}

function formatStrengthAnchor(assessment: Doc<'strengthAssessments'>) {
  const name = formatAnchorKey(assessment.anchorKey);
  if (assessment.kind === 'bodyweight_reps') return `${name}: ${assessment.reps} bodyweight reps`;
  if (assessment.loadKg !== null) return `${name}: ${assessment.loadKg} kg x ${assessment.reps}`;
  if (assessment.estimatedOneRepMaxKg !== null) return `${name}: est. ${Math.round(assessment.estimatedOneRepMaxKg)} kg 1RM`;
  return `${name}: ${assessment.reps} reps`;
}

function formatCardioAnchor(assessment: Doc<'cardioAssessments'>) {
  const name = formatAnchorKey(assessment.anchorKey);
  if (assessment.durationSeconds !== null && assessment.distanceMeters !== null) return `${name}: ${formatDuration(assessment.durationSeconds)} for ${assessment.distanceMeters} m`;
  if (assessment.durationSeconds !== null) return `${name}: ${formatDuration(assessment.durationSeconds)}`;
  if (assessment.floors !== null) return `${name}: ${assessment.floors} floors`;
  return name;
}

function formatAnchorKey(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function countRecentSessions(sessions: Doc<'liveSessions'>[], days: number) {
  const cutoff = Date.now() - days * DAY_MS;
  return sessions.filter(session => (session.endedAt ?? 0) >= cutoff).length;
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
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatGoalContext(goal: string, detail: { customDetail: string | null; detail: string | null; focusAreas: string[] } | null) {
  return {
    goal: formatGoal(goal),
    detail: detail?.detail ? formatGoalDetail(detail.detail, detail.customDetail) : null,
    focusAreas: detail?.focusAreas.map(area => formatGoalDetail(area, detail.customDetail)) ?? [],
  };
}

function formatGoalDetail(value: string, customDetail?: string | null) {
  if (value === 'other') return customDetail?.trim() || 'other';
  return value.replace(/_/g, ' ');
}

function formatConstraint(area: string, detail: { customDetail: string | null; severity: string | null; timing: string | null } | null) {
  const base = formatConstraintArea(area, detail);
  return detail?.severity ? `${base} (${formatSeverity(detail.severity)})` : base;
}

function formatConstraintArea(area: string, detail: { customDetail: string | null } | null) {
  const labels: Record<string, string> = {
    lower_back: 'lower back',
    neck: 'neck',
    shoulder: 'shoulder',
    knee: 'knee',
    hip: 'hip',
    wrist_elbow: 'wrist/elbow',
    heart: 'heart',
    lungs: 'lungs',
    other: detail?.customDetail ?? 'other',
  };
  return labels[area] ?? area.replace(/_/g, ' ');
}

function formatSeverity(value: string) {
  return value.replace(/_/g, ' ');
}

function formatPainTiming(value: string) {
  const labels: Record<string, string> = {
    daily_life: 'daily life',
    recent_injury: 'recent injury',
    under_load: 'under load',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatEquipment(value: string) {
  const labels: Record<string, string> = {
    full_gym: 'full gym',
    calisthenics_park: 'calisthenics park',
    home_equipment: 'home equipment',
    crowded_gym: 'crowded gym',
    no_fixed_equipment: 'no fixed equipment',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function buildProfileContextSummary(trainingProfile: Doc<'trainingProfiles'>) {
  const parts: string[] = [];
  const bodyType = trainingProfile.startingPoint?.bodyType;
  const dailyMovement = trainingProfile.lifestyle?.dailyMovement;
  const usualSteps = trainingProfile.lifestyle?.usualSteps;

  if (bodyType) parts.push(`starting point: ${formatBodyType(bodyType)}`);
  if (dailyMovement) parts.push(`day: ${formatDailyMovement(dailyMovement)}`);
  if (usualSteps) parts.push(`steps: ${formatUsualSteps(usualSteps)}`);

  return parts.length > 0 ? `Profile context — ${parts.join('; ')}.` : '';
}

function buildProfileContextAnchors(trainingProfile: Doc<'trainingProfiles'>) {
  const anchors: string[] = [];
  const genderIdentity = trainingProfile.baseline.genderIdentity ?? trainingProfile.startingPoint?.genderIdentity;
  const idleMovement = trainingProfile.lifestyle?.idleMovement;
  const eatingRoutine = trainingProfile.lifestyle?.eatingRoutine;

  if (genderIdentity && genderIdentity !== 'prefer_not_to_say') anchors.push(`gender identity: ${formatGenderIdentity(genderIdentity)}`);
  if (idleMovement) anchors.push(`sitting still: ${formatIdleMovement(idleMovement)}`);
  if (eatingRoutine) anchors.push(`eating routine: ${formatEatingRoutine(eatingRoutine)}`);

  return anchors;
}

function formatBodyType(value: string) {
  const labels: Record<string, string> = {
    athletic: 'athletic build',
    bulky: 'bigger build',
    high_fat: 'higher body fat',
    skinny: 'lean build',
    skinny_fat: 'lean-with-belly-fat',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatGenderIdentity(value: string) {
  const labels: Record<string, string> = {
    female: 'female',
    male: 'male',
    nonbinary: 'non-binary',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatDailyMovement(value: string) {
  const labels: Record<string, string> = {
    mostly_sitting: 'mostly sitting',
    on_feet: 'often on feet',
    walks_a_lot: 'often out and about',
    physical_job: 'physical job',
    restless: 'restless',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatUsualSteps(value: string) {
  const labels: Record<string, string> = {
    not_sure: 'unknown',
    under_4k: 'under 4k daily',
    four_to_8k: '4k-8k steps/day',
    eight_to_12k: '8k-12k steps/day',
    over_12k: '12k+ steps/day',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatIdleMovement(value: string) {
  const labels: Record<string, string> = {
    mostly_still: 'mostly still',
    fidget_sometimes: 'some fidgeting',
    always_moving: 'always moving',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatEatingRoutine(value: string) {
  const labels: Record<string, string> = {
    consistent: 'pretty consistent',
    hit_or_miss: 'hit or miss',
    not_sure: 'not sure',
    often_overeat: 'often overeat',
    often_under_eat: 'often under-eat',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatRecovery(value: string) {
  return value.replace(/_/g, ' ');
}

function formatTrainingAge(value: string) {
  const labels: Record<string, string> = {
    starting: 'starting out',
    under_6_months: 'under 6 months training age',
    six_to_18_months: '6-18 months training age',
    over_18_months: '18+ months training age',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatTrainingStyle(value: string) {
  const labels: Record<string, string> = {
    calisthenics: 'calisthenics',
    cardio: 'cardio',
    classic_gym: 'classic gym training',
    mobility_rehab: 'mobility/rehab',
    sport_support: 'sport support',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatEffort(value: string) {
  const labels: Record<string, string> = {
    easy: 'easy',
    moderate: 'moderate',
    hard: 'hard',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatSessionDuration(value: string) {
  const labels: Record<string, string> = {
    under_45: 'under 45 minutes',
    fortyfive_to_75: '45-75 minutes',
    over_75: 'over 75 minutes',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatWeeklyTarget(value: string) {
  const labels: Record<string, string> = {
    one_to_two: '1-2 active days per week',
    two_to_four: '2-4 active days per week',
    four_plus: '4+ active days per week',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatList(values: string[]) {
  if (values.length === 0) return 'none';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function signalLine(signal: JourneySignal) {
  return `${signal.value}/100 (${signal.trend}, ${signal.confidence} confidence, ${signal.evidenceCount} evidence).`;
}

function signedNumber(value: number) {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

function round(value: number, decimals = 0) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return `h${(hash >>> 0).toString(16)}`;
}

import { onboardingCoachingContext, recoveryDescription, startingWeeklyTarget, VALUE_LABELS, VALUE_GUIDANCE, PAIN_LABELS, regionLabel } from '../domains/profile/onboarding';
import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { summarizeTrainingWindow } from '../domains/trainingKnowledge/trainingHistory';
import type { summarizeConsistency } from '../domains/trainingKnowledge/consistency';
import { readProfileConsistency } from './consistencyReader';
import { localDayNumber } from './localCalendar';
import { buildBodyweightTrend } from '../domains/trainingKnowledge/bodyStatus';
import { calculatePersonalRecords, calculateRecordHighlights } from '../domains/trainingKnowledge/personalRecords';
import type { RecipeKey } from '../domains/workout/recipes';

const DAY_MS = 24 * 60 * 60 * 1000;
const TRAJECTORY_WINDOW_DAYS = 84;
const CURRENT_STATE_WINDOW_DAYS = 14;
const BODY_WINDOW_DAYS = 120;
const RECORD_WINDOW_DAYS = 365;
const JOURNEY_VERSION = 3;
const SESSION_EVIDENCE_LIMIT = 100;
const TRAJECTORY_LOG_LIMIT = 1000;
const CURRENT_LOG_LIMIT = 500;
const BODY_POINT_LIMIT = 200;
const RECORD_LOG_LIMIT = 2000;
const EVIDENCE_LIMIT_NOTE = 'Evidence limit reached: session, set, activity-day and record summaries use bounded recent samples and may undercount. Weekly Consistency active days and the exact weekly goal remain complete.';

type JourneyTrigger = 'session_ended' | 'session_notes_updated' | 'onboarding_updated' | 'assessment_updated' | 'body_metrics_updated';

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
    onboardingContext: string;
    identity: {
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
  };
  watchouts: string[];
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
      v.literal('session_notes_updated'),
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

  const trajectoryStartAt = effectiveWindowStart(profile._creationTime, now, TRAJECTORY_WINDOW_DAYS);
  const currentStateStartAt = effectiveWindowStart(profile._creationTime, now, CURRENT_STATE_WINDOW_DAYS);
  const bodyStartAt = effectiveWindowStart(profile._creationTime, now, BODY_WINDOW_DAYS);
  const recordStartAt = effectiveWindowStart(profile._creationTime, now, RECORD_WINDOW_DAYS);
  const trajectoryWindowDays = daysBetween(trajectoryStartAt, now);
  const currentStateWindowDays = daysBetween(currentStateStartAt, now);

  const [sessionRows, trajectoryRows, currentRows, bodyRows, latestBodyMeasurements, recordRows, strengthAssessments, cardioAssessments] = await Promise.all([
    ctx.db
      .query('liveSessions')
      .withIndex('by_profile_id_and_status_and_started_at', q =>
        q.eq('profileId', profileId).eq('status', 'ended').gte('startedAt', trajectoryStartAt).lte('startedAt', now),
      )
      .order('desc').take(SESSION_EVIDENCE_LIMIT + 1),
    ctx.db
      .query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q => q.eq('profileId', profileId).gte('loggedAt', trajectoryStartAt).lte('loggedAt', now))
      .order('desc').take(TRAJECTORY_LOG_LIMIT + 1),
    ctx.db
      .query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q => q.eq('profileId', profileId).gte('loggedAt', currentStateStartAt).lte('loggedAt', now))
      .order('desc').take(CURRENT_LOG_LIMIT + 1),
    ctx.db
      .query('bodyMeasurements')
      .withIndex('by_profile_id_and_metric_key_and_observed_at', q =>
        q.eq('profileId', profileId).eq('metricKey', 'body_weight').gte('observedAt', bodyStartAt).lte('observedAt', now),
      )
      .order('desc').take(BODY_POINT_LIMIT + 1),
    ctx.db
      .query('bodyMeasurements')
      .withIndex('by_profile_id_and_observed_at', q => q.eq('profileId', profileId))
      .order('desc')
      .take(24),
    ctx.db
      .query('activityLogs')
      .withIndex('by_profile_id_and_logged_at', q => q.eq('profileId', profileId).gte('loggedAt', recordStartAt).lte('loggedAt', now))
      .order('desc').take(RECORD_LOG_LIMIT + 1),
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

  const sessions = sessionRows.slice(0, SESSION_EVIDENCE_LIMIT);
  const trajectoryLogs = trajectoryRows.slice(0, TRAJECTORY_LOG_LIMIT);
  const currentLogs = currentRows.slice(0, CURRENT_LOG_LIMIT);
  const bodyweightPoints = bodyRows.slice(0, BODY_POINT_LIMIT);
  const allRecordLogs = recordRows.slice(0, RECORD_LOG_LIMIT);
  const evidenceIsLimited = sessionRows.length > SESSION_EVIDENCE_LIMIT || trajectoryRows.length > TRAJECTORY_LOG_LIMIT
    || currentRows.length > CURRENT_LOG_LIMIT || bodyRows.length > BODY_POINT_LIMIT || recordRows.length > RECORD_LOG_LIMIT;
  const exerciseIds = new Set([...trajectoryLogs, ...currentLogs, ...allRecordLogs].map(log => log.exerciseCatalogId));
  const exerciseRows = await Promise.all([...exerciseIds].map(id => ctx.db.get(id)));
  const exerciseMap = new Map(exerciseRows.flatMap(exercise => exercise ? [[exercise._id, exercise] as const] : []));
  const trajectorySummary = buildTrainingWindowSummary(trajectoryLogs, exerciseMap, trajectoryStartAt, now);
  const currentSummary = buildTrainingWindowSummary(currentLogs, exerciseMap, currentStateStartAt, now);
  const bodyTrend = buildBodyweightTrend({
    points: bodyweightPoints.map(point => ({ observedAt: point.observedAt, unit: point.unit, value: point.value })),
    windowStartAt: bodyStartAt,
    windowEndAt: now,
  });

  const consistency = await readProfileConsistency(ctx, profileId, now);

  const records = calculatePersonalRecords({
    activities: allRecordLogs.flatMap(log => mapActivityRecord(log, exerciseMap))
  });
  const recordHighlights = calculateRecordHighlights({ limit: 5, records });

  const assessmentAnchors = buildAssessmentAnchors(strengthAssessments, cardioAssessments);
  const profileContext = buildProfileContext(profile, trainingProfile, latestBodyMeasurements);
  const baseline = buildBaseline(trainingProfile, assessmentAnchors);
  const trajectory = buildTrajectory({ bodyTrend, recordHighlights, sessions, trajectoryLogs, trajectorySummary, windowDays: trajectoryWindowDays, timeZone: consistency.timeZone });
  const currentState = buildCurrentState({ currentStateStartAt, currentSummary, sessions, windowDays: currentStateWindowDays });
  const watchouts = buildWatchouts({ consistency, currentSummary, now, sessions, trainingProfile, trajectorySummary });
  const renderedContext = renderJourneyContext({ baseline, currentState, profileContext, trajectory, watchouts })
    + (evidenceIsLimited ? `\n${EVIDENCE_LIMIT_NOTE}` : '');
  const fingerprint = simpleHash(JSON.stringify({ baseline, currentState, profileContext, trajectory, watchouts, evidenceIsLimited }));

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
  stored: Doc<'trainingProfiles'>,
  latestBodyMeasurements: Doc<'bodyMeasurements'>[],
): JourneySnapshotInput['profileContext'] {
  const latestBodyByMetric = new Map<string, Doc<'bodyMeasurements'>>();
  for (const measurement of latestBodyMeasurements) {
    if (!latestBodyByMetric.has(measurement.metricKey)) latestBodyByMetric.set(measurement.metricKey, measurement);
  }

  const answers = stored.onboarding;
  if (!answers) throw new Error('Complete onboarding first.');
    return {
      onboardingContext: onboardingCoachingContext(answers),
      identity: { displayName: profile.displayName?.trim() || null, genderIdentity: answers.sex === 'male' || answers.sex === 'female' ? answers.sex : null },
      body: { bodyFatPercent: latestBodyByMetric.get('body_fat_percent')?.value ?? null, bodyType: formatBodyType(answers.shape), heightCm: answers.heightCm, restingHeartRate: latestBodyByMetric.get('resting_heart_rate')?.value ?? null, skeletalMuscleMassKg: latestBodyByMetric.get('skeletal_muscle_mass')?.value ?? null, weightKg: latestBodyByMetric.get('body_weight')?.value ?? answers.weightKg },
    };
  }

function buildBaseline(stored: Doc<'trainingProfiles'>, anchorSummary: string[]) {
  const a = stored.onboarding;
  if (!a) throw new Error('Complete onboarding first.');
  const topGoals = a.values.map(value => VALUE_LABELS[value]);
  const target = startingWeeklyTarget(a);
  return { summary: `${a.practices.map(p => `${p.label}: level ${p.level}/4`).join('; ')}.`, topGoals, constraints: a.discomfort.map(p => `${regionLabel.get(p.regionId)}: ${PAIN_LABELS[p.intensity]}`), recovery: recoveryDescription(a), trainingAge: 'not asked', weeklyTarget: target === null ? 'no days scheduled' : `${target} active days per week`, equipment: [], anchorSummary };
}

function buildTrajectory(input: {
  bodyTrend: ReturnType<typeof buildBodyweightTrend>;
  recordHighlights: ReturnType<typeof calculateRecordHighlights>;
  sessions: Doc<'liveSessions'>[];
  trajectoryLogs: Doc<'activityLogs'>[];
  trajectorySummary: ReturnType<typeof summarizeTrainingWindow>;
  windowDays: number;
  timeZone: string;
}) {
  const topExercises = input.trajectorySummary.byExercise.slice(0, 4).map(item => `${item.exerciseName} (${item.setCount} sets)`);
  const recordHighlights = input.recordHighlights.map(record => `${record.exerciseName}: ${record.label} ${record.displayValue}`);
  const activeDays = new Set(input.trajectoryLogs.map(log => localDayNumber(log.loggedAt, input.timeZone))).size;
  const bodyweightDeltaKg = input.bodyTrend.delta === null ? null : round(input.bodyTrend.delta, 1);
  const summaryParts = [
    `${input.sessions.length} ended sessions in ${formatWindowLabel(input.windowDays, TRAJECTORY_WINDOW_DAYS)}`,
    topExercises.length > 0 ? `most work went to ${formatList(topExercises.slice(0, 2))}` : 'limited exercise distribution data',
    recordHighlights.length > 0 ? `${recordHighlights.length} notable record signals` : 'no strong record movement yet',
  ];

  return {
    summary: summaryParts.join('; '),
    windowDays: input.windowDays,
    completedSessions: input.sessions.length,
    activeDays,
    topExercises,
    recordHighlights,
    bodyweightDeltaKg,
  };
}

function buildCurrentState(input: {
  currentStateStartAt: number;
  currentSummary: ReturnType<typeof summarizeTrainingWindow>;
  sessions: Doc<'liveSessions'>[];
  windowDays: number;
}) {
  const recentWorkFocus = input.currentSummary.byExercise.slice(0, 3).map(item => item.exerciseName);
  const latestActivity = input.currentSummary.recentActivities[0] ?? null;
  const latestSessionAt = input.sessions.length > 0
    ? input.sessions.reduce((max, session) => Math.max(max, session.endedAt ?? session.startedAt), 0)
    : null;

  return {
    summary: input.currentSummary.activityCount > 0
      ? `${input.currentSummary.activityCount} logged sets in ${formatWindowLabel(input.windowDays, CURRENT_STATE_WINDOW_DAYS)} with ${recentWorkFocus.length > 0 ? formatList(recentWorkFocus) : 'no clear focus'} leading.`
      : `No logged training in ${formatWindowLabel(input.windowDays, CURRENT_STATE_WINDOW_DAYS)}.`,
    windowDays: input.windowDays,
    recentSessions: countSessionsSince(input.sessions, input.currentStateStartAt),
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
  if (input.trainingProfile.onboarding) {
    const answers = input.trainingProfile.onboarding;
    if (answers.discomfort.length) watchouts.push(`Self-reported discomfort: ${answers.discomfort.map(p => `${regionLabel.get(p.regionId)} (${PAIN_LABELS[p.intensity]})`).join(', ')}. Clarify current symptoms before loading these areas.`);
    if (answers.sleep === 0 || (answers.sleepQuality !== null && answers.sleepQuality <= 1)) watchouts.push('Reported sleep is limited or disrupted; keep load changes conservative.');
    if (answers.values.includes('longevity')) watchouts.push(VALUE_GUIDANCE.longevity);
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

function renderJourneyContext(input: {
  baseline: JourneySnapshotInput['baseline'];
  currentState: JourneySnapshotInput['currentState'];
  profileContext: JourneySnapshotInput['profileContext'];
  trajectory: JourneySnapshotInput['trajectory'];
  watchouts: string[];
}) {
  const profile = input.profileContext;
  const subject = profile.identity.displayName ?? 'This user';
  const anchors = input.baseline.anchorSummary.length > 0
    ? `Known starting numbers include ${formatList(input.baseline.anchorSummary.slice(0, 6))}.`
    : 'Known starting numbers are limited.';
  const pronouns = getPronouns(profile);
  const recentTraining = formatRecentTrainingParagraph(subject, pronouns, input.trajectory, input.currentState);
  const parts = [
    `${subject}. ${formatBodyPhrase(profile)}`,
    profile.onboardingContext,
    recentTraining,
  ];
  if (input.watchouts.length > 0) parts.push(`Watchouts: ${input.watchouts.join(' ')}`);
  parts.push(anchors);
  return parts.join('\n\n');
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

function formatRecentTrainingParagraph(
  subject: string,
  pronouns: ReturnType<typeof getPronouns>,
  trajectory: JourneySnapshotInput['trajectory'],
  currentState: JourneySnapshotInput['currentState'],
) {
  const parts = [`Over ${formatWindowLabel(trajectory.windowDays, TRAJECTORY_WINDOW_DAYS)}, ${subject} completed ${trajectory.completedSessions} sessions`];
  if (trajectory.topExercises.length > 0) {
    parts.push(`Recent work has been concentrated around ${formatList(trajectory.topExercises.slice(0, 3))}`);
  }
  parts.push(`In ${formatWindowLabel(currentState.windowDays, CURRENT_STATE_WINDOW_DAYS)} ${pronouns.subject} logged ${currentState.recentSetCount} sets`);
  if (currentState.latestSessionSummary) parts.push(`Latest notable work was ${currentState.latestSessionSummary}`);
  if (trajectory.recordHighlights.length > 0) parts.push(`Record signals include ${formatList(trajectory.recordHighlights.slice(0, 3))}`);
  if (trajectory.bodyweightDeltaKg !== null) parts.push(`Bodyweight trend is ${signedNumber(trajectory.bodyweightDeltaKg)} kg over the recent window`);
  return `${parts.join('. ')}.`;
}

function getPronouns(profile: JourneySnapshotInput['profileContext']) {
  if (profile.identity.genderIdentity === 'male') return { object: 'him', possessive: 'his', subject: 'he' };
  if (profile.identity.genderIdentity === 'female') return { object: 'her', possessive: 'her', subject: 'she' };
  return { object: 'them', possessive: 'their', subject: 'they' };
}

function isPresentString(value: string | null | undefined): value is string {
  return Boolean(value);
}

function shouldAppendJourney(previous: Doc<'reedJourneySnapshots'>, next: JourneySnapshotInput) {
  return previous.fingerprint !== next.fingerprint;
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
    setOutcome: log.setOutcomeDetails ?? null,
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

function countSessionsSince(sessions: Doc<'liveSessions'>[], startAt: number) {
  return sessions.filter(session => (session.endedAt ?? session.startedAt) >= startAt).length;
}

function effectiveWindowStart(profileCreatedAt: number, now: number, maxWindowDays: number) {
  return Math.max(profileCreatedAt, now - maxWindowDays * DAY_MS);
}

function daysBetween(startAt: number, endAt: number) {
  return Math.max(1, Math.ceil((endAt - startAt) / DAY_MS));
}

function formatWindowLabel(windowDays: number, maxWindowDays: number) {
  if (windowDays >= maxWindowDays) {
    if (maxWindowDays === 84) return 'the last 12 weeks (84 days)';
    if (maxWindowDays === 14) return 'the last 2 weeks (14 days)';
    return `the last ${maxWindowDays} days`;
  }
  return `the ${windowDays} ${windowDays === 1 ? 'day' : 'days'} since signup`;
}

function formatBodyType(value: string) {
  const labels: Record<string, string> = {
    athletic_muscular: 'athletic muscular starting point',
    average: 'average starting point',
    average_lean: 'average lean starting point',
    high_fat: 'higher body fat',
    larger_high_fat: 'larger higher-body-fat starting point',
    lean: 'lean starting point',
    muscular_solid: 'muscular solid starting point',
    soft_middle: 'soft-middle starting point',
    very_lean: 'very lean starting point',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

function formatList(values: string[]) {
  if (values.length === 0) return 'none';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function signedNumber(value: number) {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

function round(value: number, decimals = 0) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }
  return `h${(hash >>> 0).toString(16)}`;
}

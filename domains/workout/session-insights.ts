import {
  getComparisonScalarForRecipe,
  getRecipeDefinition,
  roundMetric,
  summarizeMetrics,
  type RecipeKey,
} from './recipes';
import { formatCompactNumber } from './number-format';
import {
  getSetRepCount,
  getSetVolume,
  resolveWeeklyGranularMuscleGroups,
  resolveWeeklyMuscleGroups,
  weeklyGranularMuscleGroupLabels,
  weeklyMuscleGroupLabels,
  type WeeklyGranularMuscleGroupId,
  type WeeklyMuscleGroupId,
} from './weekly-muscle-stats';

type SessionInsightsExercise = {
  exerciseCatalogId: string;
  exerciseClass: string;
  exerciseName: string;
  isCardio: boolean;
  isHold: boolean;
  mainMuscleGroups: string[];
  movementPatterns: string[];
  recipeKey: RecipeKey;
  sessionExerciseId: string;
};

type SessionInsightsLog = {
  derivedBodyweightKg?: number | null;
  derivedEffectiveLoadKg?: number | null;
  loggedAt: number;
  metrics: Record<string, number>;
  recipeKey: RecipeKey;
  restSeconds: number | null;
  sessionExerciseId: string;
  setLogId: string;
  setNumber: number;
};

type HistoricalPerformanceEntry = {
  derivedEffectiveLoadKg?: number | null;
  exerciseCatalogId: string;
  metrics: Record<string, number>;
  recipeKey: RecipeKey;
};

type MeasurableModality = 'cardio' | 'holds' | 'load';
type SetModality = MeasurableModality | 'unmeasured';
type WorkSplit = 'legs' | 'other' | 'pull' | 'push';

type MetricChip = {
  label: string;
  value: number | null;
};

type DistributionRow = {
  contributionPercent: number;
  groupId: string;
  label: string;
  loadKg: number;
  reps: number;
  setCount: number;
};

type ExerciseDemand = {
  averageRpe: number;
  exerciseName: string;
  highestRpe: number;
  setCount: number;
  sessionExerciseId: string;
};

type ExerciseMapEntry = {
  averageRpe: number | null;
  exerciseName: string;
  firstLoggedAt: number;
  lastLoggedAt: number;
  modality: SetModality;
  outputLabel: string | null;
  sessionExerciseId: string;
  setCount: number;
};

type TopSet = {
  exerciseName: string;
  score: number;
  summary: string;
};

export type LiveSessionStatusStrip = {
  completedSetsLabel: string;
  durationLabel: string;
  microLineTokens: string[];
  workSlotKind: 'active' | 'cardio' | 'holds' | 'load' | 'mixed';
  workSlotLabel: string;
};

export type LiveSessionSummary = {
  distribution: {
    byGranularMuscleGroup: DistributionRow[];
    byMuscleGroup: DistributionRow[];
    workSplit: DistributionRow[];
  };
  highlights: {
    mostDemandingExercise: ExerciseDemand | null;
    nearPrCount: number;
    prCount: number;
  };
  intensity: {
    averageRpe: number | null;
    byMuscleGroup: MetricChip[];
    highestRpe: number | null;
  };
  output: {
    completedSets: number;
    totalDistanceKm: number;
    totalHoldSeconds: number;
    totalLoadKg: number;
  };
  recovery: {
    averageRestSeconds: number | null;
    totalRestSeconds: number;
  };
};

export type LiveSessionFullInsights = {
  exerciseMap: {
    entries: ExerciseMapEntry[];
    setsPerHour: number | null;
  };
  intensityAnalysis: {
    averageRpe: number | null;
    byMuscleGroup: MetricChip[];
    highestRpe: number | null;
    trend: Array<{
      exerciseName: string;
      rpe: number;
      setLogId: string;
      setNumber: number;
    }>;
  };
  modalityBreakdown: {
    buckets: Array<{
      count: number;
      key: SetModality;
      label: string;
      primaryValueLabel: string | null;
      ratio: number;
    }>;
  };
  performance: {
    nearPrExercises: string[];
    prExercises: string[];
    topSets: TopSet[];
  };
  recoveryAnalysis: {
    averageRestSeconds: number | null;
    highIntensityAverageRestSeconds: number | null;
    longestRestSeconds: number | null;
    shortestRestSeconds: number | null;
    standardAverageRestSeconds: number | null;
    totalRestSeconds: number;
  };
  workBreakdown: {
    byGranularMuscleGroup: DistributionRow[];
    byMuscleGroup: DistributionRow[];
  };
};

export type LiveSessionInsightsResult = {
  fullInsights: LiveSessionFullInsights;
  statusStrip: LiveSessionStatusStrip;
  summary: LiveSessionSummary;
};

type EnrichedSet = {
  distanceKm: number;
  exercise: SessionInsightsExercise;
  floors: number;
  holdSeconds: number;
  loadKg: number;
  log: SessionInsightsLog;
  modality: SetModality;
  reps: number;
  rpe: number | null;
};

const workSplitLabels: Record<WorkSplit, string> = {
  legs: 'Legs',
  other: 'Other',
  pull: 'Pull',
  push: 'Push',
};

export function buildLiveSessionInsights(args: {
  historicalEntries: HistoricalPerformanceEntry[];
  logs: SessionInsightsLog[];
  now: number;
  sessionStartedAt: number;
  sessionExercises: SessionInsightsExercise[];
}): LiveSessionInsightsResult {
  const exerciseById = new Map(
    args.sessionExercises.map(sessionExercise => [sessionExercise.sessionExerciseId, sessionExercise]),
  );
  const sortedLogs = [...args.logs].sort((left, right) => left.loggedAt - right.loggedAt);
  const enrichedSets = sortedLogs.flatMap<EnrichedSet>(log => {
    const exercise = exerciseById.get(log.sessionExerciseId);
    if (!exercise) {
      return [];
    }

    return [
      {
        distanceKm: getDistanceKm(log.metrics),
        exercise,
        floors: finiteOrZero(log.metrics.floors),
        holdSeconds: getHoldSeconds(log.recipeKey, log.metrics),
        loadKg: getLoadKg(log),
        log,
        modality: classifyModality(exercise, log),
        reps: getSetRepCount(log.metrics),
        rpe: getRpe(log.metrics),
      },
    ];
  });

  const completedSets = enrichedSets.length;
  const totalLoadKg = roundMetric(sum(enrichedSets.map(setEntry => setEntry.loadKg)));
  const totalDistanceKm = roundMetric(sum(enrichedSets.map(setEntry => setEntry.distanceKm)));
  const totalHoldSeconds = Math.round(sum(enrichedSets.map(setEntry => setEntry.holdSeconds)));
  const totalRestSeconds = Math.round(
    sum(enrichedSets.map(setEntry => setEntry.log.restSeconds ?? 0)),
  );
  const averageRestSeconds = average(
    enrichedSets
      .map(setEntry => setEntry.log.restSeconds)
      .filter((value): value is number => value !== null && value > 0),
  );

  const durationLabel = formatSessionDurationLabel(args.now - args.sessionStartedAt);
  const measurableCounts = countModalities(enrichedSets);
  const cardioDurationSeconds = Math.round(
    sum(
      enrichedSets
        .filter(setEntry => setEntry.modality === 'cardio')
        .map(setEntry => getCardioDurationSeconds(setEntry.log.recipeKey, setEntry.log.metrics)),
    ),
  );
  const cardioFloors = Math.round(
    sum(enrichedSets.filter(setEntry => setEntry.modality === 'cardio').map(setEntry => setEntry.floors)),
  );
  const statusStrip = buildStatusStrip({
    cardioDurationSeconds,
    cardioFloors,
    completedSets,
    durationLabel,
    measurableCounts,
    totalDistanceKm,
    totalHoldSeconds,
    totalLoadKg,
  });

  const summaryIntensity = buildIntensity(enrichedSets);
  const summaryDistribution = buildDistribution(enrichedSets);
  const mostDemandingExercise = getMostDemandingExercise(enrichedSets);
  const performance = buildPerformance(args.historicalEntries, enrichedSets);
  const recoveryAnalysis = buildRecoveryAnalysis(enrichedSets, totalRestSeconds, averageRestSeconds);

  return {
    fullInsights: {
      exerciseMap: {
        entries: buildExerciseMap(enrichedSets),
        setsPerHour: getSetsPerHour(completedSets, args.now - args.sessionStartedAt),
      },
      intensityAnalysis: {
        averageRpe: summaryIntensity.averageRpe,
        byMuscleGroup: summaryIntensity.byMuscleGroup,
        highestRpe: summaryIntensity.highestRpe,
        trend: enrichedSets
          .filter(setEntry => setEntry.rpe !== null)
          .map(setEntry => ({
            exerciseName: setEntry.exercise.exerciseName,
            rpe: setEntry.rpe as number,
            setLogId: setEntry.log.setLogId,
            setNumber: setEntry.log.setNumber,
          })),
      },
      modalityBreakdown: {
        buckets: buildModalityBreakdown({
          cardioDurationSeconds,
          cardioFloors,
          counts: measurableCounts,
          totalDistanceKm,
          totalHoldSeconds,
          totalLoadKg,
        }),
      },
      performance: {
        nearPrExercises: performance.nearPrExercises,
        prExercises: performance.prExercises,
        topSets: performance.topSets,
      },
      recoveryAnalysis,
      workBreakdown: {
        byGranularMuscleGroup: summaryDistribution.byGranularMuscleGroup,
        byMuscleGroup: summaryDistribution.byMuscleGroup,
      },
    },
    statusStrip,
    summary: {
      distribution: summaryDistribution,
      highlights: {
        mostDemandingExercise,
        nearPrCount: performance.nearPrExercises.length,
        prCount: performance.prExercises.length,
      },
      intensity: summaryIntensity,
      output: {
        completedSets,
        totalDistanceKm,
        totalHoldSeconds,
        totalLoadKg,
      },
      recovery: {
        averageRestSeconds,
        totalRestSeconds,
      },
    },
  };
}

function buildDistribution(enrichedSets: EnrichedSet[]) {
  const granularGroupMap = new Map<WeeklyGranularMuscleGroupId, DistributionRow>();
  const groupMap = new Map<WeeklyMuscleGroupId, DistributionRow>();
  const splitMap = new Map<WorkSplit, DistributionRow>();

  for (const setEntry of enrichedSets) {
    const granularGroupIds = resolveWeeklyGranularMuscleGroups({
      isCardio: setEntry.exercise.isCardio,
      mainMuscleGroups: setEntry.exercise.mainMuscleGroups,
    });
    const groupIds = resolveWeeklyMuscleGroups({
      isCardio: setEntry.exercise.isCardio,
      mainMuscleGroups: setEntry.exercise.mainMuscleGroups,
    });

    for (const groupId of granularGroupIds) {
      const current = granularGroupMap.get(groupId);
      if (current) {
        current.loadKg = roundMetric(current.loadKg + setEntry.loadKg);
        current.reps = roundMetric(current.reps + setEntry.reps);
        current.setCount += 1;
        continue;
      }

      granularGroupMap.set(groupId, {
        contributionPercent: 0,
        groupId,
        label: weeklyGranularMuscleGroupLabels[groupId],
        loadKg: setEntry.loadKg,
        reps: setEntry.reps,
        setCount: 1,
      });
    }

    for (const groupId of groupIds) {
      const current = groupMap.get(groupId);
      if (current) {
        current.loadKg = roundMetric(current.loadKg + setEntry.loadKg);
        current.reps = roundMetric(current.reps + setEntry.reps);
        current.setCount += 1;
        continue;
      }

      groupMap.set(groupId, {
        contributionPercent: 0,
        groupId,
        label: weeklyMuscleGroupLabels[groupId],
        loadKg: setEntry.loadKg,
        reps: setEntry.reps,
        setCount: 1,
      });
    }

    const split = resolveWorkSplit(setEntry.exercise);
    const splitEntry = splitMap.get(split);
    if (splitEntry) {
      splitEntry.loadKg = roundMetric(splitEntry.loadKg + setEntry.loadKg);
      splitEntry.reps = roundMetric(splitEntry.reps + setEntry.reps);
      splitEntry.setCount += 1;
    } else {
      splitMap.set(split, {
        contributionPercent: 0,
        groupId: split,
        label: workSplitLabels[split],
        loadKg: setEntry.loadKg,
        reps: setEntry.reps,
        setCount: 1,
      });
    }
  }

  return {
    byGranularMuscleGroup: finalizeDistributionRows(Array.from(granularGroupMap.values()), enrichedSets.length),
    byMuscleGroup: finalizeDistributionRows(Array.from(groupMap.values()), enrichedSets.length),
    workSplit: finalizeDistributionRows(Array.from(splitMap.values()), enrichedSets.length),
  };
}

function buildExerciseMap(enrichedSets: EnrichedSet[]): ExerciseMapEntry[] {
  const exerciseMap = new Map<string, ExerciseMapEntry & { rpeTotal: number; rpeCount: number }>();

  for (const setEntry of enrichedSets) {
    const existing = exerciseMap.get(setEntry.exercise.sessionExerciseId);
    const outputLabel = getExerciseOutputLabel(setEntry);
    if (existing) {
      existing.firstLoggedAt = Math.min(existing.firstLoggedAt, setEntry.log.loggedAt);
      existing.lastLoggedAt = Math.max(existing.lastLoggedAt, setEntry.log.loggedAt);
      existing.setCount += 1;
      existing.outputLabel = outputLabel ?? existing.outputLabel;
      if (setEntry.rpe !== null) {
        existing.rpeCount += 1;
        existing.rpeTotal += setEntry.rpe;
        existing.averageRpe = roundMetric(existing.rpeTotal / existing.rpeCount);
      }
      continue;
    }

    exerciseMap.set(setEntry.exercise.sessionExerciseId, {
      averageRpe: setEntry.rpe,
      exerciseName: setEntry.exercise.exerciseName,
      firstLoggedAt: setEntry.log.loggedAt,
      lastLoggedAt: setEntry.log.loggedAt,
      modality: setEntry.modality,
      outputLabel,
      rpeCount: setEntry.rpe === null ? 0 : 1,
      rpeTotal: setEntry.rpe ?? 0,
      sessionExerciseId: setEntry.exercise.sessionExerciseId,
      setCount: 1,
    });
  }

  return Array.from(exerciseMap.values())
    .sort((left, right) => left.firstLoggedAt - right.firstLoggedAt)
    .map(({ rpeCount: _rpeCount, rpeTotal: _rpeTotal, ...entry }) => entry);
}

function buildIntensity(enrichedSets: EnrichedSet[]) {
  const rpeValues = enrichedSets
    .map(setEntry => setEntry.rpe)
    .filter((value): value is number => value !== null);
  const byGroup = new Map<WeeklyMuscleGroupId, { total: number; count: number }>();

  for (const setEntry of enrichedSets) {
    if (setEntry.rpe === null) {
      continue;
    }

    const groupIds = resolveWeeklyMuscleGroups({
      isCardio: setEntry.exercise.isCardio,
      mainMuscleGroups: setEntry.exercise.mainMuscleGroups,
    });

    for (const groupId of groupIds) {
      const current = byGroup.get(groupId);
      if (current) {
        current.count += 1;
        current.total += setEntry.rpe;
      } else {
        byGroup.set(groupId, { count: 1, total: setEntry.rpe });
      }
    }
  }

  return {
    averageRpe: average(rpeValues),
    byMuscleGroup: Array.from(byGroup.entries())
      .filter(([, value]) => value.count >= 2)
      .sort((left, right) => right[1].total / right[1].count - left[1].total / left[1].count)
      .slice(0, 4)
      .map(([groupId, value]) => ({
        label: weeklyMuscleGroupLabels[groupId],
        value: roundMetric(value.total / value.count),
      })),
    highestRpe: rpeValues.length > 0 ? roundMetric(Math.max(...rpeValues)) : null,
  };
}

function buildModalityBreakdown(args: {
  cardioDurationSeconds: number;
  cardioFloors: number;
  counts: Record<SetModality, number>;
  totalDistanceKm: number;
  totalHoldSeconds: number;
  totalLoadKg: number;
}) {
  const measurableTotal = args.counts.load + args.counts.cardio + args.counts.holds;

  return (['load', 'cardio', 'holds', 'unmeasured'] as const)
    .filter(key => args.counts[key] > 0)
    .map(key => ({
      count: args.counts[key],
      key,
      label: getModalityLabel(key),
      primaryValueLabel:
        key === 'load'
          ? formatLoadKg(args.totalLoadKg)
          : key === 'cardio'
            ? formatCardioValue({
                distanceKm: args.totalDistanceKm,
                durationSeconds: args.cardioDurationSeconds,
                floors: args.cardioFloors,
              })
            : key === 'holds'
              ? formatHoldDuration(args.totalHoldSeconds)
              : null,
      ratio:
        key === 'unmeasured'
          ? completedRatio(args.counts[key], args.counts.load + args.counts.cardio + args.counts.holds + args.counts.unmeasured)
          : completedRatio(args.counts[key], measurableTotal),
    }));
}

function buildPerformance(historicalEntries: HistoricalPerformanceEntry[], enrichedSets: EnrichedSet[]) {
  const historicalBest = new Map<string, number>();
  for (const entry of historicalEntries) {
    const score = getComparisonScalarForRecipe(
      entry.recipeKey,
      entry.metrics,
      entry.derivedEffectiveLoadKg ?? null,
    );
    if (score <= 0) {
      continue;
    }
    historicalBest.set(
      entry.exerciseCatalogId,
      Math.max(historicalBest.get(entry.exerciseCatalogId) ?? 0, score),
    );
  }

  const currentBest = new Map<string, { exerciseName: string; score: number }>();
  const topSets: TopSet[] = [];
  for (const setEntry of enrichedSets) {
    const score = getComparisonScalarForRecipe(
      setEntry.log.recipeKey,
      setEntry.log.metrics,
      setEntry.log.derivedEffectiveLoadKg ?? null,
    );
    if (score > 0) {
      const current = currentBest.get(setEntry.exercise.exerciseCatalogId);
      if (!current || score > current.score) {
        currentBest.set(setEntry.exercise.exerciseCatalogId, {
          exerciseName: setEntry.exercise.exerciseName,
          score,
        });
      }
      topSets.push({
        exerciseName: setEntry.exercise.exerciseName,
        score,
        summary: summarizeMetrics(setEntry.log.recipeKey, setEntry.log.metrics),
      });
    }
  }

  const prExercises: string[] = [];
  const nearPrExercises: string[] = [];

  for (const [exerciseCatalogId, current] of currentBest) {
    const previousBest = historicalBest.get(exerciseCatalogId) ?? 0;
    if (previousBest === 0 || current.score > previousBest) {
      prExercises.push(current.exerciseName);
      continue;
    }
    if (current.score >= previousBest * 0.95) {
      nearPrExercises.push(current.exerciseName);
    }
  }

  return {
    nearPrExercises: nearPrExercises.sort(),
    prExercises: prExercises.sort(),
    topSets: topSets.sort((left, right) => right.score - left.score).slice(0, 3),
  };
}

function buildRecoveryAnalysis(
  enrichedSets: EnrichedSet[],
  totalRestSeconds: number,
  averageRestSeconds: number | null,
) {
  const restValues = enrichedSets
    .map(setEntry => setEntry.log.restSeconds)
    .filter((value): value is number => value !== null && value > 0);
  const highIntensityRest = enrichedSets
    .filter(setEntry => (setEntry.rpe ?? 0) >= 8)
    .map(setEntry => setEntry.log.restSeconds)
    .filter((value): value is number => value !== null && value > 0);
  const standardRest = enrichedSets
    .filter(setEntry => setEntry.rpe === null || setEntry.rpe < 8)
    .map(setEntry => setEntry.log.restSeconds)
    .filter((value): value is number => value !== null && value > 0);

  return {
    averageRestSeconds,
    highIntensityAverageRestSeconds: average(highIntensityRest),
    longestRestSeconds: restValues.length > 0 ? Math.max(...restValues) : null,
    shortestRestSeconds: restValues.length > 0 ? Math.min(...restValues) : null,
    standardAverageRestSeconds: average(standardRest),
    totalRestSeconds,
  };
}

function buildStatusStrip(args: {
  cardioDurationSeconds: number;
  cardioFloors: number;
  completedSets: number;
  durationLabel: string;
  measurableCounts: Record<SetModality, number>;
  totalDistanceKm: number;
  totalHoldSeconds: number;
  totalLoadKg: number;
}): LiveSessionStatusStrip {
  const completedSetsLabel = `${args.completedSets} ${args.completedSets === 1 ? 'set' : 'sets'}`;

  const measurableTotal = args.measurableCounts.load + args.measurableCounts.cardio + args.measurableCounts.holds;
  if (measurableTotal === 0) {
    return {
      completedSetsLabel,
      durationLabel: args.durationLabel,
      microLineTokens: [],
      workSlotKind: 'active',
      workSlotLabel: 'Active',
    };
  }

  const rankedCounts = [
    { key: 'load' as const, count: args.measurableCounts.load },
    { key: 'cardio' as const, count: args.measurableCounts.cardio },
    { key: 'holds' as const, count: args.measurableCounts.holds },
  ].sort((left, right) => right.count - left.count);
  const dominant = rankedCounts[0];

  if (dominant.count / measurableTotal > 0.8) {
    return {
      completedSetsLabel,
      durationLabel: args.durationLabel,
      microLineTokens: [],
      workSlotKind: dominant.key,
      workSlotLabel:
        dominant.key === 'load'
          ? formatLoadKg(args.totalLoadKg)
          : dominant.key === 'cardio'
            ? formatCardioValue({
                distanceKm: args.totalDistanceKm,
                durationSeconds: args.cardioDurationSeconds,
                floors: args.cardioFloors,
              }) ?? 'Active'
            : formatHoldDuration(args.totalHoldSeconds),
    };
  }

  return {
    completedSetsLabel,
    durationLabel: args.durationLabel,
    microLineTokens: rankedCounts
      .map(item => ({
        count: item.count,
        label:
          item.key === 'load'
            ? formatLoadKg(args.totalLoadKg)
            : item.key === 'cardio'
              ? formatCardioValue({
                  distanceKm: args.totalDistanceKm,
                  durationSeconds: args.cardioDurationSeconds,
                  floors: args.cardioFloors,
                })
              : formatHoldDuration(args.totalHoldSeconds),
      }))
      .filter((item): item is { count: number; label: string } => Boolean(item.label))
      .sort((left, right) => right.count - left.count)
      .slice(0, 3)
      .map(item => item.label),
    workSlotKind: 'mixed',
    workSlotLabel: 'Mixed',
  };
}

function classifyModality(exercise: SessionInsightsExercise, log: SessionInsightsLog): SetModality {
  const distanceKm = getDistanceKm(log.metrics);
  const floors = finiteOrZero(log.metrics.floors);
  if (distanceKm > 0 || floors > 0) {
    return 'cardio';
  }

  if (isHoldRecipe(log.recipeKey) || exercise.isHold) {
    return 'holds';
  }

  if (getLoadKg(log) > 0 || getSetRepCount(log.metrics) > 0) {
    return 'load';
  }

  if (exercise.isCardio) {
    return 'cardio';
  }

  return 'unmeasured';
}

function countModalities(enrichedSets: EnrichedSet[]): Record<SetModality, number> {
  return enrichedSets.reduce<Record<SetModality, number>>(
    (counts, setEntry) => ({
      ...counts,
      [setEntry.modality]: counts[setEntry.modality] + 1,
    }),
    { cardio: 0, holds: 0, load: 0, unmeasured: 0 },
  );
}

function finalizeDistributionRows<T extends DistributionRow>(rows: T[], totalSets: number) {
  if (totalSets <= 0) {
    return rows
      .sort((left, right) => right.setCount - left.setCount || right.loadKg - left.loadKg)
      .map(row => ({
        ...row,
        contributionPercent: 0,
        loadKg: roundMetric(row.loadKg),
        reps: roundMetric(row.reps),
      }));
  }

  return rows
    .sort((left, right) => right.setCount - left.setCount || right.loadKg - left.loadKg)
    .map(row => ({
      ...row,
      contributionPercent: completedRatio(row.setCount, totalSets),
      loadKg: roundMetric(row.loadKg),
      reps: roundMetric(row.reps),
    }));
}

function getCardioDurationSeconds(recipeKey: RecipeKey, metrics: Record<string, number>) {
  if (recipeKey === 'cardio_manual_duration_rpe') {
    return Math.round(finiteOrZero(metrics.duration));
  }

  if (recipeKey === 'cardio_manual_distance_time_rpe') {
    return Math.round(finiteOrZero(metrics.time));
  }

  if (getRecipeDefinition(recipeKey).processKind === 'live_cardio') {
    return Math.round(finiteOrZero(metrics.duration));
  }

  return 0;
}

function getDistanceKm(metrics: Record<string, number>) {
  return roundMetric(finiteOrZero(metrics.distance));
}

function getExerciseOutputLabel(setEntry: EnrichedSet) {
  if (setEntry.modality === 'cardio') {
    return (
      formatCardioValue({
        distanceKm: setEntry.distanceKm,
        durationSeconds: getCardioDurationSeconds(setEntry.log.recipeKey, setEntry.log.metrics),
        floors: setEntry.floors,
      }) ?? null
    );
  }

  if (setEntry.modality === 'holds' && setEntry.holdSeconds > 0) {
    return formatHoldDuration(setEntry.holdSeconds);
  }

  if (setEntry.loadKg > 0) {
    return formatLoadKg(setEntry.loadKg);
  }

  if (setEntry.reps > 0) {
    return `${Math.round(setEntry.reps)} reps`;
  }

  return null;
}

function getHoldSeconds(recipeKey: RecipeKey, metrics: Record<string, number>) {
  switch (recipeKey) {
    case 'hold':
    case 'weighted_hold':
      return Math.round(finiteOrZero(metrics.duration));
    case 'unilateral_duration_rpe_pair':
      return Math.round(finiteOrZero(metrics.leftDuration) + finiteOrZero(metrics.rightDuration));
    default:
      return 0;
  }
}

function getLoadKg(log: Pick<SessionInsightsLog, 'derivedEffectiveLoadKg' | 'metrics' | 'recipeKey'>) {
  const reps = finiteOrZero(log.metrics.reps);
  const derivedVolumeKg = getSetVolume({
    derivedEffectiveLoadKg: log.derivedEffectiveLoadKg ?? null,
    metrics: log.metrics,
  });

  if (derivedVolumeKg > 0) {
    return derivedVolumeKg;
  }

  switch (log.recipeKey) {
    case 'weighted_hold':
      return roundMetric(finiteOrZero(log.metrics.load));
    case 'unilateral_duration_distance_load_pair':
    case 'cardio_live_duration_distance_load':
      return roundMetric(finiteOrZero(log.metrics.load));
    default:
      return 0;
  }
}

function getModalityLabel(modality: SetModality) {
  switch (modality) {
    case 'load':
      return 'Strength';
    case 'cardio':
      return 'Cardio';
    case 'holds':
      return 'Holds';
    default:
      return 'Other';
  }
}

function getMostDemandingExercise(enrichedSets: EnrichedSet[]): ExerciseDemand | null {
  const demandMap = new Map<
    string,
    { exerciseName: string; highestRpe: number; rpeCount: number; rpeTotal: number; setCount: number }
  >();

  for (const setEntry of enrichedSets) {
    const current = demandMap.get(setEntry.exercise.sessionExerciseId);
    if (current) {
      current.setCount += 1;
      if (setEntry.rpe !== null) {
        current.highestRpe = Math.max(current.highestRpe, setEntry.rpe);
        current.rpeCount += 1;
        current.rpeTotal += setEntry.rpe;
      }
      continue;
    }

    demandMap.set(setEntry.exercise.sessionExerciseId, {
      exerciseName: setEntry.exercise.exerciseName,
      highestRpe: setEntry.rpe ?? 0,
      rpeCount: setEntry.rpe === null ? 0 : 1,
      rpeTotal: setEntry.rpe ?? 0,
      setCount: 1,
    });
  }

  const ranked = Array.from(demandMap.entries())
    .filter(([, value]) => value.rpeCount > 0)
    .map(([sessionExerciseId, value]) => ({
      averageRpe: roundMetric(value.rpeTotal / value.rpeCount),
      exerciseName: value.exerciseName,
      highestRpe: roundMetric(value.highestRpe),
      sessionExerciseId,
      setCount: value.setCount,
    }))
    .sort(
      (left, right) =>
        right.averageRpe - left.averageRpe ||
        right.highestRpe - left.highestRpe ||
        right.setCount - left.setCount,
    );

  return ranked[0] ?? null;
}

function getRpe(metrics: Record<string, number>) {
  const value = metrics.rpe;
  return Number.isFinite(value) ? roundMetric(value) : null;
}

function getSetsPerHour(completedSets: number, elapsedMs: number) {
  if (completedSets === 0 || elapsedMs <= 0) {
    return null;
  }

  return roundMetric(completedSets / (elapsedMs / 3_600_000));
}

function isHoldRecipe(recipeKey: RecipeKey) {
  return recipeKey === 'hold' || recipeKey === 'weighted_hold' || recipeKey === 'unilateral_duration_rpe_pair';
}

function resolveWorkSplit(exercise: SessionInsightsExercise): WorkSplit {
  const movementPatterns = exercise.movementPatterns.map(item => item.trim().toLowerCase());
  const muscleGroups = exercise.mainMuscleGroups.map(item => item.trim().toLowerCase());

  if (
    movementPatterns.some(pattern =>
      pattern.includes('squat') ||
      pattern.includes('hinge') ||
      pattern.includes('lunge') ||
      pattern.includes('carry'),
    )
  ) {
    return 'legs';
  }

  if (muscleGroups.some(group => group.includes('quad') || group.includes('hamstring') || group.includes('glute') || group.includes('calf'))) {
    return 'legs';
  }

  if (
    movementPatterns.some(pattern => pattern.includes('press') || pattern.includes('push')) ||
    muscleGroups.some(group => group.includes('pec') || group.includes('chest') || group.includes('delt') || group.includes('triceps'))
  ) {
    return 'push';
  }

  if (
    movementPatterns.some(pattern => pattern.includes('pull') || pattern.includes('row') || pattern.includes('curl')) ||
    muscleGroups.some(group => group.includes('lat') || group.includes('back') || group.includes('trap') || group.includes('biceps') || group.includes('forearm'))
  ) {
    return 'pull';
  }

  return 'other';
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return roundMetric(sum(values) / values.length);
}

function completedRatio(count: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return roundMetric((count / total) * 100);
}

function finiteOrZero(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatCardioValue(input: {
  distanceKm: number;
  durationSeconds: number;
  floors: number;
}) {
  if (input.distanceKm > 0) {
    return `${formatCompactNumber(input.distanceKm, 1)} km`;
  }

  if (input.floors > 0) {
    return `${Math.round(input.floors)} floors`;
  }

  if (input.durationSeconds > 0) {
    return formatHoldDuration(input.durationSeconds);
  }

  return null;
}

function formatHoldDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${safeSeconds}s`;
}

function formatLoadKg(loadKg: number) {
  return `${Math.round(loadKg).toLocaleString('en-US')} kg`;
}

function formatSessionDurationLabel(elapsedMs: number) {
  const totalMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (totalMinutes > 0) {
    return `${totalMinutes}m`;
  }

  return '0m';
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

import type { Id } from '@/convex/_generated/dataModel';
import type { RecipeFieldDefinition, RecipeKey, RecipeLayoutKind, RecipeProcessKind } from '@/domains/workout/recipes';

export type CatalogItem = {
  _id: Id<'exerciseCatalog'>;
  discoveryTags: string[];
  equipment: string[];
  exerciseClass: string;
  isFavorite: boolean;
  mainMuscleGroups: string[];
  name: string;
  recipeKey: RecipeKey;
};

export type MetricValues = Record<string, number>;

export type WorkoutPage = 'timeline' | 'exercise';

export type TimelineSet = {
  metrics: MetricValues;
  restSeconds: number | null;
  setLogId: Id<'liveSetLogs'>;
  setNumber: number;
  summary: string;
  warmup: boolean;
};

export type TimelineRow = {
  exerciseName: string;
  lastLoggedSummary: string | null;
  sessionExerciseId: Id<'liveSessionExercises'>;
  sets: TimelineSet[];
  setCount: number;
  state: 'idle' | 'capture' | 'rest' | 'logged' | 'live_tracking';
};

export type EditingSet = {
  metrics: MetricValues;
  sessionExerciseId: Id<'liveSessionExercises'>;
  setLogId: Id<'liveSetLogs'>;
  setNumber: number;
  warmup: boolean;
};

export type AddExerciseSheetData = {
  equipmentOptions: string[];
  favorites: CatalogItem[];
  muscleGroupOptions: string[];
  recents: CatalogItem[];
  results: CatalogItem[];
};

export type CaptureCard = {
  currentSetNumber: number;
  exerciseName: string;
  fields: RecipeFieldDefinition[];
  initialMetrics: MetricValues;
  layoutKind: RecipeLayoutKind;
  previousMetrics: MetricValues | null;
  previousSetSummary: string | null;
  processKind: RecipeProcessKind;
  recipeKey: RecipeKey;
  sessionExerciseId: Id<'liveSessionExercises'>;
};

export type RestCard = {
  durationSeconds: number;
  exerciseName: string;
  isComplete: boolean;
  isRunning: boolean;
  nextSetNumber: number;
  previousSetSummary: string | null;
  remainingSeconds: number;
  sessionExerciseId: Id<'liveSessionExercises'>;
};

export type LiveCardioCard = {
  elapsedSeconds: number;
  exerciseName: string;
  isRunning: boolean;
  layoutKind: RecipeLayoutKind;
  nextSetNumber: number;
  previousSetSummary: string | null;
  processKind: RecipeProcessKind;
  recipeKey: RecipeKey;
  sessionExerciseId: Id<'liveSessionExercises'>;
  startedAt: number;
  trackedFields: RecipeFieldDefinition[];
  trackedMetrics: MetricValues;
};

export type LiveCardioFinishSummary = {
  elapsedSeconds: number;
  exerciseName: string;
  nextExerciseId: Id<'liveSessionExercises'> | null;
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
    byGranularMuscleGroup: Array<{
      contributionPercent: number;
      groupId: string;
      label: string;
      loadKg: number;
      reps: number;
      setCount: number;
    }>;
    byMuscleGroup: Array<{
      contributionPercent: number;
      groupId: string;
      label: string;
      loadKg: number;
      reps: number;
      setCount: number;
    }>;
    workSplit: Array<{
      contributionPercent: number;
      groupId: string;
      label: string;
      loadKg: number;
      reps: number;
      setCount: number;
    }>;
  };
  highlights: {
    mostDemandingExercise: {
      averageRpe: number;
      exerciseName: string;
      highestRpe: number;
      sessionExerciseId: string;
      setCount: number;
    } | null;
    nearPrCount: number;
    prCount: number;
  };
  intensity: {
    averageRpe: number | null;
    byMuscleGroup: Array<{
      label: string;
      value: number | null;
    }>;
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
    entries: Array<{
      averageRpe: number | null;
      exerciseName: string;
      firstLoggedAt: number;
      lastLoggedAt: number;
      modality: 'cardio' | 'holds' | 'load' | 'unmeasured';
      outputLabel: string | null;
      sessionExerciseId: string;
      setCount: number;
    }>;
    setsPerHour: number | null;
  };
  intensityAnalysis: {
    averageRpe: number | null;
    byMuscleGroup: Array<{
      label: string;
      value: number | null;
    }>;
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
      key: 'cardio' | 'holds' | 'load' | 'unmeasured';
      label: string;
      primaryValueLabel: string | null;
      ratio: number;
    }>;
  };
  performance: {
    nearPrExercises: string[];
    prExercises: string[];
    topSets: Array<{
      exerciseName: string;
      score: number;
      summary: string;
    }>;
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
    byGranularMuscleGroup: Array<{
      contributionPercent: number;
      groupId: string;
      label: string;
      loadKg: number;
      reps: number;
      setCount: number;
    }>;
    byMuscleGroup: Array<{
      contributionPercent: number;
      groupId: string;
      label: string;
      loadKg: number;
      reps: number;
      setCount: number;
    }>;
  };
};

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

import type { Id } from '@/convex/_generated/dataModel';
import type { RecipeFieldDefinition, RecipeKey } from '@/domains/workout/recipes';

export type CatalogItem = {
  _id: Id<'exerciseCatalog'>;
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
  state: string;
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
  previousMetrics: MetricValues | null;
  previousSetSummary: string | null;
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

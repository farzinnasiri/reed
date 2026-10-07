import type { FunctionReturnType } from 'convex/server';
import type { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type {
  ExerciseSetupModifiers,
  RangeOfMotion,
  SetOutcomeDetails,
} from '@/domains/workout/modifier-aware-calculations';
import type { RecipeKey } from '@/domains/workout/recipes';

export type CatalogItem = {
  _id: Id<'exerciseCatalog'>;
  discoveryTags: string[];
  equipment: string[];
  exerciseClass: string;
  isFavorite: boolean;
  mainMuscleGroups: string[];
  name: string;
  primaryFocusAreaLabels: string[];
  primaryFocusAreas: string[];
  primaryTargetAreaLabels: string[];
  primaryTargetAreas: string[];
  recipeKey: RecipeKey;
};

export type FilterOption = {
  label: string;
  parentFocusAreas?: string[];
  value: string;
};

export type MetricValues = Record<string, number>;

export type { ExerciseSetupModifiers, RangeOfMotion, SetOutcomeDetails };

export type WorkoutPage = 'timeline' | 'exercise';

type CurrentSession = NonNullable<FunctionReturnType<typeof api.liveSessions.getCurrent>>;
type SessionInsights = NonNullable<FunctionReturnType<typeof api.liveSessionInsights.getForActiveSession>>;

export type TimelineSet = CurrentSession['timeline'][number]['sets'][number];

export type TimelineRow = CurrentSession['timeline'][number];

export type EditingSet = {
  metrics: MetricValues;
  sessionExerciseId: Id<'liveSessionExercises'>;
  setLogId: Id<'activityLogs'>;
  setNumber: number;
  setOutcomeDetails: SetOutcomeDetails | null;
  warmup: boolean;
};

export type AddExerciseSheetData = {
  equipmentOptions: string[];
  focusAreaOptions: FilterOption[];
  favorites: CatalogItem[];
  muscleGroupOptions: FilterOption[];
  recents: CatalogItem[];
  results: CatalogItem[];
  suggested: CatalogItem[];
  targetAreaOptions: FilterOption[];
};

export type CaptureCard = NonNullable<CurrentSession['activeCard']['capture']>;

export type RestCard = NonNullable<CurrentSession['restRuntime']>;

export type LiveCardioCard = NonNullable<CurrentSession['activeCard']['liveCardio']>;

export type LiveCardioFinishSummary = {
  elapsedSeconds: number;
  exerciseName: string;
  nextExerciseId: Id<'liveSessionExercises'> | null;
  summary: string;
};

export type LiveSessionStatusStrip = CurrentSession['statusStrip'];

export type LiveSessionSummary = SessionInsights['summary'];

export type LiveSessionFullInsights = SessionInsights['fullInsights'];

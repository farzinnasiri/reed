import type { AppMode } from '@/components/home/types';

export const appModeRoutes = {
  chat: '/(app)/(tabs)/reed',
  workout: '/(app)/(tabs)/workout',
} as const satisfies Record<AppMode, string>;

// Focused views pushed over the tabs. They hide the dock and return with Back.
export const appViewRoutes = {
  goals: '/(app)/goals',
} as const;

// Progress is no longer a page: it is the expanded Pulse, which home opens when it gets this param.
export const appPulseRoute = {
  pathname: appModeRoutes.chat,
  params: { pulse: 'open' },
} as const;

// You is no longer a page either: it is the sheet, which home presents when it gets this param.
export const appYouRoute = {
  pathname: appModeRoutes.chat,
  params: { you: 'open' },
} as const;

export type WorkoutEntryIntent =
  | { kind: 'sessions' }
  | { kind: 'resume' }
  | { kind: 'session'; sessionId: string }
  | { kind: 'start' };

export function workoutRouteForIntent(intent: WorkoutEntryIntent) {
  return {
    pathname: appModeRoutes.workout,
    params: intent.kind === 'session' ? { session: intent.sessionId } : { intent: intent.kind },
  };
}

export function appRouteFromModeParam(mode: string | undefined) {
  if (mode === 'settings') return appYouRoute;
  return mode === 'workout' ? appModeRoutes.workout : appModeRoutes.chat;
}

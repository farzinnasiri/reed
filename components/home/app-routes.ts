import type { AppMode } from '@/components/home/types';

export const appModeRoutes = {
  home: '/(app)/home',
  workout: '/(app)/workout',
  chat: '/(app)/reed',
  user: '/(app)/profile',
} as const satisfies Record<AppMode, string>;

export function appModeFromRouteSegment(segment: string | undefined): AppMode {
  switch (segment) {
    case 'home':
      return 'home';
    case 'reed':
      return 'chat';
    case 'profile':
      return 'user';
    case 'workout':
    default:
      return 'workout';
  }
}

export function appRouteFromModeParam(mode: string | undefined) {
  if (mode === 'home' || mode === 'workout' || mode === 'chat' || mode === 'user') {
    return appModeRoutes[mode];
  }

  return appModeRoutes.workout;
}

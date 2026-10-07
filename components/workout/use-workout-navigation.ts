import { useCallback, useState } from 'react';
import type { Id } from '@/convex/_generated/dataModel';
import type { WorkoutEntryIntent } from '@/components/home/app-routes';
import type { WorkoutPage } from './workout-surface.types';

export type WorkoutView =
  | { kind: 'history' }
  | { kind: 'past-session'; sessionId: Id<'liveSessions'> }
  | { kind: 'draft' }
  | { kind: 'active'; page: WorkoutPage };

export function workoutViewForIntent(intent: WorkoutEntryIntent, hasSession: boolean): WorkoutView {
  if (intent.kind === 'sessions') return { kind: 'history' };
  if (intent.kind === 'session')
    return { kind: 'past-session', sessionId: intent.sessionId as Id<'liveSessions'> };
  if (hasSession) return { kind: 'active', page: 'timeline' };
  return { kind: intent.kind === 'start' ? 'draft' : 'history' };
}

export function useWorkoutNavigation() {
  const [view, setView] = useState<WorkoutView>({ kind: 'history' });
  const openHistory = useCallback(() => setView({ kind: 'history' }), []);
  const openDraft = useCallback(() => setView({ kind: 'draft' }), []);
  const openActive = useCallback(() => setView({ kind: 'active', page: 'timeline' }), []);
  const openSession = useCallback(
    (sessionId: Id<'liveSessions'>) => setView({ kind: 'past-session', sessionId }),
    [],
  );
  const showPage = useCallback(
    (page: WorkoutPage) =>
      setView((current) => (current.kind === 'active' ? { kind: 'active', page } : current)),
    [],
  );
  const applyIntent = useCallback(
    (intent: WorkoutEntryIntent, hasSession: boolean) => setView(workoutViewForIntent(intent, hasSession)),
    [],
  );
  return { view, openHistory, openDraft, openActive, openSession, showPage, applyIntent };
}

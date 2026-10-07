import { useCallback, createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import { WorkoutRestEffects } from './workout-rest-effects';

type Session = FunctionReturnType<typeof api.liveSessions.getCurrent> | undefined;
const Context = createContext<{ session: Session; restPermissionDenied: boolean } | null>(null);

/** Lives above navigation so freezing or leaving Workout does not cancel a running rest. */
export function WorkoutSessionRuntimeProvider({ children }: { children: ReactNode }) {
  const session = useQuery(api.liveSessions.getCurrent, {});
  const [restPermissionDenied, setRestPermissionDenied] = useState(false);
  const onPermissionDenied = useCallback(() => setRestPermissionDenied(true), []);
  return (
    <Context.Provider value={{ session, restPermissionDenied }}>
      <WorkoutRestEffects restCard={session?.restRuntime ?? null} onPermissionDenied={onPermissionDenied} />
      {children}
    </Context.Provider>
  );
}

export function useWorkoutSessionRuntime() {
  const value = useContext(Context);
  if (!value) throw new Error('Workout runtime requires the authenticated app shell.');
  return value;
}

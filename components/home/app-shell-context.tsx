import { createContext, useContext } from 'react';

// The open session as the home screen shows it (the Pulse and the dock); null when none is open.
export type ActiveWorkout = {
  currentExerciseName: string | null;
  currentSetNumber: number | null;
  sessionId: string;
  startedAt: number;
  manualDurationSeconds?: number;
};

type AppShellContextValue = {
  activeWorkout: ActiveWorkout | null;
  displayName: string;
  hasUnreadCoachMessage: boolean;
  markCoachMessageRead: () => void;
};

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const context = useContext(AppShellContext);

  if (!context) {
    throw new Error('useAppShell must be used inside AppShellContext.Provider.');
  }

  return context;
}

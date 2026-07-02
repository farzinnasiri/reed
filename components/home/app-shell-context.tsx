import { createContext, useContext } from 'react';

type AppShellContextValue = {
  displayName: string;
  dockReservedSpace: number;
  hasUnreadCoachMessage: boolean;
  hasActiveWorkoutSession: boolean;
  markCoachMessageRead: () => void;
  setIsEditingSettingsProfile: (isEditing: boolean) => void;
  setIsWorkoutSessionFullscreen: (isFullscreen: boolean) => void;
};

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const context = useContext(AppShellContext);

  if (!context) {
    throw new Error('useAppShell must be used inside AppShellContext.Provider.');
  }

  return context;
}

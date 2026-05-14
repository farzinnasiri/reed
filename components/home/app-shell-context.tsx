import { createContext, useContext } from 'react';

type AppShellContextValue = {
  displayName: string;
  dockReservedSpace: number;
  hasActiveWorkoutSession: boolean;
  setIsEditingSettingsProfile: (isEditing: boolean) => void;
};

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const context = useContext(AppShellContext);

  if (!context) {
    throw new Error('useAppShell must be used inside AppShellContext.Provider.');
  }

  return context;
}

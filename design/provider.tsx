import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type ReedTheme, type ThemePreference } from '@/design/system';

const THEME_PREFERENCE_KEY = 'reed.themePreference';

type ReedThemeContextValue = {
  preference: ThemePreference;
  resolvedMode: ReedTheme['mode'];
  setPreference: (preference: ThemePreference) => void;
  theme: ReedTheme;
};

const ReedThemeContext = createContext<ReedThemeContextValue | null>(null);

export function ReedThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const resolvedMode =
    preference === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : preference;
  const theme = resolvedMode === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    let cancelled = false;

    void SecureStore.getItemAsync(THEME_PREFERENCE_KEY)
      .then(value => {
        if (cancelled) {
          return;
        }

        if (value === 'light' || value === 'dark' || value === 'system') {
          setPreference(value);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void SecureStore.setItemAsync(THEME_PREFERENCE_KEY, preference).catch(() => {});
  }, [preference]);

  return (
    <ReedThemeContext.Provider
      value={{
        preference,
        resolvedMode,
        setPreference,
        theme,
      }}
    >
      {children}
    </ReedThemeContext.Provider>
  );
}

export function useReedTheme() {
  const context = useContext(ReedThemeContext);

  if (!context) {
    throw new Error('useReedTheme must be used inside ReedThemeProvider.');
  }

  return context;
}

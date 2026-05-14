import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type ReedTheme, type ThemePreference } from '@/design/system';

const THEME_PREFERENCE_KEY = 'reed.themePreference';

type ReedThemeContextValue = {
  preference: ThemePreference;
  reducedTransparency: boolean;
  resolvedMode: ReedTheme['mode'];
  setPreference: (preference: ThemePreference) => void;
  theme: ReedTheme;
};

const ReedThemeContext = createContext<ReedThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

async function readThemePreference() {
  if (Platform.OS === 'web') {
    return typeof globalThis.localStorage === 'undefined'
      ? null
      : globalThis.localStorage.getItem(THEME_PREFERENCE_KEY);
  }

  return SecureStore.getItemAsync(THEME_PREFERENCE_KEY);
}

async function writeThemePreference(preference: ThemePreference) {
  if (Platform.OS === 'web') {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.setItem(THEME_PREFERENCE_KEY, preference);
    }

    return;
  }

  await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, preference);
}

export function ReedThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [reducedTransparency, setReducedTransparency] = useState(false);
  const resolvedMode =
    preference === 'system' ? (systemColorScheme === 'dark' ? 'dark' : 'light') : preference;
  const theme = resolvedMode === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    let cancelled = false;

    void readThemePreference()
      .then(value => {
        if (!cancelled && isThemePreference(value)) {
          setPreferenceState(value);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    void writeThemePreference(nextPreference).catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    let cancelled = false;

    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then(enabled => {
        if (!cancelled) {
          setReducedTransparency(enabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReducedTransparency(false);
        }
      });

    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', enabled => {
      if (!cancelled) {
        setReducedTransparency(enabled);
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return (
    <ReedThemeContext.Provider
      value={{
        preference,
        reducedTransparency,
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

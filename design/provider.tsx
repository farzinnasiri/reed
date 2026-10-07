import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ReedAccent, ReedGlowPalette, ReedTheme } from '@/design/system';
import { accentForGender, DEFAULT_ACCENT_PREFERENCE, parseAccentPreference, resolveAccent, type AccentChoice } from './accent-preference';
import { setReedMotionReduced } from './motion';
import { useReedReducedMotion } from './use-reed-reduced-motion';
import { useAccentAppearance } from './use-accent-appearance';

const ACCENT_STORAGE_KEY = 'reed.accent.v1';
type ThemeContext = { theme: ReedTheme; accent: ReedAccent; accentChoice: AccentChoice; automaticAccent: ReedAccent; glowPalette: ReedGlowPalette; setAccentChoice: (choice: AccentChoice) => void; setAutomaticAccent: (gender: string | null | undefined, options?: { onlyIfUnset?: boolean }) => void };
const ReedThemeContext = createContext<ThemeContext | null>(null);

export function ReedThemeProvider({ children }: { children: ReactNode }) {
  const reduced = useReedReducedMotion();
  const [preference, setPreference] = useState(DEFAULT_ACCENT_PREFERENCE);
  const [loaded, setLoaded] = useState(false);
  const touched = useRef({ choice: false, automatic: false });
  const automaticInitialized = useRef(false);
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => { setReedMotionReduced(reduced); }, [reduced]);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(ACCENT_STORAGE_KEY).then(raw => {
      if (!active) return;
      const saved = parseAccentPreference(raw);
      if (saved) {
        setPreference(current => ({ choice: touched.current.choice ? current.choice : saved.choice, automatic: touched.current.automatic ? current.automatic : saved.automatic }));
        automaticInitialized.current = true;
      }
    }).catch(() => {}).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    // Serialize writes so rapid taps cannot leave an older selection on disk.
    writeQueue.current = writeQueue.current.then(() => AsyncStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify(preference))).catch(() => {});
  }, [loaded, preference]);
  const setAccentChoice = useCallback((choice: AccentChoice) => {
    touched.current.choice = true;
    setPreference(current => current.choice === choice ? current : { ...current, choice });
  }, []);
  const setAutomaticAccent = useCallback((gender: string | null | undefined, options?: { onlyIfUnset?: boolean }) => {
    // Profile data initializes a new device; it cannot undo an explicit local onboarding choice.
    if (options?.onlyIfUnset && (!loaded || automaticInitialized.current)) return;
    automaticInitialized.current = true;
    touched.current.automatic = true;
    const automatic = accentForGender(gender);
    setPreference(current => current.automatic === automatic ? current : { ...current, automatic });
  }, [loaded]);
  const accent = resolveAccent(preference);
  const appearance = useAccentAppearance(accent, reduced);
  const value = useMemo(() => ({ ...appearance, accent, accentChoice: preference.choice, automaticAccent: preference.automatic, setAccentChoice, setAutomaticAccent }), [accent, appearance, preference.automatic, preference.choice, setAccentChoice, setAutomaticAccent]);
  return <ReedThemeContext.Provider value={value}>{children}</ReedThemeContext.Provider>;
}

/** A fresh onboarding starts blue even when the device has an app color saved. */
export function ReedOnboardingThemeProvider({ gender, children }: { gender: string | null; children: ReactNode }) {
  const parent = useReedTheme();
  const reduced = useReedReducedMotion();
  const accent = accentForGender(gender);
  const appearance = useAccentAppearance(accent, reduced);
  const value = useMemo(() => ({ ...parent, ...appearance, accent }), [accent, appearance, parent]);
  return <ReedThemeContext.Provider value={value}>{children}</ReedThemeContext.Provider>;
}
export function useReedTheme() {
  const context = useContext(ReedThemeContext);
  if (!context) throw new Error('useReedTheme must be used inside ReedThemeProvider.');
  return context;
}

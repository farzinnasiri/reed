import type { ReactNode } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { reedWebPhoneFrame } from './system';

/** Native keeps device insets; phone web previews leave breathing room beneath the composer. */
export function ReedSafeArea({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const phonePreview = Platform.OS === 'web' && width <= reedWebPhoneFrame.maxWidth;
  const value = phonePreview ? {
    ...insets,
    bottom: insets.bottom || reedWebPhoneFrame.bottomInset,
  } : insets;

  return <SafeAreaInsetsContext.Provider value={value}>{children}</SafeAreaInsetsContext.Provider>;
}

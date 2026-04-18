import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useReedTheme } from '@/design/provider';

export function ScreenBackdrop({ children }: { children: ReactNode }) {
  const { theme } = useReedTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <LinearGradient colors={theme.gradients.background} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, styles.glowPrimary, { backgroundColor: theme.colors.glowPrimary }]} />
      <View
        style={[styles.glow, styles.glowSecondary, { backgroundColor: theme.colors.glowSecondary }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  glow: {
    borderRadius: 999,
    height: 280,
    position: 'absolute',
    width: 280,
  },
  glowPrimary: {
    left: -54,
    top: 42,
  },
  glowSecondary: {
    bottom: 64,
    right: -60,
  },
});

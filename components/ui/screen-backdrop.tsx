import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { getBackdropDiffusionTokens } from '@/components/ui/glass-material';
import { useReedTheme } from '@/design/provider';

export function ScreenBackdrop({ children }: { children: ReactNode }) {
  const { theme } = useReedTheme();
  const diffusion = getBackdropDiffusionTokens(theme);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <LinearGradient
        colors={theme.gradients.background}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={diffusion.neutral}
        end={{ x: 0.92, y: 1 }}
        start={{ x: 0.18, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={diffusion.warm}
        end={{ x: 0.05, y: 0.08 }}
        start={{ x: 0.95, y: 0.94 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={diffusion.cool}
        end={{ x: 1, y: 0.62 }}
        start={{ x: 0, y: 0.12 }}
        style={[styles.diffusionLayer, { opacity: diffusion.coolOpacity }]}
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
  diffusionLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});

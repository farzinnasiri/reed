import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReedTheme } from '@/design/provider';

type AmbientBackgroundProps = {
  variant: 'home' | 'reed';
};

function AmbientBackgroundComponent(_: AmbientBackgroundProps) {
  const { theme } = useReedTheme();

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.canvas }]}
    />
  );
}

export const AmbientBackground = memo(AmbientBackgroundComponent);

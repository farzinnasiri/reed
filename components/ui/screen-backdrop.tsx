import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReedTheme } from '@/design/provider';

export function ScreenBackdrop({ children }: { children: ReactNode }) {
  const { theme } = useReedTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
});

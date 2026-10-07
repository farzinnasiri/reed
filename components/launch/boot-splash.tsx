import { Image, StyleSheet, View } from 'react-native';
import { reedLaunchMetrics, reedTheme } from '@/design/system';

/** Matches the native splash while fonts, auth and local launch state become ready. */
export function BootSplash() {
  return <View style={styles.root}>
    <Image accessibilityLabel="Smiling Reed" source={require('@/assets/images/splash-icon.png')} style={styles.mark} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: reedTheme.colors.canvas },
  mark: { width: reedLaunchMetrics.loadingSize, height: reedLaunchMetrics.loadingSize },
});

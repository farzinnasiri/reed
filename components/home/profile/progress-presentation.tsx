import { View } from 'react-native';
import { useReedTheme } from '@/design/provider';
import { styles } from './profile.styles';

export function ProgressSkeleton() {
  const { theme } = useReedTheme();

  return (
    <View style={styles.progressSkeleton}>
      <View style={[styles.skeletonLine, { backgroundColor: theme.colors.surfaceRaised }]} />
      <View style={styles.progressMetricRow}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[styles.skeletonMetric, { backgroundColor: theme.colors.surfaceRaised }]}
          />
        ))}
      </View>
    </View>
  );
}

export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(new Date(timestamp));
}

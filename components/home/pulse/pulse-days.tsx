import { StyleSheet, View } from 'react-native';
import { useReedTheme } from '@/design/provider';
import { reedPulseStripMetrics } from '@/design/system';
import type { PulseData } from './use-pulse';

/** The week as seven bars, Mon to Sun (DESIGN.md → The Pulse): trained = `accent`, today = outlined, else `surface-high`. */
export function PulseDays({ compact = false, days }: { compact?: boolean; days: PulseData['week']['days'] }) {
  const { theme } = useReedTheme();

  return (
    <View style={[styles.days, compact && { gap: reedPulseStripMetrics.compactDayGap }]}>
      {days.map((day, index) => (
        <View
          key={index}
          style={[
            styles.day,
            compact && { width: reedPulseStripMetrics.compactDayWidth },
            day === 'done' ? { backgroundColor: theme.colors.accent } : null,
            day === 'today' ? { borderColor: theme.colors.accent, borderWidth: 1.5 } : null,
            day === 'none' ? { backgroundColor: theme.colors.surfaceHigh } : null,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  day: { borderRadius: 3, height: 14, width: 6 },
  days: { flexDirection: 'row', gap: 3 },
});

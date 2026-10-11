import { View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import type { SessionInsightsValue } from './workout-session-insights';

/** Effort is labeled per exercise and set, never an unexplained strip of bars. */
export function RecapVisuals({ insights }: { insights: SessionInsightsValue }) {
  const { theme } = useReedTheme();
  const trend = insights.fullInsights.intensityAnalysis.trend;
  const names = [...new Set(trend.map((set) => set.exerciseName))];
  if (!trend.length) return null;
  return (
    <View style={{ gap: theme.spacing.md }}>
      <ReedText variant="bodyStrong">Effort by set</ReedText>
      <ReedText tone="muted" variant="caption">
        Your reported effort, out of 10.
      </ReedText>
      {names.map((name) => (
        <View key={name} style={{ gap: theme.spacing.xs }}>
          <ReedText variant="caption">{name}</ReedText>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}
          >
            {trend
              .filter((set) => set.exerciseName === name)
              .map((set) => (
                <View
                  key={set.setLogId}
                  accessible
                  accessibilityLabel={`Set ${set.setNumber}, effort ${set.rpe} out of 10`}
                  style={{ gap: theme.spacing.xxs, minWidth: 44 }}
                >
                  <ReedText tone="muted" variant="micro">
                    Set {set.setNumber}
                  </ReedText>
                  <ReedText variant="bodyStrong">
                    {set.rpe}
                    <ReedText tone="muted" variant="micro">
                      {' '}
                      / 10
                    </ReedText>
                  </ReedText>
                  <View
                    style={{
                      height: theme.spacing.xxs,
                      backgroundColor: theme.colors.surfaceHigh,
                      borderRadius: theme.radii.pill,
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.max(0, Math.min(100, set.rpe * 10))}%`,
                        backgroundColor: theme.colors.accentInk,
                        borderRadius: theme.radii.pill,
                      }}
                    />
                  </View>
                </View>
              ))}
          </View>
        </View>
      ))}
    </View>
  );
}

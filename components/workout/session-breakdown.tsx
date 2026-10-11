import { useState } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import { SessionInsights } from './workout-session-insights';
import type { ComponentProps } from 'react';

export function SessionBreakdown(
  props: ComponentProps<typeof SessionInsights>,
) {
  const { theme } = useReedTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ gap: theme.spacing.md }}>
      <HapticPressable
        accessibilityRole="button"
        accessibilityLabel="Training breakdown"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={{
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          borderTopColor: theme.colors.line,
          borderTopWidth: 1,
        }}
      >
        <Ionicons
          name="stats-chart-outline"
          size={20}
          color={String(theme.colors.inkSecondary)}
        />
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <ReedText variant="bodyStrong">Training breakdown</ReedText>
          <ReedText tone="muted" variant="caption">
            Areas trained, effort and records
          </ReedText>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={String(theme.colors.inkSecondary)}
        />
      </HapticPressable>
      {expanded ? <SessionInsights {...props} showSnapshot={false} /> : null}
    </View>
  );
}

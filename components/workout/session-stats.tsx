import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { useReedTheme } from '@/design/provider';
import type { SessionHeadline } from './session-headline';

/** Completed work gets one quiet line; editing duration has its own explicit action. */
export function SessionStats({
  duration,
  headline,
  setsFallback,
}: {
  duration: ReactNode;
  durationEditable?: boolean;
  headline: SessionHeadline | null;
  setsFallback: number;
}) {
  const { theme } = useReedTheme();
  const sets = headline?.sets ?? setsFallback;
  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: theme.spacing.sm,
        }}
      >
        <ReedText variant="stat">{sets}</ReedText>
        <ReedText tone="secondary">
          {sets === 1 ? 'set logged' : 'sets logged'}
        </ReedText>
        {headline?.output ? (
          <ReedText tone="secondary" variant="caption">
            · {headline.output.value} {headline.output.unit}{' '}
            {headline.output.label}
          </ReedText>
        ) : null}
      </View>
      <View
        style={{
          borderTopColor: theme.colors.line,
          borderTopWidth: 1,
          borderBottomColor: theme.colors.line,
          borderBottomWidth: 1,
          paddingVertical: theme.spacing.xs,
        }}
      >
        {duration}
      </View>
    </View>
  );
}

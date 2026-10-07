import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedProfileMetrics } from '@/design/system';

export function ProfileRow({ title, detail, icon, onPress, value }: {
  title: string; detail?: string; icon?: ComponentProps<typeof Ionicons>['name']; onPress: () => void; value?: string;
}) {
  const { theme } = useReedTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={detail} onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', minHeight: reedProfileMetrics.metricHeight, gap: theme.spacing.md, paddingVertical: theme.spacing.sm }, getTapScaleStyle(pressed)]}>
    {icon ? <Ionicons name={icon} size={22} color={String(theme.colors.inkSecondary)} /> : null}
    <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xxs }}>
      <ReedText variant="bodyStrong">{title}</ReedText>
      {detail ? <ReedText tone="secondary" variant="caption" numberOfLines={2}>{detail}</ReedText> : null}
    </View>
    {value ? <ReedText tone="secondary" variant="caption" numberOfLines={1} style={{ flexShrink: 1, maxWidth: '50%' }}>{value}</ReedText> : null}
    <Ionicons name="chevron-forward" size={16} color={String(theme.colors.inkMuted)} />
  </Pressable>;
}

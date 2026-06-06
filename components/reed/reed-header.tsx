import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { styles } from './reed.styles';

export function ReedHeader({
  label,
  onOpenCoachItems,
  openItemsCount,
  topInset,
}: {
  label: string;
  onOpenCoachItems: () => void;
  openItemsCount: number;
  topInset: number;
}) {
  const { theme } = useReedTheme();

  return (
    <GlassSurface
      elevated={false}
      contentStyle={[
        styles.fixedHeaderContent,
        {
          paddingBottom: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          paddingTop: topInset,
        },
      ]}
      style={styles.fixedHeader}
    >
      <View style={styles.header}>
        <View style={styles.headerIdentity}>
          <ReedText variant="title">Reed</ReedText>
          <ReedText tone="muted" variant="caption">{label}</ReedText>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityHint="Shows saved coaching notes and follow-up items."
            accessibilityLabel={`Open coach items, ${openItemsCount} open`}
            accessibilityRole="button"
            onPress={onOpenCoachItems}
            style={({ pressed }) => [
              styles.headerAction,
              getTapScaleStyle(pressed),
            ]}
          >
            <Ionicons color={String(theme.colors.textMuted)} name="book-outline" size={16} />
            <ReedText tone="muted" variant="caption">{openItemsCount}</ReedText>
          </Pressable>
        </View>
      </View>
    </GlassSurface>
  );
}

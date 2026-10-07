import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ReedText } from '@/components/ui/reed-text';
import * as haptics from '@/design/haptics';
import { useReedTheme } from '@/design/provider';
import { reedOnboardingMetrics, reedRadii } from '@/design/system';
import { usePressAnimation } from '@/design/use-press-animation';
import { Heading, gridCell, gridStyle } from './controls';
import { MOVE_VALUES, toggleValue } from './motivations';
import { useOnboardingReed } from './reed-context';
import type { StepProps } from './step-props';

export function ValuesStep({ draft, update }: StepProps) {
  const { reed, say } = useOnboardingReed();
  return <>
    <Heading title="Why do you work out?" sub="Pick up to 3." />
    <View style={gridStyle}>{MOVE_VALUES.map(value => {
      const rank = draft.values.indexOf(value.id);
      return <View key={value.id} style={gridCell}><ValueTile label={value.label} icon={value.icon} rank={rank} disabled={rank < 0 && draft.values.length === 3} onPress={() => {
        const values = toggleValue(draft.values, value.id);
        update({ values });
        haptics.selection();
        if (rank < 0) { say(value.reaction, 2200); reed?.react(value.face, 1800); }
      }} /></View>;
    })}</View>
  </>;
}
function ValueTile({ label, icon, rank, disabled, onPress }: { label: string; icon: typeof MOVE_VALUES[number]['icon']; rank: number; disabled: boolean; onPress: () => void }) {
  const { theme } = useReedTheme();
  const press = usePressAnimation();
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={`${label}${rank >= 0 ? `, priority ${rank + 1}` : ''}`} accessibilityState={{ checked: rank >= 0, disabled }} disabled={disabled} onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
    <Animated.View style={[styles.tile, { backgroundColor: rank >= 0 ? theme.colors.accentSoft : theme.colors.surface, borderColor: rank >= 0 ? theme.colors.accentInk : theme.colors.lineStrong, opacity: disabled ? .55 : 1 }, press.animatedStyle]}>
      <View style={styles.top}><Ionicons name={icon} size={24} color={String(rank >= 0 ? theme.colors.accentInk : theme.colors.inkSecondary)} />{rank >= 0 ? <View style={[styles.badge, { backgroundColor: theme.colors.accent }]}><ReedText style={{ color: theme.colors.accentText }} variant="micro">{rank + 1}</ReedText></View> : null}</View>
      <ReedText variant="bodyStrong">{label}</ReedText>
    </Animated.View>
  </Pressable>;
}
const styles = StyleSheet.create({
  tile: { minHeight: reedOnboardingMetrics.intentionTileHeight, borderRadius: reedRadii.md, borderWidth: 1.5, overflow: 'hidden', padding: reedOnboardingMetrics.intentionTilePadding, gap: 8, justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { width: reedOnboardingMetrics.priorityBadge, height: reedOnboardingMetrics.priorityBadge, borderRadius: reedRadii.pill, alignItems: 'center', justifyContent: 'center' },
});

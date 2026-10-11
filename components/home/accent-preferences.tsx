import { HapticPressable } from '@/components/ui/haptic-pressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedAccentPalettes, reedRadii } from '@/design/system';

export function AccentPreferences() {
  const { theme, accent, accentChoice, setAccentChoice } = useReedTheme();
  return <View style={styles.root}>
    <ReedText variant="body">Your color</ReedText>
    <View accessibilityRole="none" accessibilityLabel="Personal accent color" style={styles.colors}>
      {Object.entries(reedAccentPalettes).map(([id, palette]) => <HapticPressable key={id} accessibilityRole="button" accessibilityLabel={`${palette.label} color`} accessibilityState={{ selected: accent === id }} {...(Platform.OS === 'web' ? { 'aria-pressed': accent === id } : {})} feedback={accent !== id} onPress={() => { if (accentChoice !== id) setAccentChoice(id as keyof typeof reedAccentPalettes); }} style={({ pressed }) => [styles.choice, getTapScaleStyle(pressed)]}>
        <View style={[styles.swatch, { backgroundColor: palette.accent, borderColor: accent === id ? theme.colors.ink : 'transparent' }]}>
          {accent === id ? <Ionicons name="checkmark" size={18} color={palette.accentText} /> : null}
        </View>
        <ReedText tone={accent === id ? 'default' : 'muted'} variant="micro">{palette.label}</ReedText>
      </HapticPressable>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { padding: 16, gap: 4 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'space-between' },
  choice: { minWidth: 48, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 6 },
  swatch: { width: 30, height: 30, borderRadius: reedRadii.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});

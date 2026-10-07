import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedAccentPalettes, reedRadii } from '@/design/system';

export function AccentPreferences() {
  const { theme, accentChoice, automaticAccent, setAccentChoice } = useReedTheme();
  return <View style={styles.root}>
    <ReedText variant="body">Your color</ReedText>
    <Pressable accessibilityRole="radio" accessibilityLabel={`Automatic color, ${reedAccentPalettes[automaticAccent].label}`} accessibilityState={{ checked: accentChoice === 'automatic' }} {...(Platform.OS === 'web' ? { 'aria-checked': accentChoice === 'automatic' } : {})} onPress={() => setAccentChoice('automatic')} style={({ pressed }) => [styles.automatic, getTapScaleStyle(pressed)]}>
      <ReedText tone="secondary" variant="caption">Automatic · {reedAccentPalettes[automaticAccent].label}</ReedText>
      <Ionicons name={accentChoice === 'automatic' ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={String(theme.colors.accentInk)} />
    </Pressable>
    <View accessibilityRole="radiogroup" accessibilityLabel="Personal accent color" style={styles.colors}>
      {Object.entries(reedAccentPalettes).map(([id, palette]) => <Pressable key={id} accessibilityRole="radio" accessibilityLabel={`${palette.label} color`} accessibilityState={{ checked: accentChoice === id }} {...(Platform.OS === 'web' ? { 'aria-checked': accentChoice === id } : {})} onPress={() => setAccentChoice(id as keyof typeof reedAccentPalettes)} style={({ pressed }) => [styles.choice, getTapScaleStyle(pressed)]}>
        <View style={[styles.swatch, { backgroundColor: palette.accent, borderColor: accentChoice === id ? theme.colors.ink : 'transparent' }]}>
          {accentChoice === id ? <Ionicons name="checkmark" size={18} color={palette.accentText} /> : null}
        </View>
        <ReedText tone={accentChoice === id ? 'default' : 'muted'} variant="micro">{palette.label}</ReedText>
      </Pressable>)}
    </View>
    <ReedText tone="muted" variant="caption">Saved on this device.</ReedText>
  </View>;
}
const styles = StyleSheet.create({
  root: { padding: 16, gap: 4 },
  automatic: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'space-between' },
  choice: { minWidth: 48, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 6 },
  swatch: { width: 30, height: 30, borderRadius: reedRadii.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});

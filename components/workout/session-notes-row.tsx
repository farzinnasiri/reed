import { HapticPressable } from '@/components/ui/haptic-pressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedRadii } from '@/design/system';

/** The session's notes as a quiet row: what was written, or an invitation to write. Opens the notes sheet. */
export function SessionNotesRow({
  notes,
  onPress,
}: {
  notes: string;
  onPress: () => void;
}) {
  const { theme } = useReedTheme();
  const trimmed = notes.trim();

  return (
    <HapticPressable
      accessibilityLabel={trimmed ? 'Edit session notes' : 'Add session notes'}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: trimmed ? theme.colors.surface : undefined },
        getTapScaleStyle(pressed),
      ]}
    >
      <Ionicons
        color={String(
          trimmed ? theme.colors.accentInk : theme.colors.inkSecondary,
        )}
        name={trimmed ? 'document-text' : 'document-text-outline'}
        size={20}
      />
      <View style={styles.copy}>
        <ReedText variant="bodyStrong">
          {trimmed ? 'Session notes' : 'Add a note'}
        </ReedText>
        <ReedText numberOfLines={2} tone="muted" variant="caption">
          {trimmed || 'Anything to remember next time?'}
        </ReedText>
      </View>
      <Ionicons
        color={String(theme.colors.inkMuted)}
        name="chevron-forward"
        size={16}
      />
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: reedRadii.md,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  copy: { flex: 1, gap: 2, minWidth: 0 },
});

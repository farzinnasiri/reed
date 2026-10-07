import { Image, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useUser } from '@clerk/expo';
import * as haptics from '@/design/haptics';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';

export const YOU_PILL_WIDTH = 48;

// Identity at the top right: an uploaded avatar, otherwise an unambiguous person icon.
export function YouPill({ onPress }: { onPress: () => void }) {
  const { theme } = useReedTheme();
  const { user } = useUser();

  return (
    <Pressable
      accessibilityHint="Opens body, goals, training setup, and settings."
      accessibilityLabel="You"
      accessibilityRole="button"
      onPress={() => { haptics.selection(); onPress(); }}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.pill,
          height: 52,
          justifyContent: 'center',
          width: YOU_PILL_WIDTH,
        },
        getTapScaleStyle(pressed),
      ]}
    >
      {user?.hasImage ? (
        <Image source={{ uri: user.imageUrl }} style={{ width: 36, height: 36, borderRadius: theme.radii.pill }} />
      ) : (
        <Ionicons name="person-outline" color={String(theme.colors.inkSecondary)} size={20} />
      )}
    </Pressable>
  );
}

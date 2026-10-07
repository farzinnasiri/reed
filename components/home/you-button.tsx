import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ReedIconButton } from '@/components/ui/reed-icon-button';
import { useReedTheme } from '@/design/provider';
import { appYouRoute } from './app-routes';

export function YouButton() {
  const { theme } = useReedTheme();

  return (
    <ReedIconButton
      accessibilityHint="Opens body, goals, training setup, and settings."
      accessibilityLabel="You"
      onPress={() => router.navigate(appYouRoute)}
      shape="pill"
    >
      <Ionicons color={String(theme.colors.ink)} name="person-outline" size={18} />
    </ReedIconButton>
  );
}

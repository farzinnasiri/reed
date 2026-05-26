import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useReedTheme } from '@/design/provider';

export default function AppTabsLayout() {
  const { theme } = useReedTheme();

  return (
    <Tabs
      screenOptions={{
        animation: Platform.OS === 'web' ? 'none' : 'fade',
        freezeOnBlur: true,
        headerShown: false,
        lazy: true,
        sceneStyle: { backgroundColor: theme.colors.canvas },
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="workout" />
      <Tabs.Screen name="reed" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

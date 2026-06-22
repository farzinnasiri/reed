import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useSegments } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { AppShellContext } from '@/components/home/app-shell-context';
import { appModeFromRouteSegment, appModeRoutes } from '@/components/home/app-routes';
import type { AppMode } from '@/components/home/types';
import {
  TAB_DOCK_BASE_BOTTOM_OFFSET,
  TAB_DOCK_HORIZONTAL_MARGIN,
  TAB_PILL_MIN_HEIGHT,
} from '@/components/ui/glass-material';
import { GlassTabPill } from '@/components/ui/glass-tab-pill';
import { api } from '@/convex/_generated/api';
import { useReedTheme } from '@/design/provider';

type AppShellProps = {
  children: ReactNode;
  displayName: string;
};

export function AppShell({ children, displayName }: AppShellProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const activeMode = appModeFromRouteSegment(segments.at(-1));
  const currentWorkoutSession = useQuery(api.liveSessions.getCurrent, {});
  const hasActiveWorkoutSession = currentWorkoutSession !== null && currentWorkoutSession !== undefined;
  const [dockHeight, setDockHeight] = useState(TAB_PILL_MIN_HEIGHT);
  const [isEditingSettingsProfile, setIsEditingSettingsProfile] = useState(false);
  const [isWorkoutSessionFullscreen, setIsWorkoutSessionFullscreen] = useState(false);

  const showDock = !isEditingSettingsProfile && !isWorkoutSessionFullscreen;
  const shellTopInset = activeMode === 'chat' ? 0 : insets.top;
  const dockBottom = TAB_DOCK_BASE_BOTTOM_OFFSET + insets.bottom;
  const dockReservedSpace = showDock ? dockBottom + dockHeight : insets.bottom + theme.spacing.sm;

  const tabItems: Array<{
    accessibilityLabel: string;
    hasIndicator?: boolean;
    icon: ReactNode;
    id: AppMode;
    isActive: boolean;
  }> = [
    {
      accessibilityLabel: 'Home',
      icon: (
        <Ionicons
          color={String(activeMode === 'home' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={activeMode === 'home' ? 'home' : 'home-outline'}
          size={22}
        />
      ),
      id: 'home',
      isActive: activeMode === 'home',
    },
    {
      accessibilityLabel: 'Workout',
      icon: (
        <Ionicons
          color={String(activeMode === 'workout' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={activeMode === 'workout' ? 'barbell' : 'barbell-outline'}
          size={22}
        />
      ),
      hasIndicator: hasActiveWorkoutSession,
      id: 'workout',
      isActive: activeMode === 'workout',
    },
    {
      accessibilityLabel: 'Reed',
      icon: (
        <Ionicons
          color={String(activeMode === 'chat' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={activeMode === 'chat' ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
          size={22}
        />
      ),
      id: 'chat',
      isActive: activeMode === 'chat',
    },
    {
      accessibilityLabel: 'Profile',
      icon: (
        <Ionicons
          color={String(activeMode === 'user' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={activeMode === 'user' ? 'person' : 'person-outline'}
          size={22}
        />
      ),
      id: 'user',
      isActive: activeMode === 'user',
    },
  ];

  function handleChangeMode(mode: AppMode) {
    if (mode === activeMode) {
      return;
    }

    setIsEditingSettingsProfile(false);
    router.replace(appModeRoutes[mode]);
  }

  return (
    <AppShellContext.Provider
      value={{
        displayName,
        dockReservedSpace,
        hasActiveWorkoutSession,
        setIsEditingSettingsProfile,
        setIsWorkoutSessionFullscreen,
      }}
    >
      <View
        style={[
          styles.shellRoot,
          {
            backgroundColor: theme.colors.canvas,
          },
        ]}
      >
        <View style={[styles.shellContentStack, { backgroundColor: theme.colors.canvas }]}> 
          <View style={[styles.shellContentLayer, { backgroundColor: theme.colors.canvas, pointerEvents: 'box-none', top: shellTopInset }]}> 
            <View style={[styles.shellScreenCanvas, { backgroundColor: theme.colors.canvas }]}> 
              {children}
            </View>
          </View>
        </View>

        {showDock ? (
          <View
            onLayout={event => {
              const nextHeight = Math.round(event.nativeEvent.layout.height);
              if (nextHeight > 0 && nextHeight !== dockHeight) {
                setDockHeight(nextHeight);
              }
            }}
            style={[
              styles.bottomDockFloating,
              {
                bottom: dockBottom,
                left: TAB_DOCK_HORIZONTAL_MARGIN,
                right: TAB_DOCK_HORIZONTAL_MARGIN,
              },
            ]}
          >
            <GlassTabPill items={tabItems} onPress={handleChangeMode} />
          </View>
        ) : null}
      </View>
    </AppShellContext.Provider>
  );
}

const styles = StyleSheet.create({
  shellRoot: {
    flex: 1,
  },
  shellContentStack: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  shellContentLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  shellScreenCanvas: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  bottomDockFloating: {
    position: 'absolute',
    zIndex: 25,
  },
});

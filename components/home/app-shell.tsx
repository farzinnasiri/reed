import { Ionicons } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
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

  const showDock = !(activeMode === 'workout' && hasActiveWorkoutSession) && !isEditingSettingsProfile;
  const isFullscreenWorkout = activeMode === 'workout' && hasActiveWorkoutSession;
  const dockBottom = TAB_DOCK_BASE_BOTTOM_OFFSET + insets.bottom;
  const dockReservedSpace = showDock ? dockBottom + dockHeight : insets.bottom + theme.spacing.sm;

  const tabItems: Array<{
    accessibilityLabel: string;
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
    router.push(appModeRoutes[mode]);
  }

  return (
    <AppShellContext.Provider
      value={{
        displayName,
        dockReservedSpace,
        hasActiveWorkoutSession,
        setIsEditingSettingsProfile,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.shellRoot,
          {
            paddingBottom: isFullscreenWorkout ? 0 : theme.spacing.lg,
            paddingHorizontal: activeMode === 'chat' ? 0 : theme.spacing.lg,
            paddingTop: activeMode === 'chat' ? 0 : theme.spacing.xl,
          },
        ]}
      >
        <View style={styles.shellContentStack}>
          <View style={[styles.shellContentLayer, { pointerEvents: 'box-none' }]}> 
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
      </KeyboardAvoidingView>
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
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  shellScreenCanvas: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bottomDockFloating: {
    position: 'absolute',
    zIndex: 25,
  },
});

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { HomeSurface } from '@/components/home/home-surface';
import { ProfileSurface } from '@/components/home/profile-surface';
import { getFirstName, pickHomeGreeting } from '@/components/home/home-greetings';
import type { AppMode } from '@/components/home/types';
import { ReedSurface } from '@/components/reed/reed-surface';
import {
  TAB_DOCK_BASE_BOTTOM_OFFSET,
  TAB_DOCK_HORIZONTAL_MARGIN,
  TAB_PILL_MIN_HEIGHT,
} from '@/components/ui/glass-material';
import { GlassTabPill } from '@/components/ui/glass-tab-pill';
import { WorkoutSurface } from '@/components/workout/workout-surface';
import { api } from '@/convex/_generated/api';
import { useReedTheme } from '@/design/provider';

type SignedInShellProps = {
  appMode: AppMode;
  displayName: string;
  onChangeMode: (mode: AppMode) => void;
};

export function SignedInShell({
  appMode,
  displayName,
  onChangeMode,
}: SignedInShellProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const currentWorkoutSession = useQuery(api.liveSessions.getCurrent, {});
  const hasActiveWorkoutSession = currentWorkoutSession !== null && currentWorkoutSession !== undefined;
  const [dockHeight, setDockHeight] = useState(TAB_PILL_MIN_HEIGHT);
  const [isEditingSettingsProfile, setIsEditingSettingsProfile] = useState(false);
  const [currentDayKey, setCurrentDayKey] = useState(() => new Date().toDateString());
  const homeHeadline = useMemo(
    () => pickHomeGreeting(getFirstName(displayName)),
    [currentDayKey, displayName],
  );

  useEffect(() => {
    if (appMode !== 'user' && isEditingSettingsProfile) {
      setIsEditingSettingsProfile(false);
    }
  }, [appMode, isEditingSettingsProfile]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextDayKey = new Date().toDateString();
      setCurrentDayKey(prev => (prev === nextDayKey ? prev : nextDayKey));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

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
          color={String(appMode === 'home' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={appMode === 'home' ? 'home' : 'home-outline'}
          size={22}
        />
      ),
      id: 'home',
      isActive: appMode === 'home',
    },
    {
      accessibilityLabel: 'Workout',
      icon: (
        <Ionicons
          color={String(appMode === 'workout' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={appMode === 'workout' ? 'barbell' : 'barbell-outline'}
          size={22}
        />
      ),
      id: 'workout',
      isActive: appMode === 'workout',
    },
    {
      accessibilityLabel: 'Reed',
      icon: (
        <Ionicons
          color={String(appMode === 'chat' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={appMode === 'chat' ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
          size={22}
        />
      ),
      id: 'chat',
      isActive: appMode === 'chat',
    },
    {
      accessibilityLabel: 'Profile',
      icon: (
        <Ionicons
          color={String(appMode === 'user' ? theme.colors.accentPrimary : theme.colors.textMuted)}
          name={appMode === 'user' ? 'person' : 'person-outline'}
          size={22}
        />
      ),
      id: 'user',
      isActive: appMode === 'user',
    },
  ];

  const showDock = !(appMode === 'workout' && hasActiveWorkoutSession) && !isEditingSettingsProfile;
  const isFullscreenWorkout = appMode === 'workout' && hasActiveWorkoutSession;
  const dockBottom = TAB_DOCK_BASE_BOTTOM_OFFSET + insets.bottom;
  const dockReservedSpace = showDock ? dockBottom + dockHeight : insets.bottom + theme.spacing.sm;

  function renderModeSurface(mode: AppMode) {
    switch (mode) {
      case 'home':
        return (
          <HomeSurface
            hasActiveSession={hasActiveWorkoutSession}
            homeHeadline={homeHeadline}
            onOpenWorkout={() => onChangeMode('workout')}
          />
        );
      case 'workout':
        return (
          <WorkoutSurface
            onExitWorkout={() => onChangeMode('chat')}
            showStartBackButton={false}
          />
        );
      case 'chat':
        return <ReedSurface displayName={displayName} dockReservedSpace={dockReservedSpace} />;
      case 'user':
        return <ProfileSurface displayName={displayName} onEditingProfileChange={setIsEditingSettingsProfile} />;
      default:
        return null;
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[
        styles.shellRoot,
        {
          paddingBottom: isFullscreenWorkout ? 0 : theme.spacing.lg,
          paddingHorizontal: appMode === 'chat' ? 0 : theme.spacing.lg,
          paddingTop: appMode === 'chat' ? 0 : theme.spacing.xl,
        },
      ]}
    >
      <View style={styles.shellContentStack}>
        <View style={[styles.shellContentLayer, { pointerEvents: 'box-none' }]}>
          <View style={[styles.shellScreenCanvas, { backgroundColor: theme.colors.canvas }]}>
            {renderModeSurface(appMode)}
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
          <GlassTabPill items={tabItems} onPress={onChangeMode} />
        </View>
      ) : null}
    </KeyboardAvoidingView>
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

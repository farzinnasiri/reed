import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from 'convex/react';
import { AppShellContext } from '@/components/home/app-shell-context';
import { api } from '@/convex/_generated/api';
import { useReedTheme } from '@/design/provider';
import { useCoachMessageUnread } from './use-coach-message-unread';
import { useDeviceTimeZoneSync } from './use-device-time-zone-sync';

type AppShellProps = {
  children: ReactNode;
  displayName: string;
};

// Reed is home. Sessions, Progress, and You are reached from the Pulse and the dock, so the shell
// no longer renders a tab dock.
export function AppShell({ children, displayName }: AppShellProps) {
  const { theme, setAutomaticAccent } = useReedTheme();
  const trainingProfile = useQuery(api.profiles.viewerTrainingProfile, {});
  const training = trainingProfile?.trainingProfile;
  const gender = training?.onboarding?.sex;
  const hasTrainingProfile = trainingProfile !== undefined;
  useEffect(() => {
    if (hasTrainingProfile) setAutomaticAccent(gender, { onlyIfUnset: true });
  }, [gender, hasTrainingProfile, setAutomaticAccent]);
  const currentWorkoutSession = useQuery(api.liveSessions.getActiveStatus, {});
  const profileInsight = useQuery(api.profileInsight.getCurrent, {});
  const { hasUnreadCoachMessage, markCoachMessageRead } = useCoachMessageUnread(profileInsight?.content);
  useDeviceTimeZoneSync();

  return (
    <AppShellContext.Provider
      value={{
        activeWorkout: currentWorkoutSession ?? null,
        displayName,
        hasUnreadCoachMessage,
        markCoachMessageRead,
      }}
    >
      <View style={[styles.shellRoot, { backgroundColor: theme.colors.canvas }]}>
        <View style={[styles.shellContentStack, { backgroundColor: theme.colors.canvas }]}>
          <View style={[styles.shellContentLayer, { backgroundColor: theme.colors.canvas, pointerEvents: 'box-none' }]}>
            <View style={[styles.shellScreenCanvas, { backgroundColor: theme.colors.canvas }]}>
              {children}
            </View>
          </View>
        </View>
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
});

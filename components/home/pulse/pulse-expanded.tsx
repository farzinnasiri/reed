import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import { ReedText } from '@/components/ui/reed-text';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { appViewRoutes } from '../app-routes';
import { GoalsHomeCard } from '../goals-home-card';
import { formatCurrentWeekRange, ProfileDashboardCards } from '../profile-surface';

type PulseExpandedProps = {
  /** Pulling the header up closes the Pulse; the container owns the gesture. */
  closeGesture: GestureType;
  onClose: () => void;
  onOpenSessions: () => void;
};

// What the Pulse grows into: the Progress view, in compact sections. It adds no metrics of its own.
export function PulseExpanded({ closeGesture, onClose, onOpenSessions }: PulseExpandedProps) {
  const { theme } = useReedTheme();

  return (
    <View style={styles.root}>
      <GestureDetector gesture={closeGesture}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <ReedText variant="title">This week</ReedText>
            <ReedText tone="muted" variant="caption">{formatCurrentWeekRange()}</ReedText>
          </View>
          <Pressable
            accessibilityLabel="Close progress"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.close, { backgroundColor: theme.colors.surfaceRaised }, getTapScaleStyle(pressed)]}
          >
            <Ionicons color={String(theme.colors.inkSecondary)} name="chevron-up" size={20} />
          </Pressable>
        </View>
      </GestureDetector>

      <ScrollView
        contentContainerStyle={styles.content}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <ProfileDashboardCards afterCoachNote={<SessionsRow onPress={onOpenSessions} />} />
        <GoalsHomeCard onOpenGoals={() => router.push(appViewRoutes.goals)} />
      </ScrollView>
    </View>
  );
}

// The way into the Sessions page (history, summaries), now that the header barbell is gone.
function SessionsRow({ onPress }: { onPress: () => void }) {
  const { theme } = useReedTheme();

  return (
    <Pressable
      accessibilityHint="Opens your sessions and history."
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.sessionsRow,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg },
        getTapScaleStyle(pressed),
      ]}
    >
      <View style={[styles.sessionsTag, { backgroundColor: theme.colors.surfaceRaised }]}>
        <Ionicons color={String(theme.colors.inkSecondary)} name="barbell-outline" size={18} />
      </View>
      <View style={styles.sessionsCopy}>
        <ReedText variant="bodyStrong">Sessions</ReedText>
        <ReedText tone="muted" variant="caption">History, summaries, records</ReedText>
      </View>
      <Ionicons color={String(theme.colors.inkMuted)} name="chevron-forward" size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  close: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  content: {
    gap: 10,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  headerCopy: {
    gap: 2,
  },
  root: {
    flex: 1,
  },
  sessionsCopy: {
    flex: 1,
  },
  sessionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sessionsTag: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});

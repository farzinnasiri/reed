import type { WorkoutTiming } from './workout-duration';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { YouButton } from '@/components/home/you-button';
import { ReedIconButton } from '@/components/ui/reed-icon-button';
import { ReedText } from '@/components/ui/reed-text';
import { Surface } from '@/components/ui/surface';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { useWorkoutHistory } from './use-workout-history';
import { useWorkoutSessionRuntime } from './workout-session-runtime';
import { useCompactElapsedLabel } from './use-compact-elapsed-label';
import { useUserOperation } from '@/lib/use-user-operation';
import { TimelinePage } from './workout-timeline-page';
import { WorkoutSessionInsightsSheet } from './workout-session-insights-sheet';
import { WorkoutSessionNotesSheet } from './workout-session-notes-sheet';
import { styles } from './workout-history-screen.styles';
import type { LiveSessionStatusStrip, TimelineRow } from './workout-surface.types';

type HistoryProps = {
  selectedEndedSessionId: Id<'liveSessions'> | null;
  onOpenSession: (id: Id<'liveSessions'>) => void;
  onShowHistory: () => void;
  onResume: () => void;
  onStart: () => void;
  onBack: () => void;
  contentTopInset: number;
  renderSessionChrome: (props: {
    children: ReactNode;
    onBack: () => void;
    onOpenInsights?: () => void;
    overlays?: ReactNode;
    status: LiveSessionStatusStrip;
    timing?: WorkoutTiming;
  }) => ReactNode;
};

export function WorkoutHistoryScreen({
  selectedEndedSessionId,
  onOpenSession,
  onShowHistory,
  onResume,
  onStart,
  onBack,
  contentTopInset: statusStripHeight,
  renderSessionChrome,
}: HistoryProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const { session } = useWorkoutSessionRuntime();
  const history = useWorkoutHistory(selectedEndedSessionId);
  const {
    latestEndedSummary,
    endedSessionsPage,
    quickLogActivity,
    quickLogDayGroups,
    endedSessionInsights,
    endedSessionTimeline,
    isHistoryExpanded,
    expandedQuickLogDays,
    canPageNewer,
  } = history;
  const [isEndedInsightsOpen, setIsEndedInsightsOpen] = useState(false);
  const [isSessionNotesOpen, setIsSessionNotesOpen] = useState(false);
  const notes = useUserOperation('workout.history.notes', 'Could not save notes. Please try again.');
  const updateNotes = useMutation(api.liveSessions.updateSessionNotes);
  const isSavingSessionNotes = notes.isWorking;
  const isWorking = notes.isWorking;
  const errorMessage = notes.errorMessage;
  async function handleSaveSessionNotes(sessionId: Id<'liveSessions'>, value: string) {
    await notes.run(async () => {
      await updateNotes({ sessionId, notes: value });
      setIsSessionNotesOpen(false);
    });
  }
  const completedExercises = latestEndedSummary?.exercises ?? [];
  const hasActiveSession = Boolean(session);
  const activeSessionStartedAt = session?.session.startedAt ?? null;
  const activeSessionSets =
    session?.timeline.reduce((total: number, row: { setCount: number }) => total + row.setCount, 0) ?? 0;

  if (selectedEndedSessionId) {
    const endedStatus = endedSessionTimeline
      ? buildEndedStatusStrip(
          endedSessionTimeline.startedAt,
          endedSessionTimeline.manualDurationSeconds === undefined ? endedSessionTimeline.endedAt : endedSessionTimeline.startedAt + endedSessionTimeline.manualDurationSeconds * 1000,
          endedSessionTimeline.timeline,
        )
      : {
          completedSetsLabel: '0 sets',
          durationLabel: '0m',
          microLineTokens: [],
          workSlotKind: 'active' as const,
          workSlotLabel: 'Completed',
        };

    return renderSessionChrome({
      timing: endedSessionTimeline ? { sessionId: selectedEndedSessionId, ...endedSessionTimeline } : undefined,
      children:
        endedSessionTimeline === undefined ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator color={String(theme.colors.accent)} />
            <ReedText tone="muted" variant="caption">
              Loading session.
            </ReedText>
          </View>
        ) : endedSessionTimeline === null ? (
          <View style={styles.trainingShelf}>
            <ReedText variant="bodyStrong">Session unavailable.</ReedText>
          </View>
        ) : (
          <TimelinePage
            activeRestCard={null}
            contentTopInset={statusStripHeight}
            elapsedLabel={formatEndedDuration(endedSessionTimeline.startedAt, endedSessionTimeline.manualDurationSeconds === undefined ? endedSessionTimeline.endedAt : endedSessionTimeline.startedAt + endedSessionTimeline.manualDurationSeconds * 1000)}
            errorMessage={null}
            hasNotes={Boolean(endedSessionTimeline.userNotes?.trim())}
            onOpenNotes={() => setIsSessionNotesOpen(true)}
            timeline={endedSessionTimeline.timeline}
          />
        ),
      onBack: () => {
        setIsEndedInsightsOpen(false);
        setIsSessionNotesOpen(false);
        onShowHistory();
      },
      onOpenInsights: () => setIsEndedInsightsOpen(true),
      overlays: (
        <>
          <WorkoutSessionInsightsSheet
            errorMessage={endedSessionInsights === null ? 'Insights are not available for this session.' : null}
            insights={endedSessionInsights ?? null}
            isLoading={endedSessionInsights === undefined}
            isOpen={isEndedInsightsOpen}
            onClose={() => setIsEndedInsightsOpen(false)}
          />

          {endedSessionTimeline && selectedEndedSessionId ? (
            <WorkoutSessionNotesSheet
              initialNotes={endedSessionTimeline.userNotes ?? ''}
              isOpen={isSessionNotesOpen}
              isSaving={isSavingSessionNotes}
              onClose={() => setIsSessionNotesOpen(false)}
              onSave={(notes) => handleSaveSessionNotes(selectedEndedSessionId, notes)}
            />
          ) : null}
        </>
      ),
      status: endedStatus,
    });
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.startStateScroll,
        { paddingBottom: insets.bottom + theme.spacing.xl, paddingTop: insets.top + theme.spacing.lg },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.startState}
    >
      <View style={styles.startTopRow}>
        <ReedIconButton accessibilityLabel="Back to Reed" onPress={onBack} shape="pill">
          <Ionicons color={String(theme.colors.ink)} name="arrow-back" size={18} />
        </ReedIconButton>
        <ReedText style={styles.startTitle} variant="title">
          Sessions
        </ReedText>
        <YouButton />
      </View>

      <Surface contentStyle={styles.startHeroContent} style={styles.startHeroSurface}>
        <View style={styles.startHeroTopRow}>
          <View style={styles.startCopy}>
            <ReedText variant="headline">{hasActiveSession ? 'Resume session' : 'Start session'}</ReedText>
            <ReedText tone="muted">
              {hasActiveSession ? 'A workout is already open.' : 'Start empty. Add exercises as you train.'}
            </ReedText>
          </View>
          <Pressable
            accessibilityLabel={
              hasActiveSession ? 'Resume active workout session' : 'Start a live workout session'
            }
            onPress={hasActiveSession ? () => onResume() : onStart}
            style={({ pressed }) => [
              styles.startHeroButton,
              {
                backgroundColor: theme.colors.accent,
                ...getTapScaleStyle(pressed, isWorking),
              },
            ]}
          >
            <Ionicons color={String(theme.colors.accentText)} name="arrow-forward" size={18} />
          </Pressable>
        </View>
      </Surface>

      {session && activeSessionStartedAt ? (
        <View style={styles.rows}>
          <HistoryRow
            accessibilityLabel="Resume ongoing workout session"
            mark={<LiveMark />}
            meta={(
              <ReedText numberOfLines={1} tone="muted" variant="caption">
                {formatSessionDate(activeSessionStartedAt)} ·{' '}
                <OngoingElapsedLabel startedAt={activeSessionStartedAt} manualDurationSeconds={session.session.manualDurationSeconds} />
                {` · ${session.timeline.length} ${session.timeline.length === 1 ? 'exercise' : 'exercises'} · ${activeSessionSets} ${activeSessionSets === 1 ? 'set' : 'sets'}`}
              </ReedText>
            )}
            onPress={() => onResume()}
            title="Ongoing session"
          />
        </View>
      ) : null}

      <View style={styles.startHistory}>
        <View style={styles.startHistoryHeader}>
          <ReedText variant="headline">History</ReedText>
          <View style={styles.sessionHeaderActions}>
            <Pressable
              accessibilityLabel={isHistoryExpanded ? 'Collapse history' : 'Expand history'}
              onPress={() => history.toggleHistory()}
              style={({ pressed }) => [styles.sessionPagerButton, getTapScaleStyle(pressed)]}
            >
              <Ionicons
                color={String(theme.colors.inkMuted)}
                name={isHistoryExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
              />
            </Pressable>
          </View>
        </View>
        {!isHistoryExpanded ? null : endedSessionsPage === undefined ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator color={String(theme.colors.accent)} />
            <ReedText tone="muted" variant="caption">
              Loading sessions.
            </ReedText>
          </View>
        ) : endedSessionsPage.summaries.length > 0 ? (
          <>
            <View style={styles.rows}>
              {endedSessionsPage.summaries.map((item, index: number) => {
                const totalSets = item.exercises.reduce((total, exercise) => total + exercise.setCount, 0);
                const duration = formatSessionDuration(item.startedAt, item.manualDurationSeconds === undefined ? item.endedAt : item.startedAt + item.manualDurationSeconds * 1000);

                return (
                  <HistoryRow
                    accessibilityLabel={`Open session from ${formatSessionDate(item.startedAt)}`}
                    isLast={index === endedSessionsPage.summaries.length - 1}
                    key={item.sessionId}
                    mark={<DateMark timestamp={item.startedAt} />}
                    meta={<ReedText numberOfLines={1} tone="muted" variant="caption">{duration} · {totalSets} {totalSets === 1 ? 'set' : 'sets'}</ReedText>}
                    onPress={() => {
                      setIsEndedInsightsOpen(false);
                      onOpenSession(item.sessionId);
                    }}
                    title={formatSessionExercisePreview(item)}
                  />
                );
              })}
            </View>
            {canPageNewer || endedSessionsPage.nextBeforeStartedAt ? (
              <View style={styles.sessionPaginationRow}>
                <Pressable
                  accessibilityLabel="Show newer sessions"
                  disabled={!canPageNewer}
                  onPress={() => history.newerPage()}
                  style={({ pressed }) => [
                    styles.sessionPageControl,
                    { opacity: !canPageNewer ? 0.35 : 1 },
                    getTapScaleStyle(pressed, !canPageNewer),
                  ]}
                >
                  <Ionicons color={String(theme.colors.inkMuted)} name="chevron-back" size={15} />
                  <ReedText tone="muted" variant="caption">
                    Newer
                  </ReedText>
                </Pressable>
                <Pressable
                  accessibilityLabel="Show earlier sessions"
                  disabled={!endedSessionsPage.nextBeforeStartedAt}
                  onPress={() => {
                    if (endedSessionsPage.nextBeforeStartedAt) {
                      history.olderPage();
                    }
                  }}
                  style={({ pressed }) => [
                    styles.sessionPageControl,
                    { opacity: endedSessionsPage.nextBeforeStartedAt ? 1 : 0.35 },
                    getTapScaleStyle(pressed, !endedSessionsPage.nextBeforeStartedAt),
                  ]}
                >
                  <ReedText tone="muted" variant="caption">
                    Earlier
                  </ReedText>
                  <Ionicons color={String(theme.colors.inkMuted)} name="chevron-forward" size={15} />
                </Pressable>
              </View>
            ) : null}
          </>
        ) : completedExercises.length > 0 ? (
          <ReedText tone="muted" variant="caption">
            Earlier sessions will appear here.
          </ReedText>
        ) : (
          <View style={styles.trainingShelf}>
            <ReedText variant="bodyStrong">Reed is ready when you are.</ReedText>
            <ReedText tone="muted" variant="caption">
              Log a few sessions and this page will surface patterns, records, and useful repeats.
            </ReedText>
          </View>
        )}
      </View>

      <View style={styles.startHistory}>
        <View style={styles.startHistoryHeader}>
          <ReedText variant="headline">Quick logs</ReedText>
        </View>
        {quickLogActivity === undefined ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator color={String(theme.colors.accent)} />
            <ReedText tone="muted" variant="caption">
              Loading quick logs.
            </ReedText>
          </View>
        ) : quickLogDayGroups.length > 0 ? (
          <View style={styles.quickLogDayList}>
            {quickLogDayGroups.map((group, index) => {
              const isExpanded = expandedQuickLogDays.includes(group.dayKey);
              const preview = formatQuickLogDayPreview(group.logs);

              return (
                <View
                  key={group.dayKey}
                  style={[
                    styles.quickLogDayBlock,
                    index < quickLogDayGroups.length - 1
                      ? { borderBottomColor: theme.colors.line }
                      : { borderBottomWidth: 0 },
                  ]}
                >
                  <HistoryRow
                    accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} quick logs from ${formatSessionDate(group.latestLoggedAt)}`}
                    bare
                    mark={<DateMark timestamp={group.latestLoggedAt} />}
                    meta={<ReedText numberOfLines={1} tone="muted" variant="caption">{preview}</ReedText>}
                    onPress={() => history.toggleQuickLogDay(group.dayKey)}
                    title={`${group.logs.length} ${group.logs.length === 1 ? 'quick log' : 'quick logs'}`}
                    trailing={isExpanded ? 'chevron-up' : 'chevron-down'}
                  />

                  {isExpanded ? (
                    <View style={styles.quickLogEntries}>
                      {group.logs.map((logEntry) => (
                        <View key={logEntry._id} style={styles.quickLogEntryRow}>
                          <View
                            style={[styles.quickLogEntryDot, { backgroundColor: theme.colors.inkMuted }]}
                          />
                          <View style={styles.quickLogEntryCopy}>
                            <ReedText numberOfLines={1} variant="caption">
                              {logEntry.exerciseName}
                            </ReedText>
                            <ReedText numberOfLines={1} tone="muted" variant="caption">
                              {logEntry.summary}
                            </ReedText>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <ReedText tone="muted" variant="caption">
            Quick logs will appear here.
          </ReedText>
        )}
      </View>

      {errorMessage ? (
        <ReedText style={styles.inlineError} tone="danger">
          {errorMessage}
        </ReedText>
      ) : null}
    </ScrollView>
  );
}

/** A session, a quick-log day or the ongoing session: a mark, what it was, and a quiet line about it. */
function HistoryRow({ accessibilityLabel, bare = false, isLast = false, mark, meta, onPress, title, trailing = 'chevron-forward' }: {
  accessibilityLabel: string;
  /** No divider (the owner draws its own). */
  bare?: boolean;
  isLast?: boolean;
  mark: ReactNode;
  meta: ReactNode;
  onPress: () => void;
  title: string;
  trailing?: 'chevron-forward' | 'chevron-up' | 'chevron-down';
}) {
  const { theme } = useReedTheme();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.historyRow,
        !bare && !isLast ? { borderBottomColor: theme.colors.line, borderBottomWidth: StyleSheet.hairlineWidth } : null,
        getTapScaleStyle(pressed),
      ]}
    >
      {mark}
      <View style={styles.historyRowCopy}>
        <ReedText numberOfLines={2} variant="bodyStrong">{title}</ReedText>
        {meta}
      </View>
      <Ionicons color={String(theme.colors.inkMuted)} name={trailing} size={18} />
    </Pressable>
  );
}

function DateMark({ timestamp }: { timestamp: number }) {
  const { theme } = useReedTheme();
  return (
    <View style={[styles.historyMark, { backgroundColor: theme.colors.surfaceRaised }]}>
      <ReedText tone="muted" variant="micro">{formatSessionWeekday(timestamp)}</ReedText>
      <ReedText variant="headline">{formatSessionDay(timestamp)}</ReedText>
    </View>
  );
}

function LiveMark() {
  const { theme } = useReedTheme();
  return (
    <View style={[styles.historyMark, { backgroundColor: theme.colors.accentSoft }]}>
      <View style={[styles.liveDot, { backgroundColor: theme.colors.accent }]} />
    </View>
  );
}

function formatSessionDate(timestamp: number) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  }).format(new Date(timestamp));
}

function formatSessionWeekday(timestamp: number) {
  return new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(timestamp));
}

function formatSessionDay(timestamp: number) {
  return new Intl.DateTimeFormat('en', { day: 'numeric' }).format(new Date(timestamp));
}

function formatSessionExercisePreview(session: {
  exercises: { exerciseName: string }[];
  exerciseCount: number;
}) {
  const visibleExercises = session.exercises.slice(0, 2).map((exercise) => exercise.exerciseName);
  const remaining = Math.max(0, session.exerciseCount - visibleExercises.length);
  if (visibleExercises.length === 0) return 'No exercises logged';
  return `${visibleExercises.join(' · ')}${remaining > 0 ? ` +${remaining}` : ''}`;
}

function formatQuickLogDayPreview(logs: { exerciseName: string }[]) {
  const visibleLogs = logs.slice(0, 2).map((logEntry) => logEntry.exerciseName);
  const remaining = Math.max(0, logs.length - visibleLogs.length);
  return `${visibleLogs.join(' · ')}${remaining > 0 ? ` +${remaining}` : ''}`;
}

function formatSessionDuration(startedAt: number, endedAt: number) {
  const minutes = Math.max(1, Math.round((endedAt - startedAt) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatEndedDuration(startedAt: number, endedAt: number) {
  const minutes = Math.max(0, Math.round((endedAt - startedAt) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function buildEndedStatusStrip(
  startedAt: number,
  endedAt: number,
  timeline: TimelineRow[],
): LiveSessionStatusStrip {
  const completedSets = timeline.reduce((total, row) => total + row.setCount, 0);
  return {
    completedSetsLabel: `${completedSets} ${completedSets === 1 ? 'set' : 'sets'}`,
    durationLabel: formatEndedDuration(startedAt, endedAt),
    microLineTokens: [],
    workSlotKind: 'active',
    workSlotLabel: 'Completed',
  };
}

function OngoingElapsedLabel({ startedAt, manualDurationSeconds }: { startedAt: number; manualDurationSeconds?: number }) {
  return useCompactElapsedLabel(startedAt, manualDurationSeconds) ?? '0s';
}

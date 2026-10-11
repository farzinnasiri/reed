import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { usePulse } from '@/components/home/pulse/use-pulse';
import type { MascotController } from '@/components/reed/mascot';
import { SessionDockMascot } from '@/components/reed/session/session-dock-mascot';
import { LiveDot } from '@/components/ui/live-dot';
import { ReedText } from '@/components/ui/reed-text';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { getTapScaleStyle } from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { reedSessionMetrics, reedWorkoutReviewMetrics } from '@/design/system';
import { suggestSessionDuration } from '@/domains/workout/session-duration';
import { useUserOperation } from '@/lib/use-user-operation';
import { groupByWeek } from './history-weeks';
import { historyPeriodRange, type HistoryPeriod } from './history-period';
import { DockFrame } from './session-dock';
import { DOCK_HEIGHT } from './session-dock.styles';
import { SessionRecap } from './session-recap';
import { useCompactElapsedLabel } from './use-compact-elapsed-label';
import { useWorkoutHistory, type EndedSummary } from './use-workout-history';
import { SessionHistoryRow } from './session-history-row';
import { SessionDeleteSheet } from './session-delete-sheet';
import { formatCompactDuration } from './session-time-format';
import { useWorkoutSessionRuntime } from './workout-session-runtime';
import { WorkoutSessionNotesSheet } from './workout-session-notes-sheet';
import type { WorkoutSessionStrip } from './workout-session-status-strip';
import { styles } from './workout-history-screen.styles';

// A session open this long was almost certainly forgotten.
const STALE_SESSION_MS = 6 * 60 * 60 * 1000;

type HistoryProps = {
  selectedEndedSessionId: Id<'liveSessions'> | null;
  onOpenSession: (id: Id<'liveSessions'>) => void;
  onShowHistory: () => void;
  onResume: () => void;
  /** Finish a session that was left open: opens it with the finish sheet up. */
  onFinishOld: () => void;
  onStart: () => void;
  /** The session just finished, so its recap celebrates. */
  justFinishedId: Id<'liveSessions'> | null;
  onBack: () => void;
  contentTopInset: number;
  mascot: MascotController;
  renderSessionChrome: (props: {
    children: ReactNode;
    overlays?: ReactNode;
    dock?: ReactNode;
    strip: ComponentProps<typeof WorkoutSessionStrip>;
  }) => ReactNode;
};

export function WorkoutHistoryScreen({
  selectedEndedSessionId,
  onOpenSession,
  onShowHistory,
  onResume,
  onFinishOld,
  onStart,
  justFinishedId,
  onBack,
  contentTopInset,
  mascot,
  renderSessionChrome,
}: HistoryProps) {
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const [now] = useState(() => Date.now());
  const [entryType, setEntryType] = useState<'all' | 'workouts' | 'quick'>(
    'all',
  );
  const [period, setPeriod] = useState<HistoryPeriod>('week');
  const [actionSession, setActionSession] = useState<EndedSummary | null>(null);
  const { session } = useWorkoutSessionRuntime();
  const pulse = usePulse();
  const range = useMemo(() => historyPeriodRange(period, now), [period, now]);
  const history = useWorkoutHistory(selectedEndedSessionId, range);
  const list = useRef<FlatList<HistoryItem>>(null);
  const {
    sessions,
    hasMore,
    hasMoreQuickLogs,
    isLoadingMore,
    loadMore,
    loadOlderQuickLogs,
    quickLogActivity,
    quickLogDayGroups,
    endedSessionInsights,
    endedSessionTimeline,
    expandedQuickLogDays,
  } = history;
  const [isSessionNotesOpen, setIsSessionNotesOpen] = useState(false);
  const notes = useUserOperation(
    'workout.history.notes',
    'Could not save notes. Please try again.',
  );
  const updateNotes = useMutation(api.liveSessions.updateSessionNotes);
  const setDuration = useMutation(api.liveSessions.setSessionDuration);
  const hasActiveSession = Boolean(session);
  const activeSessionStartedAt = session?.session.startedAt ?? null;
  const isStale =
    activeSessionStartedAt !== null &&
    session?.session.manualDurationSeconds === undefined &&
    now - activeSessionStartedAt > STALE_SESSION_MS;

  const weeks = useMemo(() => {
    const cutoff = range.since ?? 0;
    const entries: HistoryEntry[] = [];
    if (entryType !== 'quick') {
      for (const item of sessions ?? []) {
        if (item.startedAt >= cutoff)
          entries.push({
            kind: 'workout',
            startedAt: item.startedAt,
            session: item,
          });
      }
    }
    if (entryType !== 'workouts') {
      // Keep older quick logs behind the unread workout pages, so pagination never jumps over them.
      const oldestLoaded =
        hasMore && entryType === 'all'
          ? (sessions?.at(-1)?.startedAt ?? Infinity)
          : 0;
      for (const group of quickLogDayGroups) {
        const logs = group.logs.filter((log) => log.loggedAt >= cutoff);
        const latestLoggedAt = Math.max(0, ...logs.map((log) => log.loggedAt));
        if (logs.length && latestLoggedAt >= oldestLoaded) {
          entries.push({
            kind: 'quick',
            startedAt: latestLoggedAt,
            group: { ...group, logs, latestLoggedAt },
          });
        }
      }
    }
    entries.sort((left, right) => right.startedAt - left.startedAt);
    return groupByWeek(entries, now).map((week) => {
      const workouts = week.items.filter((item) => item.kind === 'workout');
      const quickLogs = week.items.reduce(
        (total, item) =>
          total + (item.kind === 'quick' ? item.group.logs.length : 0),
        0,
      );
      const sets = workouts.reduce(
        (total, item) => total + item.session.presentation.sets,
        0,
      );
      const logged = workouts.filter(
        (item) => item.session.presentation.sets > 0,
      ).length;
      const unlogged = workouts.length - logged;
      const summary = [
        logged
          ? `${logged} ${logged === 1 ? 'workout' : 'workouts'} · ${sets} ${sets === 1 ? 'set' : 'sets'}`
          : null,
        quickLogs
          ? `${quickLogs} ${quickLogs === 1 ? 'quick log' : 'quick logs'}`
          : null,
        unlogged ? `${unlogged} without logs` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      return { ...week, summary };
    });
  }, [now, sessions, quickLogDayGroups, hasMore, entryType, range.since]);
  const loadingHistory =
    (entryType !== 'quick' && sessions === undefined) ||
    (entryType !== 'workouts' && quickLogActivity === undefined);
  const canLoadOlderWorkouts = hasMore && entryType !== 'quick';
  const canLoadOlderQuickLogs = hasMoreQuickLogs && entryType !== 'workouts';
  const canLoadMore = canLoadOlderWorkouts || canLoadOlderQuickLogs;
  const loadOlder = () => {
    if (canLoadOlderWorkouts) loadMore();
    if (canLoadOlderQuickLogs) loadOlderQuickLogs();
  };
  const olderLabel = canLoadOlderWorkouts
    ? canLoadOlderQuickLogs
      ? 'training'
      : 'workouts'
    : 'quick logs';
  const items = useMemo<HistoryItem[]>(
    () =>
      weeks.flatMap((week) => [
        {
          kind: 'heading' as const,
          key: `week-${week.key}`,
          label: week.label,
          summary: week.summary,
        },
        ...week.items.map((item) => ({
          ...item,
          key:
            item.kind === 'workout'
              ? item.session.sessionId
              : `quick-${item.group.dayKey}`,
        })),
      ]),
    [weeks],
  );
  const resetScroll = () =>
    list.current?.scrollToOffset({ offset: 0, animated: false });
  const changeType = (value: typeof entryType) => {
    setEntryType(value);
    resetScroll();
  };
  const changePeriod = (value: HistoryPeriod) => {
    setPeriod(value);
    resetScroll();
  };
  const openDelete = useCallback(
    (item: EndedSummary) => setActionSession(item),
    [],
  );
  const renderItem = ({ item }: { item: HistoryItem }) =>
    item.kind === 'heading' ? (
      <View
        style={{
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
          gap: theme.spacing.xxs,
        }}
      >
        <ReedText variant="bodyStrong">{item.label}</ReedText>
        <ReedText tone="muted" variant="caption">
          {item.summary}
        </ReedText>
      </View>
    ) : item.kind === 'workout' ? (
      <SessionHistoryRow
        session={item.session}
        onOpen={onOpenSession}
        onDelete={openDelete}
      />
    ) : (
      <QuickLogHistoryRow
        group={item.group}
        expanded={expandedQuickLogDays.includes(item.group.dayKey)}
        onToggle={() => history.toggleQuickLogDay(item.group.dayKey)}
      />
    );

  async function handleSaveSessionNotes(
    sessionId: Id<'liveSessions'>,
    value: string,
  ) {
    await notes.run(async () => {
      await updateNotes({ sessionId, notes: value });
      setIsSessionNotesOpen(false);
    });
  }

  if (selectedEndedSessionId) {
    const ended = endedSessionTimeline;
    const endedAt = ended?.endedAt ?? 0;
    const durationLabel = ended
      ? formatCompactDuration(
          ended.manualDurationSeconds ?? (endedAt - ended.startedAt) / 1000,
        )
      : '0s';
    const lastSetAt = ended
      ? Math.max(
          0,
          ...ended.timeline.flatMap((row) =>
            row.sets.map((setEntry) => setEntry.loggedAt),
          ),
        ) || null
      : null;
    const suggestedSeconds = ended
      ? suggestSessionDuration(
          {
            startedAt: ended.startedAt,
            endedAt: ended.endedAt,
            manualDurationSeconds: ended.manualDurationSeconds,
            lastSetAt,
          },
          now,
        )
      : null;

    return renderSessionChrome({
      strip: {
        lead: <ReedText variant="bodyStrong">Sessions</ReedText>,
        onBack: () => {
          setIsSessionNotesOpen(false);
          onShowHistory();
        },
        sets: '',
      },
      children:
        ended === undefined ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator color={String(theme.colors.accent)} />
            <ReedText tone="muted" variant="caption">
              Loading session.
            </ReedText>
          </View>
        ) : ended === null ? (
          <View style={styles.trainingShelf}>
            <ReedText variant="bodyStrong">Session unavailable.</ReedText>
          </View>
        ) : (
          <SessionRecap
            contentTopInset={contentTopInset}
            data={{
              presentation: ended.presentation,
              dateLabel: formatLongDate(ended.startedAt),
              durationFallback: durationLabel,
              notes: ended.userNotes ?? '',
              minutes: Math.max(
                0,
                Math.round(
                  (ended.manualDurationSeconds ??
                    (endedAt - ended.startedAt) / 1000) / 60,
                ),
              ),
              lastSetAt,
              suggestedSeconds,
              timeline: ended.timeline,
              timeRange: formatTimeRange(ended.startedAt, endedAt),
              timing: {
                sessionId: selectedEndedSessionId,
                startedAt: ended.startedAt,
                endedAt: ended.endedAt,
                manualDurationSeconds: ended.manualDurationSeconds,
              },
            }}
            insightState={{
              value: endedSessionInsights ?? null,
              error:
                endedSessionInsights === null
                  ? 'Insights are not available for this session.'
                  : null,
              loading: endedSessionInsights === undefined,
            }}
            mascot={
              <SessionDockMascot hidden={false} mascot={mascot} size={96} />
            }
            mascotController={mascot}
            celebrate={justFinishedId === selectedEndedSessionId}
            actions={{
              openNotes: () => setIsSessionNotesOpen(true),
              isApplyingDuration: notes.isWorking,
              applyDuration: (seconds) =>
                void notes.run(() =>
                  setDuration({
                    sessionId: selectedEndedSessionId,
                    durationSeconds: seconds,
                  }),
                ),
            }}
            seed={hashString(selectedEndedSessionId)}
          />
        ),
      overlays: ended ? (
        <WorkoutSessionNotesSheet
          initialNotes={ended.userNotes ?? ''}
          isOpen={isSessionNotesOpen}
          isSaving={notes.isWorking}
          onClose={() => setIsSessionNotesOpen(false)}
          onSave={(value) =>
            handleSaveSessionNotes(selectedEndedSessionId, value)
          }
        />
      ) : null,
    });
  }

  return renderSessionChrome({
    strip: {
      lead: <ReedText variant="bodyStrong">Sessions</ReedText>,
      onBack,
      sets: '',
    },
    children: (
      <FlatList
        ref={list}
        data={loadingHistory ? [] : items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        extraData={expandedQuickLogDays}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.gutter,
          paddingTop: contentTopInset,
          paddingBottom: insets.bottom + DOCK_HEIGHT + reedSessionMetrics.dock,
        }}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (canLoadMore && !isLoadingMore) loadOlder();
        }}
        onEndReachedThreshold={0.7}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md }}>
            {pulse ? <TrainingWeek week={pulse.week} /> : null}
            <HistoryFilter
              value={entryType}
              onChange={changeType}
              filled
              options={[
                {
                  value: 'all',
                  label: 'All',
                  accessibilityLabel: 'Show all training',
                },
                {
                  value: 'workouts',
                  label: 'Workouts',
                  accessibilityLabel: 'Show workouts',
                },
                {
                  value: 'quick',
                  label: 'Quick logs',
                  accessibilityLabel: 'Show quick logs',
                },
              ]}
            />
            <View style={{ gap: theme.spacing.xxs }}>
              <HistoryFilter
                value={period}
                onChange={changePeriod}
                options={[
                  {
                    value: 'week',
                    label: 'This week',
                    accessibilityLabel: 'Filter history: This week',
                  },
                  {
                    value: 'month',
                    label: '30 days',
                    accessibilityLabel: 'Filter history: Last 30 days',
                  },
                  {
                    value: 'all',
                    label: 'Any time',
                    accessibilityLabel: 'Filter history: Any time',
                  },
                ]}
              />
              <ReedText
                tone="muted"
                variant="micro"
                style={{ textAlign: 'center' }}
              >
                {range.label}
              </ReedText>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ paddingVertical: theme.spacing.xl }}>
            {loadingHistory ? (
              <View style={styles.loadingInline}>
                <ActivityIndicator color={String(theme.colors.accent)} />
                <ReedText tone="muted" variant="caption">
                  Loading training history.
                </ReedText>
              </View>
            ) : !canLoadMore ? (
              <ReedText tone="muted" variant="caption">
                {entryType === 'all' && period === 'all'
                  ? 'Your workouts and quick logs will appear here.'
                  : 'No training matches these filters.'}
              </ReedText>
            ) : null}
          </View>
        }
        ListFooterComponent={
          <View>
            {canLoadMore ? (
              <HapticPressable
                accessibilityRole="button"
                accessibilityLabel={`Load older ${olderLabel}`}
                disabled={isLoadingMore}
                onPress={loadOlder}
                style={styles.loadingInline}
              >
                {isLoadingMore ? (
                  <ActivityIndicator color={String(theme.colors.accent)} />
                ) : null}
                <ReedText tone="accent" variant="caption">
                  {isLoadingMore
                    ? `Loading older ${olderLabel}.`
                    : `Load older ${olderLabel}`}
                </ReedText>
              </HapticPressable>
            ) : null}
            {notes.errorMessage ? (
              <ReedText style={styles.inlineError} tone="danger">
                {notes.errorMessage}
              </ReedText>
            ) : null}
          </View>
        }
      />
    ),
    overlays: actionSession ? (
      <SessionDeleteSheet
        key={actionSession.sessionId}
        session={actionSession}
        onClose={() => setActionSession(null)}
        onDeleted={() => history.forgetDeletedSession(actionSession.sessionId)}
      />
    ) : null,
    dock: (
      <DockFrame>
        <SessionDockMascot
          hidden={false}
          label="Back to Reed"
          mascot={mascot}
          onTalk={onBack}
        />
        <Pressable
          accessibilityLabel={
            isStale
              ? 'Finish the old workout session'
              : hasActiveSession
                ? 'Resume active workout session'
                : 'Start a live workout session'
          }
          accessibilityRole="button"
          onPress={
            isStale ? onFinishOld : hasActiveSession ? onResume : onStart
          }
          style={({ pressed }) => [
            styles.startButton,
            { backgroundColor: theme.colors.accent },
            getTapScaleStyle(pressed),
          ]}
        >
          {hasActiveSession && activeSessionStartedAt ? (
            <>
              <LiveDot color={String(theme.colors.accentText)} />
              <ReedText
                numberOfLines={1}
                style={[
                  styles.startButtonCopy,
                  { color: theme.colors.accentText },
                ]}
                variant="bodyStrong"
              >
                {isStale ? 'Finish old session' : 'Resume session'}
              </ReedText>
              <OngoingElapsed
                startedAt={activeSessionStartedAt}
                manualDurationSeconds={session?.session.manualDurationSeconds}
              />
            </>
          ) : (
            <>
              <Ionicons
                color={String(theme.colors.accentText)}
                name="barbell-outline"
                size={20}
              />
              <ReedText
                style={{ color: theme.colors.accentText }}
                variant="bodyStrong"
              >
                Start session
              </ReedText>
            </>
          )}
        </Pressable>
      </DockFrame>
    ),
  });
}

type HistoryEntry =
  | { kind: 'workout'; startedAt: number; session: EndedSummary }
  | {
      kind: 'quick';
      startedAt: number;
      group: ReturnType<typeof useWorkoutHistory>['quickLogDayGroups'][number];
    };
type HistoryItem =
  | (HistoryEntry & { key: string })
  | { kind: 'heading'; key: string; label: string; summary: string };

/** Selection changes synchronously; it does not wait for an animated indicator. */
function HistoryFilter<T extends string>({
  value,
  onChange,
  options,
  filled = false,
}: {
  value: T;
  onChange: (value: T) => void;
  filled?: boolean;
  options: { value: T; label: string; accessibilityLabel: string }[];
}) {
  const { theme } = useReedTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.xxs }}>
      {options.map((option) => (
        <HapticPressable
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={option.accessibilityLabel}
          accessibilityState={{ selected: option.value === value }}
          feedback={option.value !== value}
          onPress={() => {
            if (option.value !== value) onChange(option.value);
          }}
          style={({ pressed }) => [
            {
              flex: 1,
              minHeight: 44,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: theme.radii.pill,
              backgroundColor:
                filled && option.value === value
                  ? theme.colors.surfaceRaised
                  : theme.colors.canvas,
            },
            getTapScaleStyle(pressed),
          ]}
        >
          <ReedText
            variant={filled ? 'bodyStrong' : 'caption'}
            tone={
              option.value === value ? (filled ? 'default' : 'accent') : 'muted'
            }
          >
            {option.label}
          </ReedText>
        </HapticPressable>
      ))}
    </View>
  );
}

function TrainingWeek({
  week,
}: {
  week: NonNullable<ReturnType<typeof usePulse>>['week'];
}) {
  const { theme } = useReedTheme();
  return (
    <View
      style={{ gap: theme.spacing.sm }}
      accessibilityLabel={`${week.count}${week.target !== null ? ` of ${week.target}` : ''} training days this week`}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <ReedText variant="caption" tone="secondary">
          Training days this week
        </ReedText>
        <ReedText variant="bodyStrong">
          {week.count}
          <ReedText tone="muted" variant="caption">
            {week.target !== null ? ` / ${week.target}` : ''}
          </ReedText>
        </ReedText>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {week.days.map((day, index) => (
          <View
            key={index}
            style={{ flex: 1, alignItems: 'center', gap: theme.spacing.xxs }}
          >
            <View
              style={{
                width: theme.spacing.lg,
                height: theme.spacing.lg,
                borderRadius: theme.radii.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  day === 'done'
                    ? theme.colors.accent
                    : theme.colors.surfaceRaised,
                borderWidth: day === 'today' ? 1 : 0,
                borderColor: theme.colors.accent,
              }}
            >
              {day === 'done' ? (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={String(theme.colors.accentText)}
                />
              ) : null}
            </View>
            <ReedText
              variant="micro"
              tone={day === 'today' ? 'accent' : 'muted'}
            >
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
            </ReedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function QuickLogHistoryRow({
  group,
  expanded,
  onToggle,
}: {
  group: ReturnType<typeof useWorkoutHistory>['quickLogDayGroups'][number];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { theme } = useReedTheme();
  const names = [...new Set(group.logs.map((log) => log.exerciseName))];
  const title =
    names.slice(0, 2).join(' · ') +
    (names.length > 2 ? ` +${names.length - 2}` : '');
  return (
    <View>
      <HapticPressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} quick logs from ${formatSessionDate(group.latestLoggedAt)}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed, hovered }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.xs,
            borderRadius: theme.radii.md,
            backgroundColor:
              pressed || hovered
                ? theme.colors.surfaceRaised
                : theme.colors.canvas,
          },
          getTapScaleStyle(pressed),
        ]}
      >
        <View
          style={{
            width: reedWorkoutReviewMetrics.artwork,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="flash-outline"
            size={24}
            color={String(theme.colors.inkSecondary)}
          />
        </View>
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <ReedText variant="bodyStrong" numberOfLines={2}>
            {title}
          </ReedText>
          <ReedText tone="secondary" variant="caption">
            {formatSessionDate(group.latestLoggedAt)}
          </ReedText>
          <ReedText tone="muted" variant="caption">
            {group.logs.length}{' '}
            {group.logs.length === 1 ? 'quick log' : 'quick logs'}
          </ReedText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xxs,
          }}
        >
          <ReedText tone="accent" variant="micro">
            {expanded ? 'Hide' : 'View'}
          </ReedText>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={String(theme.colors.accentInk)}
          />
        </View>
      </HapticPressable>
      {expanded ? (
        <View
          style={{
            gap: theme.spacing.sm,
            paddingBottom: theme.spacing.md,
            paddingLeft: reedWorkoutReviewMetrics.artwork + theme.spacing.sm,
          }}
        >
          {group.logs.map((log) => (
            <View key={log._id} style={{ gap: theme.spacing.xxs }}>
              <ReedText variant="caption">{log.exerciseName}</ReedText>
              <ReedText tone="muted" variant="caption">
                {log.summary}
              </ReedText>
              <ReedText tone="muted" variant="micro">
                {new Intl.DateTimeFormat('en', {
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(log.loggedAt)}
              </ReedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function OngoingElapsed({
  startedAt,
  manualDurationSeconds,
}: {
  startedAt: number;
  manualDurationSeconds?: number;
}) {
  const { theme } = useReedTheme();
  const label =
    useCompactElapsedLabel(startedAt, manualDurationSeconds) ?? '0s';
  return (
    <ReedText
      style={{ color: theme.colors.accentText, fontVariant: ['tabular-nums'] }}
      variant="bodyStrong"
    >
      {label}
    </ReedText>
  );
}

function formatSessionDate(timestamp: number) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  }).format(new Date(timestamp));
}

function formatLongDate(timestamp: number) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    weekday: 'long',
  }).format(new Date(timestamp));
}

function formatTimeRange(startedAt: number, endedAt: number) {
  const time = new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${time.format(new Date(startedAt))} – ${time.format(new Date(endedAt))}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1)
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) | 0;
  return hash >>> 0;
}

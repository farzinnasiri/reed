import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Id } from '@/convex/_generated/dataModel';
import { formatExerciseSetupLabel } from '@/domains/workout/modifier-formatting';
import { ReedButton } from '@/components/ui/reed-button';
import { ReedSheet } from '@/components/ui/reed-sheet';
import { ReedText } from '@/components/ui/reed-text';
import {
  createTiming,
  getTapScaleStyle,
  reedEasing,
  reedMotion,
  runReedLayoutAnimation,
  shouldUseNativeDriver,
} from '@/design/motion';
import { useReedTheme } from '@/design/provider';
import { workoutSemanticPalette } from '@/design/system';
import { styles } from './workout-timeline-page.styles';
import type { RestCard, TimelineRow, TimelineSet } from './workout-surface.types';
import { formatClock } from './workout-surface.utils';
import { useRestCountdown } from './use-rest-countdown';
import { useCompactElapsedLabel } from './use-compact-elapsed-label';

type ExerciseCommands = {
  onDeleteSet: (setLogId: Id<'activityLogs'>) => void;
  onOpenExercise: (sessionExerciseId: Id<'liveSessionExercises'>) => void;
  onOpenSet: (sessionExerciseId: Id<'liveSessionExercises'>, setEntry: TimelineSet) => void;
  onReorderTimeline: (orderedSessionExerciseIds: Id<'liveSessionExercises'>[]) => Promise<boolean>;
  onRemoveExercise: (sessionExerciseId: Id<'liveSessionExercises'>) => void;
};
type TimelineEditor = {
  isWorking: boolean;
  isConfirmingFinishSession: boolean;
  onAddExercise: () => void;
  onClearFinishSessionConfirm: () => void;
  onFinishSession: () => void;
  onToggleFinishSessionConfirm: () => void;
} & ({ kind: 'draft'; exercises?: never } | { kind: 'active'; exercises: ExerciseCommands });

type TimelinePageProps = {
  activeRestCard: RestCard | null;
  elapsedLabel: string | null;
  sessionStartedAt?: number;
  errorMessage: string | null;
  hasNotes?: boolean;
  onOpenNotes?: () => void;
  contentTopInset?: number;
  timeline: TimelineRow[];
  /** Absence means read-only. Drafts cannot expose commands for persisted exercises. */
  editor?: TimelineEditor;
};

const TIMELINE_ROW_GAP = 10;

function getTimelineSetDotColor(setEntry: TimelineSet, theme: ReturnType<typeof useReedTheme>['theme']) {
  if ((setEntry.setOutcomeDetails?.failedReps ?? 0) > 0) {
    return theme.colors.dangerInk;
  }

  if (setEntry.warmup) {
    return workoutSemanticPalette.warmup.activeBorder;
  }

  return theme.colors.line;
}

function getTimelineSetupLabel(item: TimelineRow) {
  return formatExerciseSetupLabel(item.exerciseSetupModifiers);
}

export function TimelinePage({ activeRestCard, elapsedLabel, errorMessage, hasNotes = false,
  onOpenNotes, sessionStartedAt, contentTopInset, timeline, editor }: TimelinePageProps) {
  const isReadOnly = !editor;
  const isWorking = editor?.isWorking ?? false;
  const isConfirmingFinishSession = editor?.isConfirmingFinishSession ?? false;
  const exercises = editor?.kind === 'active' ? editor.exercises : null;
  const { theme } = useReedTheme();
  const insets = useSafeAreaInsets();
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [confirmExerciseDeleteId, setConfirmExerciseDeleteId] = useState<Id<'liveSessionExercises'> | null>(null);
  const [displayTimeline, setDisplayTimeline] = useState(timeline);
  const [draggingExerciseId, setDraggingExerciseId] = useState<Id<'liveSessionExercises'> | null>(null);
  const [dragOriginIndex, setDragOriginIndex] = useState<number | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);
  const [highlightedSetIds, setHighlightedSetIds] = useState<Record<string, boolean>>({});
  const [insertedExerciseIds, setInsertedExerciseIds] = useState<Record<string, boolean>>({});
  const [pendingOrder, setPendingOrder] = useState<string | null>(null);
  const rowLayoutsRef = useRef<Record<string, { height: number; y: number }>>({});
  const [dragTranslationY] = useState(() => new Animated.Value(0));
  const previousExerciseIdsRef = useRef<string[]>([]);
  const previousSetCountsRef = useRef<Record<string, number>>({});
  const isEmptySession = displayTimeline.length === 0;
  const isFinishActionDisabled = isWorking || Boolean(draggingExerciseId);
  const hasLoggedSets = displayTimeline.some(item => item.setCount > 0);
  const [draggingRowHeight, setDraggingRowHeight] = useState(0);
  const draggingRowSize = draggingRowHeight > 0 ? draggingRowHeight + TIMELINE_ROW_GAP : 0;

  const [previousTimeline, setPreviousTimeline] = useState(timeline);
  if (previousTimeline !== timeline) {
    setPreviousTimeline(timeline);
    const signature = timeline.map(item => item.sessionExerciseId).join('|');
    if (pendingOrder === signature) { setPendingOrder(null); setDisplayTimeline(timeline); }
    else if (!pendingOrder && !draggingExerciseId) setDisplayTimeline(timeline);
  }

  useEffect(() => {
    const previousExerciseIds = previousExerciseIdsRef.current;
    const nextExerciseIds = timeline.map(item => item.sessionExerciseId as string);
    const nextInsertedExerciseIds = nextExerciseIds.filter(id => !previousExerciseIds.includes(id));
    previousExerciseIdsRef.current = nextExerciseIds;

    if (nextInsertedExerciseIds.length > 0) {
      runReedLayoutAnimation();
      setInsertedExerciseIds(current => ({
        ...current,
        ...Object.fromEntries(nextInsertedExerciseIds.map(id => [id, true])),
      }));
    }

    let hasLayoutChange = false;
    const nextHighlightedSetIds: string[] = [];

    setExpandedExercises(current => {
      const next: Record<string, boolean> = {};
      const nextSetCounts: Record<string, number> = {};

      for (const item of displayTimeline) {
        const key = item.sessionExerciseId as string;
        nextSetCounts[key] = item.setCount;

        if (key in current) {
          const previousCount = previousSetCountsRef.current[key] ?? 0;
          const hasNewSet = item.setCount > previousCount;
          if (hasNewSet) {
            hasLayoutChange = true;
            const newestSet = item.sets[item.sets.length - 1];
            if (newestSet) {
              nextHighlightedSetIds.push(newestSet.setLogId as string);
            }
          }
          next[key] = hasNewSet
            ? true
            : current[key] || item.state === 'capture' || item.state === 'rest';
          continue;
        }

        next[key] = item.setCount > 0 || item.state === 'capture' || item.state === 'rest';
      }

      previousSetCountsRef.current = nextSetCounts;

      return next;
    });

    if (hasLayoutChange) {
      runReedLayoutAnimation();
    }

    if (nextHighlightedSetIds.length > 0) {
      setHighlightedSetIds(current => ({
        ...current,
        ...Object.fromEntries(nextHighlightedSetIds.map(id => [id, true])),
      }));
    }
  }, [displayTimeline, timeline]);

  useEffect(() => {
    if (Object.keys(highlightedSetIds).length === 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setHighlightedSetIds({});
    }, reedMotion.durations.standard + 40);

    return () => clearTimeout(timeout);
  }, [highlightedSetIds]);

  if (confirmExerciseDeleteId && !displayTimeline.some(item => item.sessionExerciseId === confirmExerciseDeleteId)) setConfirmExerciseDeleteId(null);

  function handleRowLayout(sessionExerciseId: Id<'liveSessionExercises'>, y: number, height: number) {
    rowLayoutsRef.current[sessionExerciseId as string] = { height, y };
  }

  function handleDragStart(sessionExerciseId: Id<'liveSessionExercises'>) {
    setDraggingRowHeight(rowLayoutsRef.current[sessionExerciseId]?.height ?? 0);
    const nextIndex = displayTimeline.findIndex(item => item.sessionExerciseId === sessionExerciseId);
    if (nextIndex < 0) {
      return;
    }

    setConfirmExerciseDeleteId(null);
    setDraggingExerciseId(sessionExerciseId);
    setDragOriginIndex(nextIndex);
    setDragTargetIndex(nextIndex);
    dragTranslationY.setValue(0);
  }

  function handleDragMove(deltaY: number) {
    if (!draggingExerciseId || dragOriginIndex === null) {
      return;
    }

    dragTranslationY.setValue(deltaY);

    const activeLayout = rowLayoutsRef.current[draggingExerciseId as string];
    if (!activeLayout) {
      return;
    }

    const activeCenterY = activeLayout.y + deltaY + activeLayout.height / 2;
    let nextTargetIndex = dragOriginIndex;

    for (let index = 0; index < displayTimeline.length; index += 1) {
      const candidate = displayTimeline[index];
      const layout = rowLayoutsRef.current[candidate.sessionExerciseId as string];

      if (!layout || candidate.sessionExerciseId === draggingExerciseId) {
        continue;
      }

      if (activeCenterY >= layout.y + layout.height / 2) {
        nextTargetIndex = index;
      }
    }

    if (nextTargetIndex !== dragTargetIndex) {
      setDragTargetIndex(nextTargetIndex);
    }
  }

  async function handleDragEnd() {
    if (!draggingExerciseId || dragOriginIndex === null || dragTargetIndex === null) {
      setDraggingExerciseId(null);
      setDragOriginIndex(null);
      setDragTargetIndex(null);
      dragTranslationY.setValue(0);
      return;
    }

    const didMove = dragOriginIndex !== dragTargetIndex;
    const reorderedTimeline = didMove
      ? moveTimelineItem(displayTimeline, dragOriginIndex, dragTargetIndex)
      : displayTimeline;

    setDraggingExerciseId(null);
    setDragOriginIndex(null);
    setDragTargetIndex(null);
    dragTranslationY.setValue(0);

    if (!didMove) {
      return;
    }

    runReedLayoutAnimation();
    setDisplayTimeline(reorderedTimeline);
    const orderedSessionExerciseIds = reorderedTimeline.map(item => item.sessionExerciseId);
    setPendingOrder(orderedSessionExerciseIds.join('|'));

    const didPersist = await exercises?.onReorderTimeline(orderedSessionExerciseIds);

    if (!didPersist) {
      setPendingOrder(null);
      runReedLayoutAnimation();
      setDisplayTimeline(timeline);
    }
  }

  return (
    <View style={styles.timelinePage}>
      <ScrollView
        contentContainerStyle={[
          styles.timelineRailContentDocked,
          contentTopInset !== undefined ? { paddingTop: contentTopInset } : undefined,
        ]}
        scrollEnabled={!draggingExerciseId}
        showsVerticalScrollIndicator={false}
        style={styles.timelineRailScroll}
      >
        {displayTimeline.length === 0 ? (
          <View style={styles.timelineEmpty}>
            <ReedText tone="muted">{editor ? 'Add your first exercise to begin.' : 'Nothing was logged in this session.'}</ReedText>
          </View>
        ) : (
          displayTimeline.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === displayTimeline.length - 1;
            const exerciseKey = item.sessionExerciseId as string;
            const isExpanded =
              expandedExercises[exerciseKey] ??
              (item.setCount > 0 || item.state === 'capture' || item.state === 'rest');
            const isRestingForRow =
              item.state === 'rest' &&
              activeRestCard?.sessionExerciseId === item.sessionExerciseId;
            const hasTimelineStem = !isLast || isExpanded;
            const isDraggingRow = draggingExerciseId === item.sessionExerciseId;
            // A finished session has no live state: an exercise with sets in it simply reads as done.
            const markerState = isReadOnly && item.setCount > 0 ? 'logged' : item.state;
            const dragOffsetY = getTimelineRowShift({
              draggedRowSize: draggingRowSize,
              draggingExerciseId,
              dragOriginIndex,
              dragTargetIndex,
              dragTranslationY,
              index,
              sessionExerciseId: item.sessionExerciseId,
            });

            return (
              <View
                key={item.sessionExerciseId}
                onLayout={event => {
                  const { height, y } = event.nativeEvent.layout;
                  handleRowLayout(item.sessionExerciseId, y, height);
                }}
              >
                <AnimatedTimelineRow
                  animateIn={Boolean(insertedExerciseIds[exerciseKey])}
                  dragOffsetY={dragOffsetY}
                  isDragging={isDraggingRow}
                >
                  <View style={styles.timelineLineItem}>
                    <View style={styles.timelineRailColumn}>
                      {!isFirst ? (
                        <View
                          style={[
                            styles.timelineRailSegmentTop,
                            {
                              backgroundColor: theme.colors.line,
                            },
                          ]}
                        />
                      ) : null}
                      <View
                        style={[
                          styles.timelineNodeMarkerFixed,
                          {
                            backgroundColor:
                              markerState === 'capture'
                                ? theme.colors.accent
                                : markerState === 'rest'
                                  ? theme.colors.dangerInk
                                  : theme.colors.surface,
                            borderColor:
                              markerState === 'idle'
                                ? theme.colors.line
                                : markerState === 'capture'
                                  ? theme.colors.accent
                                  : markerState === 'rest'
                                    ? theme.colors.dangerInk
                                    : theme.colors.ink,
                          },
                        ]}
                      >
                        <Ionicons
                          color={
                            markerState === 'idle'
                              ? String(theme.colors.inkMuted)
                              : markerState === 'capture'
                                ? String(theme.colors.accentText)
                                : markerState === 'logged' || markerState === 'live_tracking'
                                  ? String(theme.colors.ink)
                                  : String(theme.colors.surface)
                          }
                          name={
                            markerState === 'rest'
                              ? 'timer-outline'
                              : markerState === 'live_tracking'
                                ? 'pulse'
                                : markerState === 'logged'
                                  ? 'checkmark'
                                  : 'ellipse'
                          }
                          size={12}
                        />
                      </View>
                      {hasTimelineStem ? (
                        <View
                          style={[
                            styles.timelineRailSegmentBottom,
                            {
                              backgroundColor: theme.colors.line,
                            },
                          ]}
                        />
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.timelineLineCopy,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.line,
                        },
                      ]}
                    >
                      <Pressable
                        accessibilityLabel={`Open ${item.exerciseName}`}
                        disabled={isWorking || isReadOnly}
                        onPress={() => {
                          setConfirmExerciseDeleteId(null);
                          exercises?.onOpenExercise(item.sessionExerciseId);
                        }}
                        style={({ pressed }) => [getTapScaleStyle(pressed)]}
                      >
                        <View style={styles.timelineLineHeader}>
                          <View style={styles.timelineLineTitleStack}>
                            <ReedText numberOfLines={2} style={styles.timelineLineTitle} variant="headline">
                              {item.exerciseName}
                            </ReedText>
                            {getTimelineSetupLabel(item) ? (
                              <ReedText numberOfLines={1} tone="muted" variant="caption">
                                {getTimelineSetupLabel(item)}
                              </ReedText>
                            ) : null}
                          </View>
                          <View style={styles.timelineRowActions}>
                            <Pressable
                              accessibilityLabel={isExpanded ? `Collapse ${item.exerciseName}` : `Expand ${item.exerciseName}`}
                              disabled={isWorking}
                              onPress={event => {
                                event.stopPropagation();
                                runReedLayoutAnimation();
                                setExpandedExercises(current => ({
                                  ...current,
                                  [exerciseKey]: !isExpanded,
                                }));
                              }}
                              hitSlop={4}
                              style={({ pressed }) => [styles.timelineActionButton, getTapScaleStyle(pressed)]}
                            >
                              <Ionicons
                                color={String(theme.colors.inkMuted)}
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={18}
                              />
                            </Pressable>
                            {isReadOnly ? null : <TimelineDragHandle
                              disabled={isWorking || Boolean(draggingExerciseId && draggingExerciseId !== item.sessionExerciseId)}
                              dimWhenDisabled={Boolean(draggingExerciseId && draggingExerciseId !== item.sessionExerciseId)}
                              isDragging={isDraggingRow}
                              onDragEnd={() => {
                                void handleDragEnd();
                              }}
                              onDragMove={handleDragMove}
                              onDragStart={() => handleDragStart(item.sessionExerciseId)}
                            />}
                            {isReadOnly ? null : <Pressable
                              accessibilityLabel={
                                confirmExerciseDeleteId === item.sessionExerciseId
                                  ? `Confirm remove ${item.exerciseName}`
                                  : `Remove ${item.exerciseName}`
                              }
                              disabled={isWorking}
                              onPress={event => {
                                event.stopPropagation();

                                if (confirmExerciseDeleteId === item.sessionExerciseId) {
                                  setConfirmExerciseDeleteId(null);
                                  exercises?.onRemoveExercise(item.sessionExerciseId);
                                  return;
                                }

                                setConfirmExerciseDeleteId(item.sessionExerciseId);
                              }}
                              hitSlop={4}
                              style={({ pressed }) => [styles.timelineActionButton, getTapScaleStyle(pressed)]}
                            >
                              <Ionicons
                                color={String(
                                  confirmExerciseDeleteId === item.sessionExerciseId
                                    ? theme.colors.dangerInk
                                    : theme.colors.inkMuted,
                                )}
                                name={confirmExerciseDeleteId === item.sessionExerciseId ? 'checkmark' : 'trash-outline'}
                                size={18}
                              />
                            </Pressable>}
                          </View>
                        </View>
                      </Pressable>
                      <View style={styles.timelineBadgeRow}>
                        <View style={styles.timelineSetCountInline}>
                          <Ionicons color={String(theme.colors.inkMuted)} name="barbell-outline" size={14} />
                          <ReedText tone="muted" variant="body">
                            {item.setCount} {item.setCount === 1 ? 'set' : 'sets'}
                          </ReedText>
                        </View>

                        {isRestingForRow && !isExpanded ? (
                          <View style={styles.timelineSetCountInline}>
                            <Ionicons color={String(theme.colors.dangerInk)} name="time-outline" size={14} />
                            {activeRestCard ? <RestCountdownText card={activeRestCard} tone="danger" /> : null}
                          </View>
                        ) : null}
                      </View>

                      <AnimatedSetList expanded={isExpanded}>
                        <View style={styles.timelineSetList}>
                          {item.sets.length === 0 ? (
                            <ReedText tone="muted" variant="body">
                              No sets logged yet.
                            </ReedText>
                          ) : (
                            item.sets.map(setEntry => {
                              const hasActiveRestForSet =
                                isRestingForRow &&
                                activeRestCard?.nextSetNumber === setEntry.setNumber + 1;
                              const restLabel = hasActiveRestForSet && activeRestCard
                                ? <RestCountdownText card={activeRestCard} tone="danger" />
                                : setEntry.restSeconds !== null ? `Rest ${formatClock(setEntry.restSeconds)}` : null;

                              return (
                                <TimelineSetRow
                                  canDelete={!isReadOnly}
                                  canOpen={!isReadOnly}
                                  deleteLocked={isWorking}
                                  highlightOnChange={Boolean(highlightedSetIds[setEntry.setLogId as string])}
                                  key={`${item.sessionExerciseId}-${setEntry.setLogId}`}
                                  onDelete={() => exercises?.onDeleteSet(setEntry.setLogId)}
                                  onOpen={() => exercises?.onOpenSet(item.sessionExerciseId, setEntry)}
                                  restLabel={restLabel}
                                  setEntry={setEntry}
                                  showRestAsActive={hasActiveRestForSet}
                                />
                              );
                            })
                          )}
                        </View>
                      </AnimatedSetList>
                    </View>
                  </View>
                </AnimatedTimelineRow>
              </View>
            );
          })
        )}
      </ScrollView>

      {!isReadOnly || onOpenNotes ? (
        <View style={[styles.dock, { backgroundColor: theme.colors.canvas, paddingBottom: insets.bottom + theme.spacing.xs }]}>
          <View style={styles.dockRow}>
            {onOpenNotes ? (
              <Pressable
                accessibilityLabel={hasNotes ? 'Edit session notes' : 'Add session notes'}
                accessibilityRole="button"
                disabled={isWorking || Boolean(draggingExerciseId)}
                onPress={() => {
                  editor?.onClearFinishSessionConfirm();
                  onOpenNotes();
                }}
                style={({ pressed }) => [
                  isReadOnly ? styles.dockWide : styles.dockIcon,
                  { backgroundColor: theme.colors.surfaceRaised },
                  getTapScaleStyle(pressed, Boolean(draggingExerciseId)),
                ]}
              >
                <Ionicons
                  color={String(hasNotes ? theme.colors.accentInk : theme.colors.inkSecondary)}
                  name={hasNotes ? 'document-text' : 'document-text-outline'}
                  size={20}
                />
                {isReadOnly ? <ReedText variant="bodyStrong">{hasNotes ? 'Session notes' : 'Add notes'}</ReedText> : null}
              </Pressable>
            ) : null}

            {isReadOnly ? null : (
              <>
                {/* The primary action is the next sensible step: add an exercise until something is logged, then finish. */}
                <View style={styles.dockFill}>
                  <ReedButton
                    disabled={isFinishActionDisabled}
                    label={isEmptySession ? 'Close session' : 'Finish workout'}
                    leading={<Ionicons color={String(hasLoggedSets ? theme.colors.accentText : theme.colors.ink)} name="flag-outline" size={16} />}
                    onPress={editor?.onToggleFinishSessionConfirm}
                    variant={hasLoggedSets ? 'primary' : 'secondary'}
                  />
                </View>
                <View style={styles.dockFill}>
                  <ReedButton
                    disabled={isWorking || Boolean(draggingExerciseId)}
                    label="Add exercise"
                    leading={<Ionicons color={String(hasLoggedSets ? theme.colors.ink : theme.colors.accentText)} name="add" size={18} />}
                    onPress={() => {
                      editor?.onClearFinishSessionConfirm();
                      editor?.onAddExercise();
                    }}
                    variant={hasLoggedSets ? 'secondary' : 'primary'}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      ) : null}

      {!isReadOnly ? (
        <ReedSheet onDismiss={editor?.onClearFinishSessionConfirm} open={isConfirmingFinishSession}>
          <View style={styles.finishSheet}>
            <View style={styles.finishCopy}>
              <ReedText variant="title">{isEmptySession ? 'Close session?' : 'Finish workout?'}</ReedText>
              {isEmptySession ? (
                <ReedText tone="muted">No exercises logged. Nothing will be saved.</ReedText>
              ) : (
                <FinishSummary exerciseCount={displayTimeline.length} fixedElapsedLabel={elapsedLabel} startedAt={sessionStartedAt} />
              )}
            </View>
            <ReedButton disabled={isWorking} label={isEmptySession ? 'Close session' : 'Finish workout'} onPress={editor?.onFinishSession} />
            <ReedButton label="Keep going" onPress={editor?.onClearFinishSessionConfirm} variant="quiet" />
          </View>
        </ReedSheet>
      ) : null}

      {errorMessage ? (
        <ReedText style={styles.inlineError} tone="danger">
          {errorMessage}
        </ReedText>
      ) : null}
    </View>
  );
}

function getFinishSummaryLabel(exerciseCount: number, elapsedLabel: string | null) {
  const exercisesPart = `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`;
  const minutesPart = formatElapsedAsMinutes(elapsedLabel);
  return `${exercisesPart} • ${minutesPart}`;
}

function formatElapsedAsMinutes(elapsedLabel: string | null) {
  if (!elapsedLabel) {
    return '0 min';
  }

  const hoursMatch = elapsedLabel.match(/(\d+)h/);
  const minutesMatch = elapsedLabel.match(/(\d+)m/);
  const secondsMatch = elapsedLabel.match(/(\d+)s/);

  const hours = hoursMatch ? Number.parseInt(hoursMatch[1], 10) : 0;
  const minutes = minutesMatch ? Number.parseInt(minutesMatch[1], 10) : 0;
  const seconds = secondsMatch ? Number.parseInt(secondsMatch[1], 10) : 0;
  const totalMinutes = hours * 60 + minutes + (seconds >= 30 ? 1 : 0);

  return `${totalMinutes} min`;
}

function AnimatedSetList({
  children,
  expanded,
}: {
  children: React.ReactNode;
  expanded: boolean;
}) {
  const [progress] = useState(() => new Animated.Value(expanded ? 1 : 0));
  const [shouldRender, setShouldRender] = useState(expanded);
  const [previousExpanded, setPreviousExpanded] = useState(expanded);
  if (previousExpanded !== expanded) { setPreviousExpanded(expanded); if (expanded) setShouldRender(true); }

  useEffect(() => {
    if (expanded) {

      requestAnimationFrame(() => {
        createTiming(progress, 1, reedMotion.durations.standard, reedEasing.easeOut).start();
      });
      return;
    }

    createTiming(progress, 0, reedMotion.durations.standard, reedEasing.easeInOut).start(({ finished }) => {
      if (finished) {
        setShouldRender(false);
      }
    });
  }, [expanded, progress]);

  const animatedOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const animatedTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [reedMotion.distances.expandContentY, 0],
  });

  if (!shouldRender) {
    return null;
  }

  return (
    <Animated.View
      style={{
        opacity: animatedOpacity,
        transform: [{ translateY: animatedTranslateY }],
      }}
    >
      <View>{children}</View>
    </Animated.View>
  );
}

function AnimatedTimelineRow({
  animateIn,
  children,
  dragOffsetY,
  isDragging,
}: {
  animateIn: boolean;
  children: React.ReactNode;
  dragOffsetY: number | Animated.Value;
  isDragging: boolean;
}) {
  const [insertProgress] = useState(() => new Animated.Value(animateIn ? 0 : 1));

  useEffect(() => {
    if (!animateIn) {
      insertProgress.setValue(1);
      return;
    }

    createTiming(insertProgress, 1, reedMotion.durations.standard, reedEasing.easeOut).start();
  }, [animateIn, insertProgress]);
  const opacity = insertProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const translateY = insertProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [reedMotion.distances.listInsertY, 0],
  });

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }, { translateY: dragOffsetY }],
        zIndex: isDragging ? 30 : 1,
      }}
    >
      {children}
    </Animated.View>
  );
}

function TimelineDragHandle({
  disabled,
  dimWhenDisabled,
  isDragging,
  onDragEnd,
  onDragMove,
  onDragStart,
}: {
  disabled: boolean;
  dimWhenDisabled: boolean;
  isDragging: boolean;
  onDragEnd: () => void;
  onDragMove: (deltaY: number) => void;
  onDragStart: () => void;
}) {
  const { theme } = useReedTheme();
  const activationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(false);
  const startPageYRef = useRef(0);

  const clearActivationTimeout = useCallback(() => {
    if (activationTimeoutRef.current) {
      clearTimeout(activationTimeoutRef.current);
      activationTimeoutRef.current = null;
    }
  }, []);

  const panResponder = useMemo(
    () =>
      // PanResponder registers these callbacks; ref reads happen only on pointer events.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: () => false,
        onPanResponderGrant: (_, gestureState) => {
          if (disabled) {
            return;
          }

          startPageYRef.current = gestureState.y0;
          clearActivationTimeout();
          activationTimeoutRef.current = setTimeout(() => {
            isActiveRef.current = true;
            onDragStart();
          }, reedMotion.durations.standard);
        },
        onPanResponderMove: (_, gestureState) => {
          if (disabled) {
            return;
          }

          if (!isActiveRef.current) {
            if (Math.abs(gestureState.dy) > 8 || Math.abs(gestureState.dx) > 8) {
              clearActivationTimeout();
            }
            return;
          }

          onDragMove(gestureState.moveY - startPageYRef.current);
        },
        onPanResponderRelease: () => {
          clearActivationTimeout();
          if (isActiveRef.current) {
            onDragEnd();
          }
          isActiveRef.current = false;
        },
        onPanResponderTerminate: () => {
          clearActivationTimeout();
          if (isActiveRef.current) {
            onDragEnd();
          }
          isActiveRef.current = false;
        },
        onStartShouldSetPanResponder: () => !disabled,
        onStartShouldSetPanResponderCapture: () => !disabled,
      }),
    [clearActivationTimeout, disabled, onDragEnd, onDragMove, onDragStart],
  );

  useEffect(
    () => () => {
      clearActivationTimeout();
    },
    [clearActivationTimeout],
  );

  return (
    <View
      {...panResponder.panHandlers}
      accessibilityLabel="Hold and drag to reorder exercise"
      style={[
        styles.timelineActionButton,
        {
          opacity: disabled && dimWhenDisabled ? reedMotion.opacity.disabled : 1,
          transform: [{ scale: isDragging ? reedMotion.scale.activeTab : 1 }],
        },
      ]}
    >
      <Ionicons
        color={String(isDragging ? theme.colors.accent : theme.colors.inkMuted)}
        name="reorder-three-outline"
        size={18}
      />
    </View>
  );
}

function getTimelineRowShift({
  draggedRowSize,
  draggingExerciseId,
  dragOriginIndex,
  dragTargetIndex,
  dragTranslationY,
  index,
  sessionExerciseId,
}: {
  draggedRowSize: number;
  draggingExerciseId: Id<'liveSessionExercises'> | null;
  dragOriginIndex: number | null;
  dragTargetIndex: number | null;
  dragTranslationY: Animated.Value;
  index: number;
  sessionExerciseId: Id<'liveSessionExercises'>;
}) {
  if (!draggingExerciseId || dragOriginIndex === null || dragTargetIndex === null) {
    return 0;
  }

  if (sessionExerciseId === draggingExerciseId) {
    return dragTranslationY;
  }

  if (dragOriginIndex < dragTargetIndex && index > dragOriginIndex && index <= dragTargetIndex) {
    return -draggedRowSize;
  }

  if (dragOriginIndex > dragTargetIndex && index >= dragTargetIndex && index < dragOriginIndex) {
    return draggedRowSize;
  }

  return 0;
}

function moveTimelineItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function TimelineSetRow({
  canDelete,
  deleteLocked,
  highlightOnChange,
  canOpen,
  onDelete,
  onOpen,
  restLabel,
  setEntry,
  showRestAsActive,
}: {
  canDelete: boolean;
  canOpen: boolean;
  deleteLocked: boolean;
  highlightOnChange: boolean;
  onDelete: () => void;
  onOpen: () => void;
  restLabel: ReactNode;
  setEntry: TimelineSet;
  showRestAsActive: boolean;
}) {
  const { theme } = useReedTheme();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [tickProgress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!highlightOnChange) {
      tickProgress.setValue(0);
      return;
    }

    tickProgress.setValue(0);
    Animated.sequence([
      createTiming(tickProgress, 1, reedMotion.durations.micro, reedEasing.easeOut, shouldUseNativeDriver),
      createTiming(tickProgress, 0, reedMotion.durations.micro, reedEasing.easeInOut, shouldUseNativeDriver),
    ]).start();
  }, [highlightOnChange, tickProgress]);

  const translateY = tickProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, reedMotion.distances.setTickY],
  });
  const flashOpacity = tickProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, reedMotion.opacity.flash],
  });

  return (
    <Animated.View style={[styles.timelineSetBlock, { transform: [{ translateY }] }]}>
      <Animated.View
        style={[
          styles.timelineSetFlash,
          {
            backgroundColor: theme.colors.accent,
            opacity: flashOpacity,
          },
        ]}
      />
      <View style={styles.timelineSetRowContainer}>
        <Pressable
          disabled={!canOpen}
          onPress={() => {
            setIsConfirmingDelete(false);
            onOpen();
          }}
          style={({ pressed }) => [styles.timelineSetPressable, getTapScaleStyle(pressed)]}
        >
          <View
            style={[
              styles.timelineSetDot,
              {
                backgroundColor: getTimelineSetDotColor(setEntry, theme),
              },
            ]}
          />
          <ReedText numberOfLines={1} variant="body">
            Set {setEntry.setNumber} · {setEntry.summary}
          </ReedText>
        </Pressable>
        {canDelete ? (
          <Pressable
            accessibilityLabel={isConfirmingDelete ? 'Confirm delete set' : 'Delete set'}
            disabled={deleteLocked}
            hitSlop={4}
            onPress={() => {
              if (isConfirmingDelete) {
                setIsConfirmingDelete(false);
                onDelete();
                return;
              }
              setIsConfirmingDelete(true);
            }}
            style={({ pressed }) => [styles.timelineSetDeleteButton, getTapScaleStyle(pressed)]}
          >
            <Ionicons
              color={String(isConfirmingDelete ? theme.colors.dangerInk : theme.colors.inkMuted)}
              name={isConfirmingDelete ? 'checkmark' : 'trash-outline'}
              size={18}
            />
          </Pressable>
        ) : null}
      </View>
      {restLabel ? (
        <View style={styles.timelineRestRow}>
          <ReedText tone={showRestAsActive ? 'danger' : 'muted'} variant="caption">
            {restLabel}
          </ReedText>
        </View>
      ) : null}
    </Animated.View>
  );
}

function RestCountdownText({ card, tone }: { card: RestCard; tone: 'danger' | 'muted' }) {
  const remaining = useRestCountdown(card)?.remainingSeconds ?? 0;
  return <ReedText tone={tone} variant="caption">Rest {formatClock(remaining)}</ReedText>;
}

function FinishSummary({ exerciseCount, fixedElapsedLabel, startedAt }: { exerciseCount: number; fixedElapsedLabel: string | null; startedAt?: number }) {
  const liveElapsedLabel = useCompactElapsedLabel(startedAt);
  return (
    <ReedText tone="muted">
      {getFinishSummaryLabel(exerciseCount, liveElapsedLabel ?? fixedElapsedLabel)}
    </ReedText>
  );
}

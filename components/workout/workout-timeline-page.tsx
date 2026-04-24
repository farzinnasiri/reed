import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, View } from 'react-native';
import type { Id } from '@/convex/_generated/dataModel';
import { GlassSurface } from '@/components/ui/glass-surface';
import { canUseGlassBlur, getGlassControlTokens, getGlassPaneTokens, getGlassScrimTokens } from '@/components/ui/glass-material';
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
import { styles } from './workout-surface.styles';
import type { TimelineRow, TimelineSet } from './workout-surface.types';
import { formatClock } from './workout-surface.utils';

type TimelinePageProps = {
  activeRestAfterSetNumber: number | null;
  activeRestExerciseId: Id<'liveSessionExercises'> | null;
  activeRestSeconds: number | null;
  elapsedLabel: string | null;
  errorMessage: string | null;
  isConfirmingFinishSession: boolean;
  isWorking: boolean;
  onAddExercise: () => void;
  onClearFinishSessionConfirm: () => void;
  onDeleteSet: (setLogId: Id<'liveSetLogs'>) => void;
  onFinishSession: () => void;
  onOpenExercise: (sessionExerciseId: Id<'liveSessionExercises'>) => void;
  onOpenSet: (sessionExerciseId: Id<'liveSessionExercises'>, setEntry: TimelineSet) => void;
  onReorderTimeline: (orderedSessionExerciseIds: Id<'liveSessionExercises'>[]) => Promise<boolean>;
  onRemoveExercise: (sessionExerciseId: Id<'liveSessionExercises'>) => void;
  onToggleFinishSessionConfirm: () => void;
  timeline: TimelineRow[];
};

const TIMELINE_ROW_GAP = 10;

export function TimelinePage({
  activeRestAfterSetNumber,
  activeRestExerciseId,
  activeRestSeconds,
  elapsedLabel,
  errorMessage,
  isConfirmingFinishSession,
  isWorking,
  onAddExercise,
  onClearFinishSessionConfirm,
  onDeleteSet,
  onFinishSession,
  onOpenExercise,
  onOpenSet,
  onReorderTimeline,
  onRemoveExercise,
  onToggleFinishSessionConfirm,
  timeline,
}: TimelinePageProps) {
  const { theme } = useReedTheme();
  const pane = getGlassPaneTokens(theme);
  const glassControls = getGlassControlTokens(theme);
  const scrim = getGlassScrimTokens(theme);
  const canUseBlur = canUseGlassBlur();
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [confirmExerciseDeleteId, setConfirmExerciseDeleteId] = useState<Id<'liveSessionExercises'> | null>(null);
  const [displayTimeline, setDisplayTimeline] = useState(timeline);
  const [draggingExerciseId, setDraggingExerciseId] = useState<Id<'liveSessionExercises'> | null>(null);
  const [dragOriginIndex, setDragOriginIndex] = useState<number | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);
  const [highlightedSetIds, setHighlightedSetIds] = useState<Record<string, boolean>>({});
  const [insertedExerciseIds, setInsertedExerciseIds] = useState<Record<string, boolean>>({});
  const pendingOrderRef = useRef<string | null>(null);
  const rowLayoutsRef = useRef<Record<string, { height: number; y: number }>>({});
  const dragTranslationY = useRef(new Animated.Value(0)).current;
  const previousExerciseIdsRef = useRef<string[]>([]);
  const previousSetCountsRef = useRef<Record<string, number>>({});
  const draggingRowHeight = useMemo(() => {
    if (!draggingExerciseId) {
      return 0;
    }

    return rowLayoutsRef.current[draggingExerciseId as string]?.height ?? 0;
  }, [draggingExerciseId]);
  const draggingRowSize = draggingRowHeight > 0 ? draggingRowHeight + TIMELINE_ROW_GAP : 0;

  useEffect(() => {
    const timelineSignature = timeline.map(item => item.sessionExerciseId).join('|');

    if (pendingOrderRef.current) {
      if (timelineSignature === pendingOrderRef.current) {
        pendingOrderRef.current = null;
        setDisplayTimeline(timeline);
      }
      return;
    }

    if (!draggingExerciseId) {
      setDisplayTimeline(timeline);
    }
  }, [draggingExerciseId, timeline]);

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

  useEffect(() => {
    if (!confirmExerciseDeleteId) {
      return;
    }

    const stillExists = displayTimeline.some(item => item.sessionExerciseId === confirmExerciseDeleteId);

    if (!stillExists) {
      setConfirmExerciseDeleteId(null);
    }
  }, [confirmExerciseDeleteId, displayTimeline]);

  function handleRowLayout(sessionExerciseId: Id<'liveSessionExercises'>, y: number, height: number) {
    rowLayoutsRef.current[sessionExerciseId as string] = { height, y };
  }

  function handleDragStart(sessionExerciseId: Id<'liveSessionExercises'>) {
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
    pendingOrderRef.current = orderedSessionExerciseIds.join('|');

    const didPersist = await onReorderTimeline(orderedSessionExerciseIds);

    if (!didPersist) {
      pendingOrderRef.current = null;
      runReedLayoutAnimation();
      setDisplayTimeline(timeline);
    }
  }

  return (
    <View style={styles.timelinePage}>
      <View style={styles.timelineHeader}>
        <ReedText variant="section">Timeline</ReedText>
        <ReedText tone="muted" variant="body">
          {displayTimeline.length} {displayTimeline.length === 1 ? 'exercise' : 'exercises'}
        </ReedText>
      </View>

      <ScrollView
        contentContainerStyle={styles.timelineRailContentDocked}
        scrollEnabled={!draggingExerciseId}
        showsVerticalScrollIndicator={false}
        style={styles.timelineRailScroll}
      >
        {displayTimeline.length === 0 ? (
          <View style={styles.timelineEmpty}>
            <ReedText tone="muted">Timeline is empty.</ReedText>
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
              activeRestExerciseId === item.sessionExerciseId &&
              typeof activeRestSeconds === 'number';
            const hasTimelineStem = !isLast || isExpanded;
            const isDraggingRow = draggingExerciseId === item.sessionExerciseId;
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
                  <View
                    style={[
                      styles.timelineLineItem,
                      {
                        opacity: isWorking ? 0.88 : 1,
                      },
                    ]}
                  >
                <View style={styles.timelineRailColumn}>
                  {!isFirst ? (
                    <View
                      style={[
                        styles.timelineRailSegmentTop,
                        {
                          backgroundColor: theme.colors.controlBorder,
                        },
                      ]}
                    />
                  ) : null}
                  <View
                    style={[
                      styles.timelineNodeMarkerFixed,
                      {
                        backgroundColor:
                          item.state === 'capture'
                            ? theme.colors.accentPrimary
                            : item.state === 'rest'
                              ? theme.colors.dangerText
                            : theme.colors.canvasSecondary,
                        borderColor:
                          item.state === 'idle'
                            ? theme.colors.controlBorder
                            : item.state === 'capture'
                              ? theme.colors.accentPrimary
                              : item.state === 'rest'
                                ? theme.colors.dangerText
                                : theme.colors.textPrimary,
                      },
                    ]}
                  >
                    <Ionicons
                      color={
                        item.state === 'idle'
                          ? String(theme.colors.textMuted)
                          : item.state === 'capture'
                            ? '#ffffff'
                            : String(theme.colors.canvasSecondary)
                      }
                      name={
                        item.state === 'rest'
                          ? 'timer-outline'
                          : item.state === 'live_tracking'
                            ? 'pulse'
                          : item.state === 'logged'
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
                          backgroundColor: theme.colors.controlBorder,
                        },
                      ]}
                    />
                  ) : null}
                </View>

                <View
                  style={[
                    styles.timelineLineCopy,
                    {
                      backgroundColor: glassControls.shellBackgroundColor,
                      borderColor: glassControls.shellBorderColor,
                    },
                  ]}
                >
                  <Pressable
                    accessibilityLabel={`Open ${item.exerciseName}`}
                    disabled={isWorking}
                    onPress={() => {
                      setConfirmExerciseDeleteId(null);
                      onOpenExercise(item.sessionExerciseId);
                    }}
                    style={({ pressed }) => [getTapScaleStyle(pressed, isWorking)]}
                  >
                    <View style={styles.timelineLineHeader}>
                      <ReedText numberOfLines={1} style={styles.timelineLineTitle} variant="section">
                        {item.exerciseName}
                      </ReedText>
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
                          style={({ pressed }) => [styles.timelineActionButton, getTapScaleStyle(pressed, isWorking)]}
                        >
                          <Ionicons
                            color={String(theme.colors.textMuted)}
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                          />
                        </Pressable>
                        <TimelineDragHandle
                          disabled={isWorking || Boolean(draggingExerciseId && draggingExerciseId !== item.sessionExerciseId)}
                          isDragging={isDraggingRow}
                          onDragEnd={() => {
                            void handleDragEnd();
                          }}
                          onDragMove={handleDragMove}
                          onDragStart={() => handleDragStart(item.sessionExerciseId)}
                        />
                        <Pressable
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
                              onRemoveExercise(item.sessionExerciseId);
                              return;
                            }

                            setConfirmExerciseDeleteId(item.sessionExerciseId);
                          }}
                          style={({ pressed }) => [styles.timelineActionButton, getTapScaleStyle(pressed, isWorking)]}
                        >
                          <Ionicons
                            color={String(
                              confirmExerciseDeleteId === item.sessionExerciseId
                                ? theme.colors.dangerText
                                : theme.colors.textMuted,
                            )}
                            name={confirmExerciseDeleteId === item.sessionExerciseId ? 'checkmark' : 'trash-outline'}
                            size={18}
                          />
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                  <View style={styles.timelineBadgeRow}>
                    <View style={styles.timelineSetCountInline}>
                      <Ionicons color={String(theme.colors.textMuted)} name="barbell-outline" size={14} />
                      <ReedText tone="muted" variant="body">
                        {item.setCount} {item.setCount === 1 ? 'set' : 'sets'}
                      </ReedText>
                    </View>

                    {isRestingForRow ? (
                      <View style={styles.timelineSetCountInline}>
                        <Ionicons color={String(theme.colors.dangerText)} name="time-outline" size={14} />
                        <ReedText tone="danger" variant="body">
                          Rest {formatClock(activeRestSeconds)}
                        </ReedText>
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
                            activeRestAfterSetNumber === setEntry.setNumber &&
                            typeof activeRestSeconds === 'number';
                          const displayedRestSeconds = hasActiveRestForSet ? activeRestSeconds : setEntry.restSeconds;

                          return (
                            <TimelineSetRow
                              canDelete={!isWorking}
                              canOpen
                              highlightOnChange={Boolean(highlightedSetIds[setEntry.setLogId as string])}
                              key={`${item.sessionExerciseId}-${setEntry.setLogId}`}
                              onDelete={() => onDeleteSet(setEntry.setLogId)}
                              onOpen={() => onOpenSet(item.sessionExerciseId, setEntry)}
                              restLabel={displayedRestSeconds !== null ? `Rest ${formatClock(displayedRestSeconds)}` : null}
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

      <View style={[styles.timelineBottomDockWrap, { pointerEvents: 'box-none' }]}>
        <View
          style={[
            styles.timelineBottomDockPanel,
            {
              backgroundColor: pane.backgroundColor,
              borderColor: pane.borderColor,
            },
          ]}
        >
          <View style={styles.timelineBottomDockContent}>
            <Pressable
              accessibilityLabel="Finish workout"
              disabled={isWorking || displayTimeline.length === 0 || Boolean(draggingExerciseId)}
              onPress={onToggleFinishSessionConfirm}
              style={({ pressed }) => [
                styles.timelineBottomPrimaryPressable,
                getTapScaleStyle(pressed, isWorking || displayTimeline.length === 0 || Boolean(draggingExerciseId)),
              ]}
            >
              <View
                style={[
                  styles.timelineBottomPrimaryGradient,
                  { backgroundColor: theme.colors.accentPrimary },
                ]}
              >
                <Ionicons color={String(theme.colors.accentPrimaryText)} name="flag-outline" size={16} />
                <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="bodyStrong">
                  Finish workout
                </ReedText>
              </View>
            </Pressable>

            <Pressable
              accessibilityLabel="Add exercise"
              disabled={isWorking || Boolean(draggingExerciseId)}
              onPress={() => {
                onClearFinishSessionConfirm();
                onAddExercise();
              }}
              style={({ pressed }) => [
                styles.timelineBottomSecondaryButton,
                {
                  backgroundColor: theme.colors.controlActiveFill,
                  borderColor: theme.colors.controlActiveBorder,
                  ...getTapScaleStyle(pressed, isWorking),
                },
              ]}
            >
              <Ionicons color={String(theme.colors.textPrimary)} name="add" size={18} />
              <ReedText variant="bodyStrong">Add exercise</ReedText>
            </Pressable>
          </View>
        </View>
      </View>

      {isConfirmingFinishSession ? (
        <View
          style={[
            styles.timelineFinishModalOverlay,
            {
              left: -theme.spacing.lg,
              right: -theme.spacing.lg,
            },
          ]}
        >
          <Pressable onPress={onClearFinishSessionConfirm} style={styles.timelineFinishModalBackdrop}>
            {canUseBlur ? (
              <BlurView intensity={scrim.blurIntensity} style={styles.timelineFinishModalBackdropBlur} tint={theme.blur.tint} />
            ) : null}
            <View
              style={[
                styles.timelineFinishModalBackdropTint,
                { backgroundColor: scrim.backgroundColor },
              ]}
            />
          </Pressable>
          <GlassSurface contentStyle={styles.timelineFinishModalCardContent} style={styles.timelineFinishModalCard}>
            <ReedText style={styles.timelineFinishModalTitle} variant="section">
              Finish workout?
            </ReedText>
            <ReedText style={styles.timelineFinishModalSummary} tone="muted" variant="body">
              {getFinishSummaryLabel(displayTimeline.length, elapsedLabel)}
            </ReedText>
            <View style={styles.timelineFinishModalActions}>
              <Pressable
                onPress={onClearFinishSessionConfirm}
                style={({ pressed }) => [
                  styles.timelineFinishModalButton,
                  {
                    backgroundColor: glassControls.shellBackgroundColor,
                    borderColor: glassControls.shellBorderColor,
                    ...getTapScaleStyle(pressed),
                  },
                ]}
              >
                <ReedText variant="bodyStrong">Cancel</ReedText>
              </Pressable>
              <Pressable
                disabled={isWorking}
                onPress={onFinishSession}
                style={({ pressed }) => [
                  styles.timelineFinishModalButton,
                  {
                    backgroundColor: theme.colors.accentPrimary,
                    borderColor: theme.colors.accentPrimary,
                    ...getTapScaleStyle(pressed, isWorking),
                  },
                ]}
              >
                <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="bodyStrong">
                  Finish
                </ReedText>
              </Pressable>
            </View>
          </GlassSurface>
        </View>
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
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [shouldRender, setShouldRender] = useState(expanded);

  useEffect(() => {
    if (expanded) {
      setShouldRender(true);
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
  const insertProgress = useRef(new Animated.Value(animateIn ? 0 : 1)).current;

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
  isDragging,
  onDragEnd,
  onDragMove,
  onDragStart,
}: {
  disabled: boolean;
  isDragging: boolean;
  onDragEnd: () => void;
  onDragMove: (deltaY: number) => void;
  onDragStart: () => void;
}) {
  const { theme } = useReedTheme();
  const activationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(false);
  const startPageYRef = useRef(0);

  function clearActivationTimeout() {
    if (activationTimeoutRef.current) {
      clearTimeout(activationTimeoutRef.current);
      activationTimeoutRef.current = null;
    }
  }

  const panResponder = useMemo(
    () =>
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
    [disabled, onDragEnd, onDragMove, onDragStart],
  );

  useEffect(
    () => () => {
      clearActivationTimeout();
    },
    [],
  );

  return (
    <View
      {...panResponder.panHandlers}
      accessibilityLabel="Hold and drag to reorder exercise"
      style={[
        styles.timelineActionButton,
        {
          opacity: disabled ? reedMotion.opacity.disabled : 1,
          transform: [{ scale: isDragging ? reedMotion.scale.activeTab : 1 }],
        },
      ]}
    >
      <Ionicons
        color={String(isDragging ? theme.colors.accentPrimary : theme.colors.textMuted)}
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
  highlightOnChange: boolean;
  onDelete: () => void;
  onOpen: () => void;
  restLabel: string | null;
  setEntry: TimelineSet;
  showRestAsActive: boolean;
}) {
  const { theme } = useReedTheme();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const tickProgress = useRef(new Animated.Value(0)).current;

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
            backgroundColor: theme.colors.accentPrimary,
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
          style={({ pressed }) => [styles.timelineSetPressable, getTapScaleStyle(pressed, !canOpen)]}
        >
          <View style={[styles.timelineSetBranch, { backgroundColor: theme.colors.controlBorder }]} />
          <View
            style={[
              styles.timelineSetDot,
              {
                backgroundColor: setEntry.warmup ? '#f59e0b' : theme.colors.controlBorder,
              },
            ]}
          />
          <ReedText numberOfLines={1} variant="body">
            Set {setEntry.setNumber} · {setEntry.summary}
          </ReedText>
        </Pressable>
        <Pressable
          accessibilityLabel={isConfirmingDelete ? 'Confirm delete set' : 'Delete set'}
          disabled={!canDelete}
          onPress={() => {
            if (isConfirmingDelete) {
              setIsConfirmingDelete(false);
              onDelete();
              return;
            }
            setIsConfirmingDelete(true);
          }}
          style={({ pressed }) => [
            styles.timelineSetDeleteButton,
            getTapScaleStyle(pressed, !canDelete),
          ]}
        >
          <Ionicons
            color={String(isConfirmingDelete ? theme.colors.dangerText : theme.colors.textMuted)}
            name={isConfirmingDelete ? 'checkmark' : 'trash-outline'}
            size={16}
          />
        </Pressable>
      </View>
      {restLabel ? (
        <View style={styles.timelineRestRow}>
          <Ionicons
            color={String(showRestAsActive ? theme.colors.dangerText : theme.colors.textMuted)}
            name="time-outline"
            size={14}
          />
          <ReedText tone={showRestAsActive ? 'danger' : 'muted'} variant="body">
            {restLabel}
          </ReedText>
        </View>
      ) : null}
    </Animated.View>
  );
}

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, View } from 'react-native';
import type { Id } from '@/convex/_generated/dataModel';
import { ReedText } from '@/components/ui/reed-text';
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
  onExitWorkout: () => void;
  onFinishSession: () => void;
  onOpenExercise: (sessionExerciseId: Id<'liveSessionExercises'>) => void;
  onOpenSet: (sessionExerciseId: Id<'liveSessionExercises'>, setEntry: TimelineSet) => void;
  onRemoveExercise: (sessionExerciseId: Id<'liveSessionExercises'>) => void;
  onToggleFinishSessionConfirm: () => void;
  timeline: TimelineRow[];
};

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
  onExitWorkout,
  onFinishSession,
  onOpenExercise,
  onOpenSet,
  onRemoveExercise,
  onToggleFinishSessionConfirm,
  timeline,
}: TimelinePageProps) {
  const { theme } = useReedTheme();
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [confirmExerciseDeleteId, setConfirmExerciseDeleteId] = useState<Id<'liveSessionExercises'> | null>(null);
  const previousSetCountsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    setExpandedExercises(current => {
      const next: Record<string, boolean> = {};
      const nextSetCounts: Record<string, number> = {};

      for (const item of timeline) {
        const key = item.sessionExerciseId as string;
        nextSetCounts[key] = item.setCount;

        if (key in current) {
          const previousCount = previousSetCountsRef.current[key] ?? 0;
          const hasNewSet = item.setCount > previousCount;
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
  }, [timeline]);

  useEffect(() => {
    if (!confirmExerciseDeleteId) {
      return;
    }

    const stillExists = timeline.some(item => item.sessionExerciseId === confirmExerciseDeleteId);

    if (!stillExists) {
      setConfirmExerciseDeleteId(null);
    }
  }, [confirmExerciseDeleteId, timeline]);

  return (
    <View style={styles.timelinePage}>
      <View style={styles.timelineTopRow}>
        <Pressable onPress={onExitWorkout} style={styles.navButton}>
          <Ionicons color={String(theme.colors.textPrimary)} name="arrow-back" size={18} />
        </Pressable>
        <View style={styles.metaChip}>
          <Ionicons color={String(theme.colors.textMuted)} name="time-outline" size={16} />
          <ReedText tone="muted" variant="body">
            {elapsedLabel ?? 'Live session'}
          </ReedText>
        </View>
        <View style={styles.navButtonSpacer} />
      </View>

      <View style={styles.timelineHeader}>
        <ReedText variant="section">Timeline</ReedText>
        <ReedText tone="muted" variant="body">
          {timeline.length} {timeline.length === 1 ? 'exercise' : 'exercises'}
        </ReedText>
      </View>

      <ScrollView
        contentContainerStyle={styles.timelineRailContentDocked}
        showsVerticalScrollIndicator={false}
        style={styles.timelineRailScroll}
      >
        {timeline.length === 0 ? (
          <View style={styles.timelineEmpty}>
            <ReedText tone="muted">Timeline is empty.</ReedText>
          </View>
        ) : (
          timeline.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === timeline.length - 1;
            const exerciseKey = item.sessionExerciseId as string;
            const isExpanded =
              expandedExercises[exerciseKey] ??
              (item.setCount > 0 || item.state === 'capture' || item.state === 'rest');
            const isRestingForRow =
              item.state === 'rest' &&
              activeRestExerciseId === item.sessionExerciseId &&
              typeof activeRestSeconds === 'number';
            const hasTimelineStem = !isLast || isExpanded;

            return (
              <View
                key={item.sessionExerciseId}
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
                      backgroundColor: theme.mode === 'dark' ? 'rgba(24, 24, 27, 0.48)' : 'rgba(255, 255, 255, 0.56)',
                      borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.72)',
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
                    style={({ pressed }) => [{ opacity: isWorking ? 0.45 : pressed ? 0.86 : 1 }]}
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
                            setExpandedExercises(current => ({
                              ...current,
                              [exerciseKey]: !isExpanded,
                            }));
                          }}
                          style={({ pressed }) => [
                            styles.timelineActionButton,
                            {
                              opacity: isWorking ? 0.45 : pressed ? 0.86 : 1,
                            },
                          ]}
                        >
                          <Ionicons
                            color={String(theme.colors.textMuted)}
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                          />
                        </Pressable>
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
                          style={({ pressed }) => [
                            styles.timelineActionButton,
                            {
                              opacity: isWorking ? 0.45 : pressed ? 0.86 : 1,
                            },
                          ]}
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
            );
          })
        )}
      </ScrollView>

      <View pointerEvents="box-none" style={styles.timelineBottomDockWrap}>
        <View
          style={[
            styles.timelineBottomDockPanel,
            {
              backgroundColor:
                theme.mode === 'dark' ? 'rgba(13, 18, 27, 0.82)' : 'rgba(248, 250, 255, 0.94)',
              borderColor:
                theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.76)',
            },
          ]}
        >
          <View style={styles.timelineBottomDockContent}>
            <Pressable
              accessibilityLabel="Finish workout"
              disabled={isWorking || timeline.length === 0}
              onPress={onToggleFinishSessionConfirm}
              style={({ pressed }) => [
                styles.timelineBottomPrimaryPressable,
                {
                  opacity: isWorking || timeline.length === 0 ? 0.5 : pressed ? 0.92 : 1,
                },
              ]}
            >
              <LinearGradient
                colors={['#4f8df6', '#7a67f2', '#c15db8']}
                end={{ x: 1, y: 0.5 }}
                start={{ x: 0, y: 0.5 }}
                style={styles.timelineBottomPrimaryGradient}
              >
                <Ionicons color="#ffffff" name="flag-outline" size={16} />
                <ReedText style={{ color: '#ffffff' }} variant="bodyStrong">
                  Finish workout
                </ReedText>
              </LinearGradient>
            </Pressable>

            <Pressable
              accessibilityLabel="Add exercise"
              disabled={isWorking}
              onPress={() => {
                onClearFinishSessionConfirm();
                onAddExercise();
              }}
              style={({ pressed }) => [
                styles.timelineBottomSecondaryButton,
                {
                  backgroundColor: theme.colors.controlActiveFill,
                  borderColor: theme.colors.controlActiveBorder,
                  opacity: isWorking ? 0.5 : pressed ? 0.92 : 1,
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
        <View style={styles.timelineFinishModalOverlay}>
          <Pressable onPress={onClearFinishSessionConfirm} style={styles.timelineFinishModalBackdrop} />
          <View
            style={[
              styles.timelineFinishModalCard,
              {
                backgroundColor: theme.colors.canvasSecondary,
                borderColor: theme.colors.controlBorder,
              },
            ]}
          >
            <ReedText style={styles.timelineFinishModalTitle} variant="section">
              Finish workout?
            </ReedText>
            <ReedText style={styles.timelineFinishModalSummary} tone="muted" variant="body">
              {getFinishSummaryLabel(timeline.length, elapsedLabel)}
            </ReedText>
            <View style={styles.timelineFinishModalActions}>
              <Pressable
                onPress={onClearFinishSessionConfirm}
                style={({ pressed }) => [
                  styles.timelineFinishModalButton,
                  {
                    backgroundColor: theme.colors.controlFill,
                    borderColor: theme.colors.controlBorder,
                    opacity: pressed ? 0.9 : 1,
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
                    opacity: isWorking ? 0.5 : pressed ? 0.9 : 1,
                  },
                ]}
              >
                <ReedText style={{ color: theme.colors.accentPrimaryText }} variant="bodyStrong">
                  Finish
                </ReedText>
              </Pressable>
            </View>
          </View>
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
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    // useNativeDriver: false is required because we animate `height` which
    // is a layout property. On Android with many exercises this may cause
    // jank; if observed, consider replacing with LayoutAnimation.easeInEaseOut()
    // for the expand/collapse transition instead.
    Animated.timing(progress, {
      duration: expanded ? 340 : 280,
      easing: expanded ? Easing.bezier(0.22, 1, 0.36, 1) : Easing.inOut(Easing.cubic),
      toValue: expanded ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [expanded, progress]);

  const animatedHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(1, contentHeight)],
  });
  const animatedOpacity = progress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.12, 1],
  });
  const animatedTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  });

  return (
    <Animated.View
      style={{
        height: animatedHeight,
        opacity: animatedOpacity,
        overflow: 'hidden',
        transform: [{ translateY: animatedTranslateY }],
      }}
    >
      <View
        onLayout={event => {
          const nextHeight = event.nativeEvent.layout.height;
          if (Math.abs(nextHeight - contentHeight) > 0.5) {
            setContentHeight(nextHeight);
          }
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

function TimelineSetRow({
  canDelete,
  canOpen,
  onDelete,
  onOpen,
  restLabel,
  setEntry,
  showRestAsActive,
}: {
  canDelete: boolean;
  canOpen: boolean;
  onDelete: () => void;
  onOpen: () => void;
  restLabel: string | null;
  setEntry: TimelineSet;
  showRestAsActive: boolean;
}) {
  const { theme } = useReedTheme();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  return (
    <View style={styles.timelineSetBlock}>
      <View style={styles.timelineSetRowContainer}>
        <Pressable
          disabled={!canOpen}
          onPress={() => {
            setIsConfirmingDelete(false);
            onOpen();
          }}
          style={({ pressed }) => [styles.timelineSetPressable, { opacity: canOpen ? (pressed ? 0.82 : 1) : 0.5 }]}
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
            {
              opacity: canDelete ? (pressed ? 0.82 : 1) : 0.5,
            },
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
    </View>
  );
}
